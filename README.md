# node-controllab - A Javascript module to interface with the LEGO DACTA Control Lab.

### Installation

Node.js v8.0+ required.

`npm install node-controllab --save`

### Example

```js
const ControlLab = require("node-controllab");

const controlLab = new ControlLab.ControlLab("/dev/tty.usbserial-AC018HBC"); // Change this to your serial port

(async () => {

    await controlLab.connect();

    console.log("Connected to Control Lab!");

    controlLab.setSensorType(1, ControlLab.Consts.SensorType.TOUCH); // Set input port 1 to a touch sensor
    controlLab.on("touch", (port, { event }) => {
        if (event === ControlLab.Consts.TouchEvent.PRESSED) {
            controlLab.setPower("A", 8); // Drive motor on port A forward at full power (range is -8 to 8)
        } else if (event === ControlLab.Consts.TouchEvent.RELEASED) {
            controlLab.setPower("A", 0); // Stop motor on port A
        }
    });

})();
```

More examples available in the `examples` directory.
