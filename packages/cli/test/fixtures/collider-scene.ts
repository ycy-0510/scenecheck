import { Group, Scene } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  scene.name = "World";

  const car = new Group();
  car.position.set(0, 0, 0);
  describeThreeObject(car, {
    id: "car",
    colliders: [
      {
        id: "body",
        type: "box",
        size: [2, 2, 4],
      },
    ],
  });

  const gate = new Group();
  gate.position.set(2, 0, 0);
  describeThreeObject(gate, {
    id: "gate",
    colliders: [
      {
        id: "post",
        type: "box",
        size: [2, 2, 2],
      },
    ],
  });

  const sensor = new Group();
  sensor.position.set(10, 0, 0);
  describeThreeObject(sensor, {
    id: "sensor",
    colliders: [
      {
        id: "range",
        type: "sphere",
        radius: 1,
      },
    ],
  });

  scene.add(car, gate, sensor);
  return scene;
}
