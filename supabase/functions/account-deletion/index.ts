import { createClient } from "npm:@supabase/supabase-js@2.115.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user)
      return reply({ error: "Please sign in again before deleting your account" }, 401);
    const text = await request.text();
    if (text.length > 4096) return reply({ error: "Request too large" }, 413);
    const body = JSON.parse(text);
    if (body.confirmation !== "DELETE") return reply({ error: "Type DELETE to confirm" }, 400);
    let target = data.user.id;
    if (body.accountId && body.accountId !== target) {
      const role = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", target)
        .eq("role", "admin")
        .maybeSingle();
      if (role.error || !role.data) return reply({ error: "Not authorized" }, 403);
      target = body.accountId;
      const archived = await admin
        .from("tnp_deleted_accounts")
        .select("account_id")
        .eq("account_id", target)
        .maybeSingle();
      if (archived.error || !archived.data)
        return reply({ error: "No deleted account found" }, 404);
    } else {
      const alreadyClosed = await admin
        .from("tnp_deleted_accounts")
        .select("account_id")
        .eq("account_id", target)
        .maybeSingle();
      if (alreadyClosed.error) return reply({ error: "Unable to check account status" }, 503);
      if (!alreadyClosed.data) {
        if (typeof body.password !== "string" || body.password.length > 1024 || !data.user.email)
          return reply({ error: "Your current password is required" }, 400);
        const verifier = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const checked = await verifier.auth.signInWithPassword({
          email: data.user.email,
          password: body.password,
        });
        if (checked.error || checked.data.user?.id !== target)
          return reply({ error: "Your password is incorrect" }, 403);
        if (checked.data.session) await verifier.auth.signOut();
      }
      const archived = await admin.rpc("tnp_archive_account", { p_user: target });
      if (archived.error)
        return reply({ error: "Unable to close this account. Contact TNP support." }, 409);
    }
    // Keep an unusable Auth tombstone because financial records reference its UUID.
    const result = await admin.auth.admin.deleteUser(target, true);
    let pending = !!result.error;
    if (!pending) {
      const saved = await admin
        .from("tnp_deleted_accounts")
        .update({ auth_cleanup_pending: false })
        .eq("account_id", target);
      pending = !!saved.error;
    }
    if (target === data.user.id) await admin.auth.admin.signOut(token, "global");
    return reply({ closed: true, authCleanupPending: pending });
  } catch {
    return reply({ error: "Account deletion could not be completed. Please retry." }, 500);
  }
});
