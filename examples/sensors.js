import ControlLab, { TouchEvent } from "../dist/index.js";

const controlLab = new ControlLab("/dev/tty.usbserial-AC018KSE");

(async () => {

    await controlLab.connect();

    console.log("Connected to Control Lab!");

    controlLab.setTouchSensor(1);
    controlLab.on("touch", ({ inputPort, event, force }) => {
        if (event === TouchEvent.Pressed) {
            console.log(`Touch sensor on input port ${inputPort} pressed with ${force}% force`);
        } else if (event === TouchEvent.Released) {
            console.log(`Touch sensor on input port ${inputPort} released`);
        }
    });

    controlLab.setTemperatureSensor(2);
    controlLab.on("temperature", ({ inputPort, fahrenheit, celsius }) => {
        console.log(`Temperature sensor on input port ${inputPort} at ${fahrenheit}f/${celsius}c`);
    });

    controlLab.setRotationSensor(5);
    controlLab.on("rotation", ({ inputPort, rotations }) => {
        console.log(`Rotation sensor on input port ${inputPort} rotated by ${rotations} rotations`);
    });

    controlLab.setLightSensor(6);
    controlLab.on("light", ({ inputPort, intensity }) => {
        console.log(`Light sensor on input port ${inputPort} detected light intensity at ${intensity}`);
    });

})();
