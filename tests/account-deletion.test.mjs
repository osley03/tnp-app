import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
const source = stripTypeScriptTypes(
  readFileSync(
    new URL("../supabase/functions/account-deletion/index.ts", import.meta.url),
    "utf8",
  ).replace(/^import .*?;\r?\n/, ""),
);
async function run({
  password = "valid",
  archiveError = false,
  cleanupError = false,
  adminRole = false,
  body = { confirmation: "DELETE", password: "valid" },
} = {}) {
  let handler,
    archived = 0,
    updated = 0,
    cleared;
  const chain = (table) => {
    const q = {
      select() {
        return q;
      },
      eq() {
        return q;
      },
      update() {
        return q;
      },
      then(resolve) {
        return Promise.resolve({ error: null }).then(resolve);
      },
      async maybeSingle() {
        return {
          data: table === "user_roles" && adminRole ? { role: "admin" } : null,
          error: null,
        };
      },
    };
    return q;
  };
  const admin = {
    from: chain,
    rpc: async () => {
      archived++;
      return { error: archiveError ? {} : null };
    },
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "test@example.com" } },
        error: null,
      }),
      admin: {
        deleteUser: async (id, soft) => {
          updated++;
          cleared = { id, soft };
          return { error: cleanupError ? {} : null };
        },
        signOut: async () => ({ error: null }),
      },
    },
  };
  const verifier = {
    auth: {
      signInWithPassword: async () => ({
        error: password === "valid" ? null : {},
        data: { user: { id: "user-1" } },
      }),
      signOut: async () => ({}),
    },
  };
  vm.runInNewContext(source, {
    Deno: {
      env: { get: (k) => (k === "SUPABASE_ANON_KEY" ? "anon" : "server") },
      serve: (f) => (handler = f),
    },
    createClient: (u, key) => (key === "anon" ? verifier : admin),
    Response,
    crypto,
    JSON,
  });
  const response = await handler(
    new Request("https://test.invalid", {
      method: "POST",
      headers: { authorization: "Bearer test" },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, data: await response.json(), archived, updated, cleared };
}
test("wrong password cannot archive or change Auth", async () => {
  const r = await run({ password: "wrong" });
  assert.equal(r.status, 403);
  assert.equal(r.archived, 0);
  assert.equal(r.updated, 0);
});
test("confirmation is mandatory", async () => {
  const r = await run({ body: { confirmation: "no" } });
  assert.equal(r.status, 400);
  assert.equal(r.archived, 0);
});
test("archive failure leaves Auth untouched", async () => {
  const r = await run({ archiveError: true });
  assert.equal(r.status, 409);
  assert.equal(r.updated, 0);
});
test("closure uses Supabase soft deletion to preserve the account UUID", async () => {
  const r = await run();
  assert.equal(r.status, 200);
  assert.equal(r.data.closed, true);
  assert.equal(r.data.authCleanupPending, false);
  assert.equal(r.cleared.id, "user-1");
  assert.equal(r.cleared.soft, true);
});
test("Auth cleanup failure remains explicit and retryable", async () => {
  const r = await run({ cleanupError: true });
  assert.equal(r.data.closed, true);
  assert.equal(r.data.authCleanupPending, true);
});
test("tenant cannot target another account", async () => {
  const r = await run({ body: { confirmation: "DELETE", accountId: "other" } });
  assert.equal(r.status, 403);
  assert.equal(r.archived, 0);
  assert.equal(r.updated, 0);
});
