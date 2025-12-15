import ControlLab from "../dist/index.js";

const controlLab = new ControlLab("/dev/tty.usbserial-AC018KSE");

const OUTPUT_PORT = "B";

(async () => {

    await controlLab.connect();

    console.log("Connected to Control Lab!");

    console.log(`Starting motor on output port ${OUTPUT_PORT} at power 8 for 2 seconds`);
    controlLab.setPower(OUTPUT_PORT, 8);
    await controlLab.sleep(2000);

    console.log(`Stopping motor on output port ${OUTPUT_PORT} for 2 seconds`);
    controlLab.setPower(OUTPUT_PORT, 0);
    await controlLab.sleep(2000);

    console.log(`Motor on output port ${OUTPUT_PORT} at power -4 for 1 seconds`);
    controlLab.setPower(OUTPUT_PORT, -4);
    await controlLab.sleep(1000);

    console.log(`Stopping motor on output port ${OUTPUT_PORT} for 1 seconds`);
    controlLab.setPower(OUTPUT_PORT, 0);
    await controlLab.sleep(1000);

    console.log(`Motor on output port ${OUTPUT_PORT} at power 2 for 3 seconds`);
    controlLab.setPower(OUTPUT_PORT, 2);
    await controlLab.sleep(3000);

    console.log(`Stopping motor on output port ${OUTPUT_PORT}`);
    await controlLab.setPower(OUTPUT_PORT, 0);
    controlLab.disconnect();

})();
