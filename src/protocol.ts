import {
  ControlLabCommand as ControlLabOpcode,
  HANDSHAKE_OUTBOUND,
  SENSOR_MESSAGE_LENGTH,
  SENSOR_MESSAGE_OFFSETS
} from "./constants";

export enum MessageType {
  HandshakeRequest = 0,
  KeepAlive = 1,
  OutputPowerCommand = 2,
  SensorNotification = 3
}

export interface SensorSample {
  inputPort: number;
  rawValue: number;
  state: number;
  rotationDelta: number;
}

export interface HandshakeRequest {
  id: MessageType.HandshakeRequest;
}

export interface KeepAliveMessage {
  id: MessageType.KeepAlive;
}

export interface OutputPowerCommand {
  id: MessageType.OutputPowerCommand;
  outputMask: number;
  power: number;
}

export interface SensorNotification {
  id: MessageType.SensorNotification;
  samples: SensorSample[];
  raw: Buffer;
}

export type ControlLabCommandMessage = HandshakeRequest | KeepAliveMessage | OutputPowerCommand;
export type ControlLabIncomingMessage = SensorNotification;

const KEEP_ALIVE_MESSAGE = Buffer.from([0x02]);

export function createHandshakeRequest(): HandshakeRequest {
  return { id: MessageType.HandshakeRequest };
}

export function createKeepAliveMessage(): KeepAliveMessage {
  return { id: MessageType.KeepAlive };
}

export function createOutputPowerCommand(outputMask: number, power: number): OutputPowerCommand {
  return { id: MessageType.OutputPowerCommand, outputMask, power };
}

export function encodeMessage(message: ControlLabCommandMessage): Buffer {
  switch (message.id) {
    case MessageType.HandshakeRequest:
      return HANDSHAKE_OUTBOUND;
    case MessageType.KeepAlive:
      return KEEP_ALIVE_MESSAGE;
    case MessageType.OutputPowerCommand:
      return encodeOutputPower(message);
    default:
      return assertNever(message);
  }
}

export function decodeSensorMessage(message: Buffer): SensorNotification | null {
  if (message.length < SENSOR_MESSAGE_LENGTH) {
    return null;
  }
  if (!verifySensorMessage(message)) {
    return null;
  }
  return {
    id: MessageType.SensorNotification,
    raw: message.slice(0, SENSOR_MESSAGE_LENGTH),
    samples: parseSensorSamples(message)
  };
}

function encodeOutputPower(message: OutputPowerCommand): Buffer {
  const outputMask = message.outputMask & 0xff;
  const power = clampPower(message.power);
  if (power === 0) {
    return Buffer.from([ControlLabOpcode.PowerOff, outputMask]);
  }
  const direction = power < 0 ? ControlLabOpcode.DirectionRight : ControlLabOpcode.DirectionLeft;
  const absolutePower = Math.abs(power) - 1;
  return Buffer.from([
    direction,
    outputMask,
    ControlLabOpcode.PowerLevel | absolutePower,
    outputMask,
    ControlLabOpcode.PowerOn,
    outputMask
  ]);
}

function clampPower(power: number): number {
  if (!Number.isFinite(power)) {
    return 0;
  }
  const normalized = Math.round(power);
  if (normalized === 0) {
    return 0;
  }
  return Math.max(-8, Math.min(8, normalized));
}

function verifySensorMessage(message: Buffer): boolean {
  let checksum = 0;
  for (let i = 0; i < message.length; i += 1) {
    checksum += message[i];
  }
  return (checksum & 0xff) === 0xff;
}

function parseSensorSamples(message: Buffer): SensorSample[] {
  const samples: SensorSample[] = [];
  for (let sensor = 0; sensor < SENSOR_MESSAGE_OFFSETS.length; sensor += 1) {
    const offset = SENSOR_MESSAGE_OFFSETS[sensor];
    const word = message.slice(offset, offset + 2);
    const rawValue = (word[0] << 2) | ((word[1] >> 6) & 0x03);
    const state = word[1] & 0x3f;
    samples.push({
      inputPort: sensor + 1,
      rawValue,
      state,
      rotationDelta: extractRotationDelta(state)
    });
  }
  return samples;
}

function extractRotationDelta(state: number): number {
  let change = state & 3;
  if ((state & 4) === 0) {
    change *= -1;
  }
  return change;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported message type: ${JSON.stringify(value)}`);
}
