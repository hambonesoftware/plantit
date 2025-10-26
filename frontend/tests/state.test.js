import test from "node:test";
import assert from "node:assert/strict";
import { subscribe, emit, clearAllListeners, getListenerCount, once } from "../js/state.js";

test("subscribe and emit deliver payload", () => {
  clearAllListeners();
  let received;
  subscribe("demo", (payload) => {
    received = payload;
  });
  emit("demo", { ok: true });
  assert.deepEqual(received, { ok: true });
});

test("unsubscribe removes listener", () => {
  clearAllListeners();
  const handler = () => {};
  const release = subscribe("demo", handler);
  assert.equal(getListenerCount("demo"), 1);
  release();
  assert.equal(getListenerCount("demo"), 0);
});

test("once only fires once", () => {
  clearAllListeners();
  let count = 0;
  once("demo", () => {
    count += 1;
  });
  emit("demo");
  emit("demo");
  assert.equal(count, 1);
});
