export const HANDSHAKE_OUTBOUND = Buffer.from("p\0###Do you byte, when I knock?$$$", "ascii");
export const HANDSHAKE_INBOUND = Buffer.from("###Just a bit off the block!$$$", "ascii");

export const SENSOR_MESSAGE_LENGTH = 19;
export const SENSOR_MESSAGE_OFFSETS = [14, 10, 6, 2, 16, 12, 8, 4];
export const OUTPUT_PORT_INDICES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export const DEFAULT_BAUD_RATE = 9600;
export const KEEP_ALIVE_INTERVAL_MS = 2000;

export enum ControlLabState {
  NotReady = 0,
  Ready = 1
}

export enum TouchEvent {
  Pressed = 1,
  Released = 0
}

export enum ControlLabCommand {
  PowerOff = 0x90,
  PowerOn = 0x91,
  DirectionLeft = 0x93,
  DirectionRight = 0x94,
  PowerLevel = 0xb0
}

export enum SensorType {
  Unknown = 0,
  Touch = 1,
  Temperature = 2,
  Light = 3,
  Rotation = 4
}

export type OutputPortId = typeof OUTPUT_PORT_INDICES[number];
