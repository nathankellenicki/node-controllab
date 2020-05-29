import { EventEmitter} from "events";

import SerialPort from "serialport";

import * as Consts from "./consts";

const HANDSHAKE_OUTBOUND = "p\0###Do you byte, when I knock?$$$";
const HANDSHAKE_INBOUND = "###Just a bit off the block!$$$";
const SENSOR_MESSAGE_LENGTH = 19;
const SENSOR_MESSAGE_OFFSETS = [14, 10, 6, 2, 16, 12, 8, 4];


export class ControlLab extends EventEmitter {


    public state: Consts.State = Consts.State.NOT_READY;

    private _serialPort: SerialPort;
    private _messageBuffer: Buffer = Buffer.alloc(0);

    private _sensorValues: number[] = [0, 0, 0, 0, 0, 0, 0, 0];

    private _sensorTypes: Consts.SensorType[] = [
        Consts.SensorType.UNKNOWN,
        Consts.SensorType.UNKNOWN,
        Consts.SensorType.UNKNOWN,
        Consts.SensorType.UNKNOWN,
        Consts.SensorType.UNKNOWN,
        Consts.SensorType.UNKNOWN,
        Consts.SensorType.UNKNOWN,
        Consts.SensorType.UNKNOWN,
    ]


    constructor (path: string) {
        super();
        this._serialPort = new SerialPort(path, { baudRate: 9600 });
        this._serialPort.on("data", this._handleIncomingData);
        this._sendHandshake();
    }


    public setSensorType (port: number, type: Consts.SensorType) {
        this._sensorTypes[port - 1] = type;
    }


    private _sendHandshake () {
        this._serialPort.write(Buffer.from(HANDSHAKE_OUTBOUND));
    }


    private _handleIncomingData (data?: Buffer) {

        if (data) {
            this._messageBuffer = Buffer.concat([this._messageBuffer, data]);
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
                && this._messageBuffer[1] === 0x00
            ) {
                const message = this._messageBuffer.slice(0, SENSOR_MESSAGE_LENGTH);
                this._messageBuffer = this._messageBuffer.slice(SENSOR_MESSAGE_LENGTH);

                if (!this._verifyMessage(message)) {
                    if (this._messageBuffer.length > 0) {
                        this._handleIncomingData();
                    }
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
        for (let byte = 0; byte < SENSOR_MESSAGE_LENGTH - 1; byte++) {
            checksum += message[byte];
        }
        if (checksum === 0xff) {
            return true;
        } else {
            return false;
        }
    }


    private _parseMessage (message: Buffer) {
        for (let sensor = 0; sensor < 8; sensor++) {

            const word = Buffer.from([
                message[SENSOR_MESSAGE_OFFSETS[sensor]],
                message[SENSOR_MESSAGE_OFFSETS[sensor] + 1]
            ]);

            switch (this._sensorTypes[sensor]) {
                case Consts.SensorType.TOUCH:
                    {
                        const value = word[0];
                        if (value !== this._sensorValues[sensor]) {
                            this._sensorValues[sensor] = value;
                            if (value === 0xff) {
                                this.emit("released", sensor);
                            } else {
                                this.emit("pressed", sensor);
                            }
                        }
                    }
                    break;
                case Consts.SensorType.TEMPERATURE:
                    {
                        // NK: Revisit this, endianness might be wrong
                        const value = (760 - (word.readUInt16LE(0) & 0xffc0)) / 4.4 + 32;
                        if (value !== this._sensorValues[sensor]) {
                            this._sensorValues[sensor] = value;
                            this.emit("temperature", sensor, value);
                        }
                        break;
                    }
                case Consts.SensorType.LIGHT:
                    break;
                case Consts.SensorType.ROTATION:
                    break;
            }

        }
    }


}