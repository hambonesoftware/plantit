import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { mountLocalControls } from '../../frontend/services/pwa.js';

class ElementStub {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.hidden = false;
    this.textContent = '';
    this.classList = { toggle() {} };
  }
  setAttribute() {}
  addEventListener() {}
  append(...children) { this.children.push(...children); }
  prepend(...children) { this.children.unshift(...children); }
}

test('the persistent-storage request disappears if local permission is granted', async () => {
  globalThis.document = { createElement: tag => new ElementStub(tag) };
  globalThis.window = { addEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true, storage: { persisted: async () => true } },
  });
  const root = new ElementStub('div');
  mountLocalControls(root);
  const panel = root.children[0];
  const button = panel.children.find(child => child.textContent === 'Request persistent storage');
  const status = panel.children.find(child => child.id === 'local-storage-status');
  assert.ok(button);
  for (let i = 0; i < 20 && !button.hidden; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(button.hidden, true);
  assert.match(status.textContent, /Persistent storage granted/);
});
