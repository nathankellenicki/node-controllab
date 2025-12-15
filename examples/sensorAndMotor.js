import ControlLab, { TouchEvent } from "../dist/index.js";

const controlLab = new ControlLab("/dev/tty.usbserial-AC018KSE");

const INPUT_PORT = 1;
const OUTPUT_PORT = "B";

(async () => {

    await controlLab.connect();

    console.log("Connected to Control Lab!");

    controlLab.setTouchSensor(INPUT_PORT);
    controlLab.on("touch", ({ event }) => {
        if (event === TouchEvent.Pressed) {
            console.log(`Starting motor on output port ${OUTPUT_PORT} at power 8`);
            controlLab.setPower(OUTPUT_PORT, 8);
        } else if (event === TouchEvent.Released) {
            console.log(`Stopping motor on output port ${OUTPUT_PORT}`);
            controlLab.setPower(OUTPUT_PORT, 0);
        }
    });

})();
