const ControlLab = require("..");

const controlLab = new ControlLab.ControlLab("/dev/tty.usbserial-AC018HBC");

controlLab.on("connected", async () => {

    console.log("Connected to Control Lab!");

    controlLab.setSensorType(1, ControlLab.Consts.SensorType.TOUCH);
    controlLab.on("touch", (port, { event }) => {
        if (event === ControlLab.Consts.TouchEvent.PRESSED) {
            console.log(`Touch sensor on port ${port} pressed`);
        } else if (event === ControlLab.Consts.TouchEvent.RELEASED) {
            console.log(`Touch sensor on port ${port} released`);
        }
    });

    controlLab.setSensorType(2, ControlLab.Consts.SensorType.TEMPERATURE);
    controlLab.on("temperature", (port, { fahrenheit }) => {
        console.log(`Temperature sensor on port ${port} at ${fahrenheit}f`);
    });

    controlLab.setSensorType(5, ControlLab.Consts.SensorType.ROTATION);
    controlLab.on("rotate", (port, { degrees }) => {
        console.log(`Rotation sensor on port ${port} rotated to ${degrees} degrees`);
    });

    controlLab.setSensorType(6, ControlLab.Consts.SensorType.LIGHT);
    controlLab.on("light", (port, { intensity }) => {
        console.log(`Light sensor on port ${port} detected light intensity at ${intensity}`);
    });

});