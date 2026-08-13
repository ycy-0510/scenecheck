import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ANNOTATION_DOCUMENT_FORMAT,
  applyAnnotationDocument,
  createAnnotationDocument,
  parseAnnotationDocumentJson,
  serializeAnnotationDocument,
} from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

const annotation = {
  id: "door-target",
  type: "pose",
  attachedTo: "tunnel",
  localTransform: identity,
  worldTransform: identity,
  label: "Emergency exit target",
};

function scene() {
  return {
    version: 1,
    roots: ["tunnel"],
    nodes: {
      tunnel: {
        id: "tunnel",
        type: "Group",
        children: [],
        localTransform: identity,
        worldTransform: identity,
      },
    },
  };
}

test("annotation documents round-trip through the versioned JSON format", () => {
  const serialized = serializeAnnotationDocument([annotation]);
  const parsed = parseAnnotationDocumentJson(serialized);

  assert.equal(parsed.format, ANNOTATION_DOCUMENT_FORMAT);
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.annotations, [annotation]);
});

test("annotation documents reject malformed transforms and duplicate ids", () => {
  assert.throws(
    () =>
      parseAnnotationDocumentJson(JSON.stringify({
        format: ANNOTATION_DOCUMENT_FORMAT,
        version: 1,
        annotations: [
          { ...annotation, worldTransform: { ...identity, position: [0, 1] } },
        ],
      })),
    /exactly 3 numbers/i,
  );

  assert.throws(
    () => createAnnotationDocument([annotation, { ...annotation }]),
    /duplicate/i,
  );
});

test("persisted annotations merge into a live scene and validate attachments", () => {
  const document = createAnnotationDocument([annotation]);
  const merged = applyAnnotationDocument(scene(), document);

  assert.equal(merged.annotations?.length, 1);
  assert.equal(merged.annotations?.[0]?.id, "door-target");

  const badDocument = createAnnotationDocument([
    { ...annotation, id: "bad", attachedTo: "missing" },
  ]);
  assert.throws(
    () => applyAnnotationDocument(scene(), badDocument),
    /attached to missing node/i,
  );
});
