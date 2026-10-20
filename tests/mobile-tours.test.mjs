import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { tourIdFromUrl, tourLink } from "../src/lib/tour-links.ts";
const origin = "https://tnp.example";
const id = "12345678-1234-4321-8123-123456789abc";

test("tour links accept only TNP-origin tour pages", () => {
  assert.equal(tourIdFromUrl(tourLink(id, origin), origin), id);
  assert.equal(tourIdFromUrl("/tours/" + id, origin), id);
  assert.equal(tourIdFromUrl("/tours/" + id + "/", origin), id);
  for (const url of [
    "https://evil.example/tours/" + id,
    "javascript:alert(1)",
    "//evil.example/tours/" + id,
    "/tours/not-a-uuid",
    "/tours/" + id + "?redirect=evil",
    "/tours/" + id + "#evil",
    "/auth",
    "",
  ]) {
    assert.equal(tourIdFromUrl(url, origin), null, url);
  }
  assert.throws(() => tourLink("not-a-uuid", origin));
});

function worker(fetchImpl) {
  const handlers = {};
  const cached = [];
  const self = {
    location: { origin },
    clients: { claim: async () => {} },
    skipWaiting() {},
    addEventListener: (name, handler) => {
      handlers[name] = handler;
    },
  };
  const caches = {
    open: async () => ({ addAll: async (paths) => cached.push(...paths) }),
    keys: async () => [],
    match: async (path) => ({ offline: path }),
    delete: async () => true,
  };
  vm.runInNewContext(fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self,
    caches,
    fetch: fetchImpl,
    URL,
  });
  return { handlers, cached };
}

test("PWA install caches no account pages or API responses", async () => {
  const { handlers, cached } = worker(async () => ({}));
  let work;
  handlers.install({
    waitUntil: (promise) => {
      work = promise;
    },
  });
  await work;
  assert.ok(cached.includes("/offline.html"));
  assert.ok(cached.every((path) => path === "/offline.html" || path.startsWith("/icons/")));
});

test("PWA uses an offline page on navigation failure and ignores private API traffic", async () => {
  const { handlers } = worker(async () => {
    throw new Error("offline");
  });
  let response;
  handlers.fetch({
    request: { url: origin + "/app/tenant", method: "GET", mode: "navigate" },
    respondWith: (promise) => {
      response = promise;
    },
  });
  assert.deepEqual(await response, { offline: "/offline.html" });
  for (const request of [
    { url: origin + "/api/account", method: "GET", mode: "cors" },
    { url: origin + "/api/payment", method: "POST", mode: "cors" },
    { url: "https://db.example/rest/v1/profiles", method: "GET", mode: "cors" },
  ])
    handlers.fetch({
      request,
      respondWith: () => assert.fail("Private API request was intercepted"),
    });
});

test("housing icon files match the mobile manifest sizes and favicon is real ICO", () => {
  const manifest = JSON.parse(
    fs.readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  );
  for (const icon of manifest.icons) {
    const image = fs.readFileSync(new URL("../public" + icon.src, import.meta.url));
    const [width, height] = icon.sizes.split("x").map(Number);
    assert.equal(image.readUInt32BE(16), width);
    assert.equal(image.readUInt32BE(20), height);
  }
  const ico = fs.readFileSync(new URL("../public/favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 1);
});
