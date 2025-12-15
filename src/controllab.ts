import { EventEmitter } from "events";
import { ControlLabConnection, ControlLabConnectionOptions } from "./connection";
import { ControlLabState, OUTPUT_PORT_INDICES, OutputPortId, SensorType, TouchEvent } from "./constants";
import { SensorNotification, createOutputPowerCommand } from "./protocol";

const INPUT_PORT_COUNT = OUTPUT_PORT_INDICES.length;

interface BaseSensorPayload {
  inputPort: number;
  rawValue: number;
}

export interface TouchSensorPayload extends BaseSensorPayload {
  kind: "touch";
  event: TouchEvent;
  pressed: boolean;
  force: number;
}

export interface TemperatureSensorPayload extends BaseSensorPayload {
  kind: "temperature";
  fahrenheit: number;
  celsius: number;
}

export interface LightSensorPayload extends BaseSensorPayload {
  kind: "light";
  intensity: number;
}

export interface RotationSensorPayload extends BaseSensorPayload {
  kind: "rotation";
  rotations: number;
  delta: number;
}

export type ControlLabSensorPayload =
  | TouchSensorPayload
  | TemperatureSensorPayload
  | LightSensorPayload
  | RotationSensorPayload;

export interface ControlLabEventMap {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  notification: (payload: ControlLabSensorPayload) => void;
  touch: (payload: TouchSensorPayload) => void;
  temperature: (payload: TemperatureSensorPayload) => void;
  light: (payload: LightSensorPayload) => void;
  rotation: (payload: RotationSensorPayload) => void;
}

export class ControlLab extends EventEmitter {
  public state: ControlLabState = ControlLabState.NotReady;

  private readonly connection: ControlLabConnection;
  private readonly sensorValues = new Array<number>(INPUT_PORT_COUNT).fill(0);
  private readonly rotationValues = new Array<number>(INPUT_PORT_COUNT).fill(0);
  private readonly sensorTypes = new Array<SensorType>(INPUT_PORT_COUNT).fill(SensorType.Unknown);
  private readonly handleSensorNotificationBound: (notification: SensorNotification) => void;
  private readonly lastSensorPayloads = new Map<string, ControlLabSensorPayload>();

  constructor(path: string, options?: ControlLabConnectionOptions) {
    super();
    this.handleSensorNotificationBound = (notification: SensorNotification) => {
      this.handleSensorNotification(notification);
    };
    this.connection = new ControlLabConnection(path, options);
    this.connection.on("ready", () => {
      this.state = ControlLabState.Ready;
      this.emit("connected");
    });
    this.connection.on("disconnect", () => {
      this.state = ControlLabState.NotReady;
      this.emit("disconnected");
    });
    this.connection.on("notification", this.handleSensorNotificationBound);
    this.connection.on("error", (error) => this.emit("error", error));
  }

  public override on<U extends keyof ControlLabEventMap>(event: U, listener: ControlLabEventMap[U]): this;
  public override on(event: string | symbol, listener: (...args: unknown[]) => void): this;
  public override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  public override once<U extends keyof ControlLabEventMap>(event: U, listener: ControlLabEventMap[U]): this;
  public override once(event: string | symbol, listener: (...args: unknown[]) => void): this;
  public override once(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.once(event, listener);
  }

