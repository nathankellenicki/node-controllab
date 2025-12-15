import { EventEmitter } from "events";
import { SerialPort } from "serialport";
import {
  ControlLabState,
  DEFAULT_BAUD_RATE,
  HANDSHAKE_INBOUND,
  KEEP_ALIVE_INTERVAL_MS,
  SENSOR_MESSAGE_LENGTH
} from "./constants";
import {
  ControlLabCommandMessage,
  MessageType,
  createHandshakeRequest,
  createKeepAliveMessage,
  decodeSensorMessage,
  encodeMessage
} from "./protocol";

export interface ControlLabConnectionOptions {
  baudRate?: number;
  keepAliveIntervalMs?: number;
}

type SerialPortInstance = InstanceType<typeof SerialPort>;

export class ControlLabConnection extends EventEmitter {
  private port?: SerialPortInstance;
  private buffer = Buffer.alloc(0);
  private keepAlive?: NodeJS.Timeout;
  private openPromise?: Promise<void>;
  private state: ControlLabState = ControlLabState.NotReady;
  private readonly handleDataBound: (data: Buffer) => void;
  private readonly handlePortClosedBound: () => void;
  private readonly handlePortErrorBound: (error: Error) => void;

  constructor(private readonly path: string, private readonly options: ControlLabConnectionOptions = {}) {
    super();
    this.handleDataBound = (data: Buffer) => {
      this.handleIncomingData(data);
    };
    this.handlePortClosedBound = () => {
      this.cleanupConnectionState(true);
    };
    this.handlePortErrorBound = (error: Error) => {
      this.emit("error", error);
    };
  }

  public async open(): Promise<void> {
    if (this.state === ControlLabState.Ready && this.port) {
      return;
    }
    if (!this.openPromise) {
      this.openPromise = this.openInternal();
    }
    try {
      await this.openPromise;
    } finally {
      this.openPromise = undefined;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.port) {
      return;
    }
    this.buffer = Buffer.alloc(0);
    this.state = ControlLabState.NotReady;
    this.stopKeepAlive();
    await this.closeActivePort();
  }

  public send(command: ControlLabCommandMessage): void {
    if (!this.port) {
      throw new Error("Control Lab connection is not ready");
    }
    if (command.id !== MessageType.HandshakeRequest && this.state !== ControlLabState.Ready) {
      throw new Error("Control Lab connection is not ready");
    }
    this.port.write(encodeMessage(command));
  }

  public get isReady(): boolean {
    return this.state === ControlLabState.Ready && !!this.port;
  }

  private async closeActivePort(options?: { suppressDisconnectEvent?: boolean }): Promise<void> {
    if (!this.port) {
      return;
    }
    const suppressDisconnectEvent = options?.suppressDisconnectEvent ?? false;
    const port = this.port;
    port.removeListener("data", this.handleDataBound);
    port.removeListener("error", this.handlePortErrorBound);
    if (suppressDisconnectEvent) {
      port.removeListener("close", this.handlePortClosedBound);
    }
    await closeSerialPort(port);
    if (suppressDisconnectEvent) {
      this.cleanupConnectionState(false);
    }
  }

  private async openInternal(): Promise<void> {
    this.buffer = Buffer.alloc(0);
    this.state = ControlLabState.NotReady;
    const port = new SerialPort({ path: this.path, baudRate: this.options.baudRate ?? DEFAULT_BAUD_RATE });
    this.port = port;
    port.on("data", this.handleDataBound);
    port.on("error", this.handlePortErrorBound);
    port.once("close", this.handlePortClosedBound);
    try {
      await waitForPortOpen(port);
      await this.waitForReady(() => {
        this.sendHandshake();
      });
    } catch (error) {
      await this.closeActivePort({ suppressDisconnectEvent: true });
      throw error;
    }
  }

