import * as Consts from "./consts";
import { ControlLab } from "./controllab";
import {
  ControlLabCommand,
  ControlLabState,
  SensorType,
  TouchEvent,
  OUTPUT_PORT_INDICES,
  type OutputPortId
} from "./constants";
import { ControlLabConnection } from "./connection";
import type { ControlLabConnectionOptions } from "./connection";

export default ControlLab;
export { ControlLab, Consts };
export type {
  ControlLabEventMap,
  ControlLabSensorPayload,
  TouchSensorPayload,
  TemperatureSensorPayload,
  LightSensorPayload,
  RotationSensorPayload
} from "./controllab";
export {
  ControlLabCommand,
  ControlLabState,
  SensorType,
  TouchEvent,
  OUTPUT_PORT_INDICES,
  type OutputPortId
};
export { ControlLabConnection };
export type { ControlLabConnectionOptions };

type ControlLabModuleExport = typeof ControlLab & {
  default?: typeof ControlLab;
  __esModule?: boolean;
  ControlLab: typeof ControlLab;
  Consts: typeof Consts;
  ControlLabCommand: typeof ControlLabCommand;
  ControlLabState: typeof ControlLabState;
  SensorType: typeof SensorType;
  TouchEvent: typeof TouchEvent;
  OUTPUT_PORT_INDICES: typeof OUTPUT_PORT_INDICES;
  ControlLabConnection: typeof ControlLabConnection;
};

const controlLabModule = ControlLab as ControlLabModuleExport;

controlLabModule.ControlLab = ControlLab;
controlLabModule.Consts = Consts;
controlLabModule.ControlLabCommand = ControlLabCommand;
controlLabModule.ControlLabState = ControlLabState;
controlLabModule.SensorType = SensorType;
controlLabModule.TouchEvent = TouchEvent;
controlLabModule.OUTPUT_PORT_INDICES = OUTPUT_PORT_INDICES;
controlLabModule.ControlLabConnection = ControlLabConnection;
controlLabModule.default = ControlLab;
controlLabModule.__esModule = true;

if (typeof module !== "undefined" && module.exports) {
  module.exports = controlLabModule;
}