  public override emit<U extends keyof ControlLabEventMap>(event: U, ...args: Parameters<ControlLabEventMap[U]>): boolean;
  public override emit(event: string | symbol, ...args: unknown[]): boolean;
  public override emit(event: string | symbol, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  public async connect(): Promise<void> {
    await this.connection.open();
  }

  public async disconnect(): Promise<void> {
    await this.connection.disconnect();
  }

  public setSensorType(inputPort: number, type: SensorType): void {
    this.ensureInputPort(inputPort);
    const index = inputPort - 1;
    this.sensorTypes[index] = type;
    this.sensorValues[index] = 0;
    this.resetRotation(inputPort);
  }

  public setTouchSensor(inputPort: number): void {
    this.setSensorType(inputPort, SensorType.Touch);
  }

  public setTemperatureSensor(inputPort: number): void {
    this.setSensorType(inputPort, SensorType.Temperature);
  }

  public setLightSensor(inputPort: number): void {
    this.setSensorType(inputPort, SensorType.Light);
  }

  public setRotationSensor(inputPort: number): void {
    this.setSensorType(inputPort, SensorType.Rotation);
  }

  public resetRotation(inputPort: number): void {
    this.ensureInputPort(inputPort);
    this.rotationValues[inputPort - 1] = 0;
  }

  public setPower(outputPort: OutputPortId | string, power: number): void {
    if (!this.connection.isReady) {
      throw new Error("Control Lab not connected");
    }
    if (power < -8 || power > 8) {
      throw new Error("Power must be between -8 and 8");
    }
    const outputMask = this.getOutputPortMask(outputPort);
    this.connection.send(createOutputPowerCommand(outputMask, power));
  }

  public sleep(delay: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  private handleSensorNotification(notification: SensorNotification): void {
    const payloads: ControlLabSensorPayload[] = [];
    notification.samples.forEach((sample) => {
      const inputPort = sample.inputPort;
      if (!inputPort || inputPort > INPUT_PORT_COUNT) {
        return;
      }
      const index = inputPort - 1;
      this.rotationValues[index] += sample.rotationDelta;
      const sensorType = this.sensorTypes[index];
      switch (sensorType) {
        case SensorType.Touch: {
          const pressedValue = sample.rawValue < 1000 ? TouchEvent.Pressed : TouchEvent.Released;
          if (pressedValue !== this.sensorValues[index]) {
            this.sensorValues[index] = pressedValue;
            const force = Math.max(0, Math.min(100, Math.floor(100 - (sample.rawValue / 1024) * 100)));
            payloads.push({
              kind: "touch",
              inputPort,
              rawValue: sample.rawValue,
              event: pressedValue,
              pressed: pressedValue === TouchEvent.Pressed,
              force
            });
          }
          break;
        }
        case SensorType.Temperature: {
          const fahrenheit = +(((760 - sample.rawValue) / 4.4 + 32).toFixed(2));
          const celsius = +(((760 - sample.rawValue) / 4.4) * (5 / 9)).toFixed(2);
          if (fahrenheit !== this.sensorValues[index]) {
            this.sensorValues[index] = fahrenheit;
            payloads.push({
              kind: "temperature",
              inputPort,
              rawValue: sample.rawValue,
              fahrenheit,
              celsius
            });
          }
          break;
        }
        case SensorType.Light: {
          const intensity = Math.floor(146 - sample.rawValue / 7);
          if (intensity !== this.sensorValues[index]) {
            this.sensorValues[index] = intensity;
            payloads.push({
              kind: "light",
              inputPort,
              rawValue: sample.rawValue,
              intensity
            });
          }
          break;
        }
        case SensorType.Rotation: {
          const rotations = this.rotationValues[index];
          if (rotations !== this.sensorValues[index]) {
            this.sensorValues[index] = rotations;
            payloads.push({
              kind: "rotation",
              inputPort,
              rawValue: sample.rawValue,
              rotations,
              delta: sample.rotationDelta
            });
          }
          break;
        }
        default:
          break;
      }
    });

    payloads.forEach((payload) => {
      if (!this.shouldEmitSensorPayload(payload)) {
        return;
      }
      this.emit("notification", payload);
      switch (payload.kind) {
        case "touch":
          this.emit("touch", payload);
          break;
        case "temperature":
          this.emit("temperature", payload);
          break;
        case "light":
          this.emit("light", payload);
          break;
        case "rotation":
          this.emit("rotation", payload);
          break;
        default:
          break;
      }
    });
  }

  private getOutputPortMask(outputPort: OutputPortId | string): number {
    const normalized = outputPort.toUpperCase();
    const index = OUTPUT_PORT_INDICES.indexOf(normalized as OutputPortId);
    if (index === -1) {
      throw new Error(`Unknown output port '${outputPort}'`);
    }
    return 1 << index;
  }

  private ensureInputPort(inputPort: number): void {
    if (inputPort < 1 || inputPort > INPUT_PORT_COUNT) {
      throw new Error(`Input port must be between 1 and ${INPUT_PORT_COUNT}`);
    }
  }

  private shouldEmitSensorPayload(payload: ControlLabSensorPayload): boolean {
    const key = this.getPayloadKey(payload);
    const previous = this.lastSensorPayloads.get(key);
    if (previous && this.sensorPayloadsEqual(previous, payload)) {
      return false;
    }
    this.lastSensorPayloads.set(key, payload);
    return true;
  }

  private getPayloadKey(payload: ControlLabSensorPayload): string {
    return `${payload.kind}:${payload.inputPort}`;
  }

  private sensorPayloadsEqual(a: ControlLabSensorPayload, b: ControlLabSensorPayload): boolean {
    if (a.kind !== b.kind || a.inputPort !== b.inputPort) {
      return false;
    }
    switch (a.kind) {
      case "touch":
        return (
          b.kind === "touch" &&
          a.event === b.event &&
          a.pressed === b.pressed &&
          a.force === b.force
        );
      case "temperature":
        return b.kind === "temperature" && a.fahrenheit === b.fahrenheit && a.celsius === b.celsius;
      case "light":
        return b.kind === "light" && a.intensity === b.intensity;
      case "rotation":
        return b.kind === "rotation" && a.rotations === b.rotations && a.delta === b.delta;
      default:
        return false;
    }
  }
}
