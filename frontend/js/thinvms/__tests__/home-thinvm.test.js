import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { HomeThinVM } from "../HomeThinVM.js";
import { clearCache } from "../../services/apiClient.js";

const originalFetch = global.fetch;

beforeEach(() => {
  clearCache();
});

afterEach(() => {
  clearCache();
  global.fetch = originalFetch;
});

test("HomeThinVM.load caches ETag and reuses cached data on 304", async () => {
  const payload = { villages: { total: 2 }, plants: { total: 5 } };
  const responses = [
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: "etag-123",
      },
    }),
    new Response(null, { status: 304 }),
  ];

  let calls = 0;
  global.fetch = async (input, init = {}) => {
    const response = responses[calls];
    calls += 1;
    if (calls === 2) {
      const headerValue =
        init.headers instanceof Headers
          ? init.headers.get("If-None-Match")
          : init.headers?.["If-None-Match"];
      assert.equal(headerValue, "etag-123");
    }
    return response;
  };

  const vm = new HomeThinVM();
  const states = [];
  vm.subscribe((state) => states.push(structuredClone(state)));

  await vm.load();
  await vm.load();

  assert.equal(calls, 2);
  assert.equal(states[0].loading, true);
  assert.equal(states.at(-1).loading, false);
  assert.equal(states.at(-1).error, null);
  assert.deepEqual(states.at(-1).data, payload);
});

test("HomeThinVM.load surfaces backend errors", async () => {
  global.fetch = async () =>
    new Response(
      JSON.stringify({ error: { code: "SERVER", message: "Boom", field: null } }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

  const vm = new HomeThinVM();
  const states = [];
  vm.subscribe((state) => states.push(structuredClone(state)));

  await vm.load();

  assert.equal(states[0].loading, true);
  const finalState = states.at(-1);
  assert.equal(finalState.loading, false);
  assert.equal(finalState.data, null);
  assert.equal(finalState.error, "Boom");
});
