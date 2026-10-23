import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../javascripts/discourse/lib/fkb-adsense.js", import.meta.url),
  "utf8"
);
const { loadAdsense, waitForAdWidth } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

globalThis.window = {};
let appended = [];
let listeners = {};
const doc = {
  querySelector: () => null,
  createElement: () => ({
    addEventListener: (name, fn) => {
      listeners[name] = fn;
    },
  }),
  head: {
    appendChild: (node) => appended.push(node),
  },
};

const first = loadAdsense("123456789", doc);
const second = loadAdsense("123456789", doc);
assert.equal(first, second);
assert.equal(appended.length, 1);
assert.equal(
  appended[0].src,
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123456789"
);

listeners.load();
await first;
assert.equal(await loadAdsense("123456789", doc), undefined);
await assert.rejects(loadAdsense("bad", doc));

let resize;
let frames = [];
let disconnected = 0;
globalThis.ResizeObserver = class {
  constructor(fn) {
    resize = fn;
  }
  observe() {}
  disconnect() {
    disconnected++;
  }
};
globalThis.requestAnimationFrame = (fn) => {
  frames.push(fn);
  return frames.length;
};
globalThis.cancelAnimationFrame = () => {};

let width = 0;
let requests = 0;
const element = {
  isConnected: true,
  getBoundingClientRect: () => ({ width }),
  getClientRects: () => (width ? [1] : []),
};

const cancel = waitForAdWidth(element, () => requests++);
frames.shift()();
assert.equal(requests, 0);

width = 320;
resize();
resize();
assert.equal(requests, 1);

cancel();
resize();
assert.equal(requests, 1);

width = 0;
const cancelPending = waitForAdWidth(element, () => requests++);
cancelPending();
width = 320;
resize();
assert.equal(requests, 1);

element.isConnected = false;
waitForAdWidth(element, () => requests++);
frames.at(-1)();
assert.equal(requests, 1);
assert.ok(disconnected >= 2);
console.log(
  "PASS: one client script, shared promise, invalid publisher, zero-width wait, one request, cancellation and detached slot."
);

// Exercise the integration boundary: tagless plugin components have no element.
const { runInNewContext } = await import("node:vm");
let changes;
let pageChange;
let requested = 0;
let loaded = 0;
let canceled = 0;
const slot = {
  isConnected: true,
  getBoundingClientRect: () => ({ width: 320 }),
  hasAttribute: () => false,
};
const integration = (
  await readFile(
    new URL(
      "../javascripts/discourse/api-initializers/fkb-adsense.js",
      import.meta.url
    ),
    "utf8"
  )
)
  .replace(/^import .*;\n/gm, "")
  .replace("export default ", "");

const browserWindow = {
  location: { pathname: "/admin/customize/themes/1" },
  adsbygoogle: { push: () => requested++ },
};

runInNewContext(integration, {
  apiInitializer: (_version, callback) =>
    callback({
      container: { lookup: () => ({ adsense_publisher_code: "123456789" }) },
      onPageChange: (callback) => {
        pageChange = callback;
      },
      decorateCookedElement: () => {},
      modifyClass: (_name, value) => {
        changes = value;
      },
    }),
  computed: (...args) => args.at(-1),
  isTesting: () => false,
  loadAdsense: async () => {
    loaded++;
  },
  waitForAdWidth: (_element, callback) => {
    Promise.resolve().then(callback);
    return () => canceled++;
  },
  window: browserWindow,
  console,
  document: {
    head: { querySelector: () => null, appendChild: () => {} },
    querySelector: (selector) => {
      assert.equal(selector, ".fkb-adsense-1");
      return { querySelector: () => slot };
    },
  },
});

pageChange("/admin/customize/themes/1");
assert.equal(loaded, 0);
pageChange("/t/question/1");
assert.equal(loaded, 1);

const instance = {
  ...changes,
  placement: "post-bottom",
  get: () => true,
  set(key, value) {
    this[key] = value;
  },
  _super() {},
};
assert.equal(instance.classForSlot(), "adsense-post-bottom fkb-adsense-1");

instance._triggerAds();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(requested, 0);

browserWindow.location.pathname = "/t/question/1";
instance._triggerAds();
await new Promise((resolve) => setImmediate(resolve));
instance._triggerAds();
assert.equal(requested, 1);

instance.willDestroyElement();
assert.equal(canceled, 1);
console.log(
  "PASS: tagless component slot lookup, admin exclusion, public navigation, one request and teardown."
);
