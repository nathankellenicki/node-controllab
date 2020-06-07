import { EventEmitter} from "events";

import SerialPort from "serialport";

import * as Consts from "./consts";

const HANDSHAKE_OUTBOUND = "p\0###Do you byte, when I knock?$$$";
const HANDSHAKE_INBOUND = "###Just a bit off the block!$$$";
const SENSOR_MESSAGE_LENGTH = 19;
const SENSOR_MESSAGE_OFFSETS = [14, 10, 6, 2, 16, 12, 8, 4];
const OUTPUT_INDICES = ["A", "B", "C", "D", "E", "F", "G", "H"];


export class ControlLab extends EventEmitter {


    public state: Consts.State = Consts.State.NOT_READY;

    private _serialPort: SerialPort;
    private _messageBuffer: Buffer = Buffer.alloc(0);
    private _keepAlive: NodeJS.Timer;

    private _sensorValues: number[] = new Array(8).fill(0);
    private _rotationValues: number[] = new Array(8).fill(0);

    private _sensorTypes: Consts.SensorType[] = new Array(8).fill(Consts.SensorType.UNKNOWN);


    constructor (path: string) {
        super();
        this._serialPort = new SerialPort(path, { baudRate: 9600 });
        this._serialPort.on("data", this._handleIncomingData.bind(this));
        this._sendHandshake();
        this._keepAlive = this._startKeepAlive();
    }


    public setSensorType (port: number, type: Consts.SensorType) {
        this._sensorTypes[port - 1] = type;
        this._sensorValues[port - 1] = 0;
        this.resetRotation(port);
    }


    public resetRotation (port: number) {
        this._rotationValues[port - 1] = 0;
    }


    public setPower (output: string, power: number) {
        if (!(power <= 8 && power >= -8)) {
            throw new Error("Power must be between -8 and 8");
        }
        const outputIndex = 1 << OUTPUT_INDICES.indexOf(output);
        if (power === 0) {
            const message = Buffer.alloc(2);
            message[0] = Consts.Commands.POWER_OFF;
            message[1] = outputIndex;
            this._serialPort.write(message);
            return;
        }
        const message = Buffer.alloc(6);
        if (power < 0) {
            message[0] = Consts.Commands.DIRECTION_RIGHT;
        } else {
            message[0] = Consts.Commands.DIRECTION_LEFT;
        }
        power = Math.abs(power) - 1;
        message[1] = outputIndex;
        message[2] = Consts.Commands.POWER_LEVEL | power;
        message[3] = outputIndex;
        message[4] = Consts.Commands.POWER_ON;
        message[5] = outputIndex;
        this._serialPort.write(message);
    }


    public sleep (delay: number) {
        return new Promise((resolve) => {
            setTimeout(resolve, delay);
        });
    }


    private _sendHandshake () {
        this._serialPort.write(Buffer.from(HANDSHAKE_OUTBOUND));
    }


    private _startKeepAlive () {
        return setInterval(() => {
            this._serialPort.write(Buffer.from([0x02]));
        }, 2000);
    }


    private _handleIncomingData (data?: Buffer) {

        if (data) {
            if (!this._messageBuffer) {
                this._messageBuffer = data;
            } else {
                this._messageBuffer = Buffer.concat([this._messageBuffer, data]);
            }
        }

        if (this._messageBuffer.length <= 0) {
            return;
        }

        if (this.state === Consts.State.NOT_READY) {
            if (this._messageBuffer.length >= HANDSHAKE_INBOUND.length) {
                const message = this._messageBuffer.slice(0, HANDSHAKE_INBOUND.length);
                if (message.includes(HANDSHAKE_INBOUND)) {
                    this._messageBuffer = this._messageBuffer.slice(this._messageBuffer.indexOf(HANDSHAKE_INBOUND) + HANDSHAKE_INBOUND.length);
                    this.state = Consts.State.READY;
                    this.emit("connected");
                    if (this._messageBuffer.length > 0) {
                        this._handleIncomingData();
                    }
                }
            }
            return;
        }

        if (this.state === Consts.State.READY) {

            if (
                this._messageBuffer.length >= SENSOR_MESSAGE_LENGTH
                && this._messageBuffer[0] === 0x00
                // && this._messageBuffer[1] === 0x00 // NK Docs say first two bytes of a message should always be 0x00 0x00, but sometimes its 0x00 0x01?!
            ) {
                const message = this._messageBuffer.slice(0, SENSOR_MESSAGE_LENGTH);
                this._messageBuffer = this._messageBuffer.slice(SENSOR_MESSAGE_LENGTH);

                if (!this._verifyMessage(message)) {
                    this._messageBuffer = Buffer.alloc(0);
                    return;
                }

                this._parseMessage(message);
                if (this._messageBuffer.length > 0) {
                    this._handleIncomingData();
                }
            }
        }

    }


    private _verifyMessage (message: Buffer) {
        let checksum = 0;
        for (let byte = 0; byte < message.length; byte++) {
            checksum += message[byte];
        }
        if ((checksum & 0xff) === 0xff) {
            return true;
        } else {
            return false;
        }
    }


    private _parseMessage (message: Buffer) {
        for (let sensor = 0; sensor < 8; sensor++) {
            const port = sensor + 1;

            const word = message.slice(SENSOR_MESSAGE_OFFSETS[sensor], SENSOR_MESSAGE_OFFSETS[sensor] + 2);

            const value = (word[0] << 2) | ((word[1] >> 6) & 0x03);
            const state = word[1] & 0x3f;
            let change = state & 3;
            if ((state & 4) === 0) {
                change *= -1;
            }
            this._rotationValues[sensor] += change;

            switch (this._sensorTypes[sensor]) {
                case Consts.SensorType.TOUCH:
                {
                    const pressedValue = (value < 1000) ? 1 : 0;
                    if (pressedValue !== this._sensorValues[sensor]) {
                        this._sensorValues[sensor] = pressedValue;
                        this.emit("touch", port, { event: pressedValue });
                    }
                    break;
                }
                case Consts.SensorType.TEMPERATURE:
                {
                    const fahrenheit = +(((760 - value) / 4.4 + 32).toFixed(2));
                    if (fahrenheit !== this._sensorValues[sensor]) {
                        this._sensorValues[sensor] = fahrenheit;
                        this.emit("temperature", port, { fahrenheit });
                    }
                    break;
                }
                case Consts.SensorType.LIGHT:
                {
                    const intensity = value;
                    if (intensity !== this._sensorValues[sensor]) {
                        this._sensorValues[sensor] = intensity;
                        this.emit("light", port, { intensity: 1024 - intensity });
                    }
                    break;
                }
                case Consts.SensorType.ROTATION:
                {
                    const rotation = this._rotationValues[sensor];
                    if (rotation !== this._sensorValues[sensor]) {
                        this._sensorValues[sensor] = rotation;
                        this.emit("rotate", port, { degrees: rotation * 22.5 });
                    }
                    break;
                }
            }

        }
    }

}