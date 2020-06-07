const ControlLab = require("..");

const controlLab = new ControlLab.ControlLab("/dev/tty.usbserial-AC018HBC");

(async () => {

    await controlLab.connect();

    console.log("Connected to Control Lab!");

    controlLab.setSensorType(1, ControlLab.Consts.SensorType.TOUCH);
    controlLab.on("touch", (port, { event }) => {
        if (event === ControlLab.Consts.TouchEvent.PRESSED) {
            controlLab.setPower("A", 8);
        } else if (event === ControlLab.Consts.TouchEvent.RELEASED) {
            controlLab.setPower("A", 0);
        }
    });

})();