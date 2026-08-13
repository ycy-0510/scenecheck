import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIVE_PROTOCOL_VERSION,
  parseLiveCaptureOptions,
  parseLiveCaptureRequest,
  parseLiveCaptureResponse,
} from "../dist/index.js";

test("live capture protocol validates requests and responses", () => {
  const request = parseLiveCaptureRequest({
    protocol: LIVE_PROTOCOL_VERSION,
    requestId: "abc",
    type: "capture",
    options: { includeBounds: false, includeInvisible: true },
  });
  assert.equal(request.requestId, "abc");
  assert.equal(request.options.includeBounds, false);

  const scene = { version: 1, roots: [], nodes: {} };
  const response = parseLiveCaptureResponse({
    protocol: LIVE_PROTOCOL_VERSION,
    requestId: "abc",
    ok: true,
    scene,
  });
  assert.equal(response.ok, true);
  assert.deepEqual(response.scene, scene);
});

test("live capture protocol rejects malformed and unsupported input", () => {
  assert.throws(
    () => parseLiveCaptureOptions({ includeBounds: "yes" }),
    /must be a boolean/i,
  );
  assert.throws(
    () =>
      parseLiveCaptureRequest({
        protocol: 99,
        requestId: "abc",
        type: "capture",
        options: {},
      }),
    /unsupported/i,
  );
  assert.throws(
    () =>
      parseLiveCaptureResponse({
        protocol: LIVE_PROTOCOL_VERSION,
        requestId: "abc",
        ok: true,
        scene: { version: 1 },
      }),
    /scene ir/i,
  );
});
