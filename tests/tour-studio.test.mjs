import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  safeWebUrl,
  newHotspot,
  validateDocument,
  removeSceneReferences,
  transitionView,
  embedCode,
  videoEmbedUrl,
} from "../src/modules/virtual-tours/lib/model.ts";
import {
  defaultSceneSettings,
  defaultTourSettings,
} from "../src/modules/virtual-tours/types/index.ts";
const tourId = "12345678-1234-4321-8123-123456789abc";
const ownerId = "22345678-1234-4321-8123-123456789abc";
const roomA = "32345678-1234-4321-8123-123456789abc";
const roomB = "42345678-1234-4321-8123-123456789abc";
const document = () => ({
  id: tourId,
  owner_id: ownerId,
  title: "Garden flat",
  description: "",
  visibility: "unlisted",
  is_published: false,
  revision: 0,
  settings: defaultTourSettings(),
  scenes: [roomA, roomB].map((id, i) => ({
    id,
    tour_id: tourId,
    name: "Room " + i,
    scene_order: i,
    storage_path: ownerId + "/" + tourId + "/" + i + ".jpg",
    panorama_url: "https://media.example/" + i + ".jpg",
    settings: defaultSceneSettings(),
  })),
});
test("room links require valid destinations; unsafe link actions are rejected", () => {
  const doc = document();
  assert.deepEqual(validateDocument(doc), []);
  const spot = newHotspot({ yaw: 0, pitch: 0, zoom: 0 });
  doc.scenes[0].settings.hotspots.push(spot);
  assert.match(validateDocument(doc).join(" "), /destination/);
  spot.targetSceneId = roomB;
  assert.deepEqual(validateDocument(doc), []);
  spot.kind = "link";
  spot.url = "javascript:alert(1)";
  assert.match(validateDocument(doc).join(" "), /http/);
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,evil",
    "https://user:pass@example.com",
  ])
    assert.equal(safeWebUrl(value), null);
  assert.equal(safeWebUrl("https://example.com/tour"), "https://example.com/tour");
});
test("deleting a room removes its links, floor-plan pins and starting-room reference", () => {
  const doc = document();
  const spot = newHotspot({ yaw: 0, pitch: 0, zoom: 0 });
  spot.targetSceneId = roomB;
  doc.scenes[0].settings.hotspots.push(spot);
  doc.settings.startSceneId = roomB;
  doc.settings.floorPins.push({ sceneId: roomB, x: 10, y: 20 });
  const next = removeSceneReferences(doc, roomB);
  assert.equal(next.scenes.length, 1);
  assert.equal(next.scenes[0].settings.hotspots.length, 0);
  assert.equal(next.settings.startSceneId, null);
  assert.equal(next.settings.floorPins.length, 0);
  assert.equal(doc.scenes.length, 2);
});
test("walkthrough orientation accounts for room north alignment", () => {
  assert.deepEqual(transitionView({ yaw: 1, pitch: 0.2, zoom: 20 }, 0.5, 0.2, true), {
    yaw: 1.3,
    pitch: 0.2,
    zoom: 20,
  });
  assert.equal(transitionView({ yaw: 1, pitch: 0, zoom: 0 }, 0, 0, false), null);
  assert.match(embedCode(tourId, "https://tnp.example"), /embed=1/);
  assert.match(embedCode(tourId, "https://tnp.example"), /allowfullscreen/);
});
function edge(options = {}) {
  let handler;
  const calls = [];
  const doc = document();
  if (options.foreign) doc.scenes[0].storage_path = "other-owner/secret.jpg";
  const admin = {
    from:()=>{const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:options.closedAccount?{account_id:ownerId}:null,error:null})};return q},
    auth: { getUser: async () => ({ data: { user: options.user ? { id: options.user } : null } }) },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "tnp_tour_rate_limit")
        return { data: options.limited ? false : true, error: null };
      return { data: doc, error: null };
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths, ttl) => {
          calls.push({ name: "sign", paths, ttl });
          return {
            data: paths.map((path) => ({ path, signedUrl: "https://signed.example/" + path })),
            error: null,
          };
        },
      }),
    },
  };
  let source = fs
    .readFileSync(new URL("../supabase/functions/virtual-tours/index.ts", import.meta.url), "utf8")
    .replace(/^import[^;]+;/, "const { createClient } = globalThis.__deps;");
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  vm.runInNewContext(code, {
    Deno: {
      serve: (value) => {
        handler = value;
      },
      env: { get: () => (options.noConfig ? undefined : "configured") },
    },
    __deps: { createClient: () => admin },
    Request,
    Response,
    crypto,
    TextEncoder,
    console,
  });
  return { handler, calls };
}
test("sharing service ignores a client-supplied viewer identity and uses verified authentication", async () => {
  const { handler, calls } = edge({ user: ownerId });
  const response = await handler(
    new Request("https://edge.example", {
      method: "POST",
      headers: { authorization: "Bearer token", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ tourId, password: "", viewerId: "attacker" }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.find((call) => call.name === "tnp_edge_read_tour").args.p_viewer, ownerId);
  assert.equal(calls.find((call) => call.name === "sign").ttl, 300);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("sharing service never signs media from a different owner or tour", async () => {
  const { handler, calls } = edge({ foreign: true });
  const response = await handler(
    new Request("https://edge.example", { method: "POST", body: JSON.stringify({ tourId }) }),
  );
  assert.equal(response.status, 400);
  assert.equal(
    calls.some((call) => call.name === "sign"),
    false,
  );
});
test("sharing service enforces rate limits before reading tour data", async () => {
  const { handler, calls } = edge({ limited: true });
  const response = await handler(
    new Request("https://edge.example", { method: "POST", body: JSON.stringify({ tourId }) }),
  );
  assert.equal(response.status, 429);
  assert.equal(
    calls.some((call) => call.name === "tnp_edge_read_tour"),
    false,
  );
});
test("sharing service rejects unsupported methods and invalid tour IDs", async () => {
  const { handler } = edge();
  assert.equal((await handler(new Request("https://edge.example", { method: "GET" }))).status, 405);
  assert.equal(
    (
      await handler(
        new Request("https://edge.example", {
          method: "POST",
          body: JSON.stringify({ tourId: "invalid" }),
        }),
      )
    ).status,
    400,
  );
});

test('video cards embed only allowlisted YouTube and Vimeo player URLs',()=>{assert.equal(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');assert.equal(videoEmbedUrl('https://vimeo.com/123456789'),'https://player.vimeo.com/video/123456789');assert.equal(videoEmbedUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'),null);assert.equal(videoEmbedUrl('javascript:alert(1)'),null);});

test('closed account cannot obtain signed tour media',async()=>{const {handler,calls}=edge({user:ownerId,closedAccount:true});const response=await handler(new Request('https://edge.example',{method:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify({tourId})}));assert.equal(response.status,403);assert.equal(calls.filter(c=>c.name==='sign').length,0);});
