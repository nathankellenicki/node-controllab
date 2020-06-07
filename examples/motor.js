const ControlLab = require("..");

const controlLab = new ControlLab.ControlLab("/dev/tty.usbserial-AC018HBC");

(async () => {

    await controlLab.connect();

    console.log("Connected to Control Lab!");

    console.log("Starting motor on port A at power 8 for 2 seconds");
    controlLab.setPower("A", 8);
    await controlLab.sleep(2000);

    console.log("Stopping motor on port A for 2 seconds");
    controlLab.setPower("A", 0);
    await controlLab.sleep(2000);

    console.log("Motor on port A at power -4 for 1 seconds");
    controlLab.setPower("A", -4);
    await controlLab.sleep(1000);

    console.log("Stopping motor on port A for 1 seconds");
    controlLab.setPower("A", 0);
    await controlLab.sleep(1000);

    console.log("Motor on port A at power 6 for 3 seconds");
    controlLab.setPower("A", 6);
    await controlLab.sleep(3000);

    console.log("Stopping motor on port A");
    await controlLab.setPower("A", 0);

    controlLab.disconnect();

})();