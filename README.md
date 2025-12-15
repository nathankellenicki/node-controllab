# node-controllab - A Javascript module to interface with the LEGO DACTA Control Lab.

### Installation

Node.js v22.0+ required.

`npm install node-controllab --save`

### Example

```js
import ControlLab, { TouchEvent } from "../dist/index.js";

const controlLab = new ControlLab("/dev/tty.usbserial-AC018KSE");  // Change this to your serial port

const INPUT_PORT = 1;
const OUTPUT_PORT = "B";

(async () => {

    await controlLab.connect();

    console.log("Connected to Control Lab!");

    controlLab.setTouchSensor(INPUT_PORT);  // Set input port 1 to a touch sensor
    controlLab.on("touch", ({ event }) => {
        if (event === TouchEvent.Pressed) {
            console.log(`Starting motor on output port ${OUTPUT_PORT} at power 8`);
            controlLab.setPower(OUTPUT_PORT, 8); // Drive motor on port A forward at full power (range is -8 to 8)
        } else if (event === TouchEvent.Released) {
            console.log(`Stopping motor on output port ${OUTPUT_PORT}`);
            controlLab.setPower(OUTPUT_PORT, 0); // Stop motor on port A
        }
    });

})();
```

More examples available in the `examples` directory.