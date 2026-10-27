import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !service) throw Error("Missing local Supabase configuration");
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const results = [];
for (const role of ["tenant", "landlord"]) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = "tnp-closure-test-" + Date.now() + "-" + role + "@example.invalid",
    password = crypto.randomUUID() + "Aa1!";
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: "TNP synthetic closure test" },
  });
  if (created.error)
    throw Error("Cannot create isolated " + role + " fixture: " + created.error.message);
  const id = created.data.user.id;
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const oldToken = signed.data.session.access_token;
  const wrong = await client.functions.invoke("account-deletion", {
    body: { confirmation: "DELETE", password: "incorrect" },
  });
  assert.ok(wrong.error);
  assert.equal(
    (await admin.from("tnp_deleted_accounts").select("account_id").eq("account_id", id)).data
      .length,
    0,
  );
  const deleted = await client.functions.invoke("account-deletion", {
    body: { confirmation: "DELETE", password },
  });
  if (deleted.error)
    throw Error("Closure endpoint failed for synthetic " + role + ": " + deleted.error.message);
  assert.equal(deleted.data.closed, true);
  assert.equal(deleted.data.authCleanupPending, false);
  const archived = await admin
    .from("tnp_deleted_accounts")
    .select("*")
    .eq("account_id", id)
    .single();
  assert.equal(archived.data.account_role, role);
  assert.equal(archived.data.auth_cleanup_pending, false);
  const auth = await admin.auth.admin.getUserById(id);
  assert.ok(auth.data.user.deleted_at);
  const profile = await admin.from("profiles").select("full_name,phone,bio").eq("id", id).single();
  assert.deepEqual(profile.data, { full_name: "Deleted account", phone: null, bio: null });
  const old = await fetch(url + "/rest/v1/profiles?select=id&limit=1", {
    headers: { apikey: key, Authorization: "Bearer " + oldToken },
  });
  assert.equal(old.status, 403);
  const rpc = await fetch(url + "/rest/v1/rpc/tnp_payment_summary", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + oldToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_role: role }),
  });
  assert.equal(rpc.status, 403);
  const login = await client.auth.signInWithPassword({ email, password });
  assert.ok(login.error);
  results.push({
    role,
    closed: true,
    authSoftDeleted: true,
    staleJwtDenied: true,
    rpcDenied: true,
    wrongPasswordRejected: true,
  });
  console.log("LIVE ACCOUNT CLOSURE PASS: " + role + " (synthetic account only)");
}
const report = {
  checkedAt: new Date().toISOString(),
  projectRef: new URL(url).hostname.split(".")[0],
  results,
  existingAccountsModified: false,
};
await fs.writeFile(
  new URL("../docs/account-closure-verification.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
