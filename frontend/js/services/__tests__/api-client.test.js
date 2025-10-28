import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { resolveApiBase } from "../apiClient.js";

afterEach(() => {
  delete global.window;
});

test("resolveApiBase returns localhost when window is undefined", () => {
  delete global.window;
  assert.equal(resolveApiBase(), "http://localhost:8000");
});

test("resolveApiBase respects explicit override", () => {
  global.window = {
    PLANTIT_API_BASE: "https://api.example.com",
    location: { origin: "https://app.example.com", hostname: "app.example.com", port: "" },
  };
  assert.equal(resolveApiBase(), "https://api.example.com");
});

test("resolveApiBase returns same origin for non-localhost origins", () => {
  global.window = {
    location: { origin: "https://plants.example.com", hostname: "plants.example.com", port: "" },
  };
  assert.equal(resolveApiBase(), "https://plants.example.com");
});

test("resolveApiBase falls back to localhost backend for dev servers", () => {
  global.window = {
    location: { origin: "http://localhost:4173", hostname: "localhost", port: "4173" },
  };
  assert.equal(resolveApiBase(), "http://localhost:8000");
});
