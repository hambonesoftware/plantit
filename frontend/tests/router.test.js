import test from "node:test";
import assert from "node:assert/strict";

class FakeElement {
  constructor() {
    this.innerHTML = "";
    this.children = [];
  }

  replaceChildren(...children) {
    this.children = children;
    this.innerHTML = "";
  }

  appendChild(child) {
    this.children.push(child);
  }

  set textContent(value) {
    this.innerHTML = value;
  }
}

const listeners = new Map();

globalThis.window = {
  location: { hash: "#/" },
  addEventListener: (event, handler) => {
    listeners.set(event, handler);
  },
};

globalThis.document = {
  addEventListener: (event, handler) => {
    if (event === "DOMContentLoaded") {
      handler();
    }
  },
};

globalThis.history = {
  replaceState: () => {},
};

await import("../js/state.js");
const { Router } = await import("../js/router.js");

test("router matches dynamic segments", async () => {
  const outlet = new FakeElement();
  let receivedParams;
  const router = new Router({
    outlet,
    routes: [
      {
        path: "/v/:id",
        loader: async ({ params }) => {
          receivedParams = params;
          return {
            mount(target) {
              target.innerHTML = `village-${params.id}`;
            },
          };
        },
      },
    ],
  });

  await router.handleNavigation("/v/123");
  assert.deepEqual(receivedParams, { id: "123" });
  assert.equal(outlet.innerHTML, "village-123");
});

test("router invokes notFound handler", async () => {
  const outlet = new FakeElement();
  let notFoundCalled = false;
  const router = new Router({
    outlet,
    routes: [],
    notFound: async () => ({
      mount(target) {
        notFoundCalled = true;
        target.innerHTML = "not-found";
      },
    }),
  });

  await router.handleNavigation("/missing");
  assert.equal(notFoundCalled, true);
  assert.equal(outlet.innerHTML, "not-found");
});