  private waitForReady(afterHandshake: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const handleReady = () => {
        cleanup();
        resolve();
      };
      const handleError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const handleDisconnect = () => {
        cleanup();
        reject(new Error("Connection closed before becoming ready"));
      };
      const cleanup = () => {
        this.removeListener("ready", handleReady);
        this.removeListener("error", handleError);
        this.removeListener("disconnect", handleDisconnect);
      };
      this.once("ready", handleReady);
      this.once("error", handleError);
      this.once("disconnect", handleDisconnect);
      afterHandshake();
    });
  }

  private sendHandshake(): void {
    this.send(createHandshakeRequest());
  }

  private handleIncomingData(data: Buffer): void {
    if (data.length > 0) {
      this.buffer = Buffer.concat([this.buffer, data]);
    }

    if (this.state === ControlLabState.NotReady) {
      this.tryConsumeHandshake();
      return;
    }

    if (this.buffer.length >= SENSOR_MESSAGE_LENGTH) {
      this.consumeSensorMessages();
    }
  }

  private tryConsumeHandshake(): void {
    const handshakeIndex = this.buffer.indexOf(HANDSHAKE_INBOUND);
    if (handshakeIndex === -1) {
      const sliceIndex = Math.max(0, this.buffer.length - HANDSHAKE_INBOUND.length);
      if (sliceIndex > 0) {
        this.buffer = this.buffer.slice(sliceIndex);
      }
      return;
    }
    this.buffer = this.buffer.slice(handshakeIndex + HANDSHAKE_INBOUND.length);
    this.state = ControlLabState.Ready;
    this.startKeepAlive();
    this.emit("ready");
    if (this.buffer.length >= SENSOR_MESSAGE_LENGTH) {
      this.consumeSensorMessages();
    }
  }

  private consumeSensorMessages(): void {
    while (this.buffer.length >= SENSOR_MESSAGE_LENGTH) {
      if (this.buffer[0] !== 0x00) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const message = this.buffer.slice(0, SENSOR_MESSAGE_LENGTH);
      const notification = decodeSensorMessage(message);
      if (!notification) {
        this.buffer = Buffer.alloc(0);
        this.emit("error", new Error("Received invalid sensor message"));
        return;
      }
      this.buffer = this.buffer.slice(SENSOR_MESSAGE_LENGTH);
      this.emit("notification", notification);
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    const interval = this.options.keepAliveIntervalMs ?? KEEP_ALIVE_INTERVAL_MS;
    this.keepAlive = setInterval(() => {
      if (this.port && this.state === ControlLabState.Ready) {
        this.send(createKeepAliveMessage());
      }
    }, interval);
    if (typeof this.keepAlive.unref === "function") {
      this.keepAlive.unref();
    }
  }

  private stopKeepAlive(): void {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = undefined;
    }
  }

  private cleanupConnectionState(emitDisconnect: boolean): void {
    this.buffer = Buffer.alloc(0);
    this.stopKeepAlive();
    this.state = ControlLabState.NotReady;
    this.port = undefined;
    if (emitDisconnect) {
      this.emit("disconnect");
    }
  }
}

function waitForPortOpen(port: SerialPortInstance): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      port.removeListener("open", handleOpen);
      port.removeListener("error", handleError);
    };
    port.once("open", handleOpen);
    port.once("error", handleError);
  });
}

function closeSerialPort(port: SerialPortInstance): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      port.removeListener("close", handleClose);
      port.removeListener("error", handleError);
    };
    const resolveOrReject = (err?: Error | null) => {
      if (!err) {
        resolve();
        return;
      }
      if (err.message && err.message.includes("Port is not open")) {
        resolve();
      } else {
        reject(err);
      }
    };
    const handleClose = () => {
      cleanup();
      resolve();
    };
    const handleError = (err: Error) => {
      cleanup();
      resolveOrReject(err);
    };
    const isOpen = (port as SerialPortInstance & { isOpen?: boolean }).isOpen;
    if (isOpen === false) {
      resolve();
      return;
    }
    port.once("close", handleClose);
    port.once("error", handleError);
    try {
      port.close((err?: Error | null) => {
        cleanup();
        resolveOrReject(err ?? undefined);
      });
    } catch (err) {
      cleanup();
      resolveOrReject(err as Error);
    }
  });
}
