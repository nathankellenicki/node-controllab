export enum State {
    NOT_READY = 0,
    READY = 1,
}

export enum TouchEvent {
    PRESSED = 1,
    RELEASED = 0,
}

export enum Commands {
    POWER_OFF = 0x90,
    POWER_ON = 0x91,
    DIRECTION_LEFT = 0x93,
    DIRECTION_RIGHT = 0x94,
    POWER_LEVEL = 0xb0,

}

export enum SensorType {
    UNKNOWN = 0,
    TOUCH = 1,
    TEMPERATURE = 2,
    LIGHT = 3,
    ROTATION = 4,
}