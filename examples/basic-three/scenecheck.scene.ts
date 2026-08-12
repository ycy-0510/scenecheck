import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";

export default function createScene(): Group {
  const world = new Group();
  world.name = "World";

  const platform = new Mesh(
    new BoxGeometry(10, 0.5, 10),
    new MeshBasicMaterial(),
  );
  platform.name = "Platform";
  platform.position.y = -0.25;
  platform.userData.scenecheckId = "platform";
  world.add(platform);

  const marker = new Mesh(
    new BoxGeometry(1, 2, 1),
    new MeshBasicMaterial(),
  );
  marker.name = "Marker";
  marker.position.set(2, 1, -3);
  marker.userData.scenecheckId = "marker";
  world.add(marker);

  return world;
}
