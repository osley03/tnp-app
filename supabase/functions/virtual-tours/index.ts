import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  try {
    const text = await request.text();
    if (text.length > 4096) return respond({ error: "Request too large" }, 413);
    const body = JSON.parse(text);
    const id = String(body.tourId || "");
    const password = typeof body.password === "string" ? body.password : "";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      password.length > 128
    )
      return respond({ error: "Invalid tour request" }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return respond({ error: "Tour service is not configured" }, 503);
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let viewer: string | null = null;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const result = await admin.auth.getUser(token);
      if(result.data.user){const closed=await admin.from('tnp_deleted_accounts').select('account_id').eq('account_id',result.data.user.id).maybeSingle();if(closed.error||closed.data)return respond({error:'Account is unavailable'},403);}
      viewer = result.data.user?.id || null;
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id + ":" + ip));
    const rateKey = Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const rate = await admin.rpc("tnp_tour_rate_limit", { p_key: rateKey });
    if (rate.error) return respond({ error: "Tour service setup is incomplete" }, 503);
    if (!rate.data) return respond({ error: "Too many attempts. Please wait a minute." }, 429);
    const result = await admin.rpc("tnp_edge_read_tour", {
      p_id: id,
      p_viewer: viewer,
      p_password: password,
    });
    if (result.error || !result.data)
      return respond({ error: "Tour unavailable or password required" }, 403);
    const doc = result.data;
    const prefix = doc.owner_id + "/" + doc.id + "/";
    const paths = new Set<string>();
    for (const scene of doc.scenes) paths.add(scene.storage_path);
    function collect(value: unknown) {
      if (!value || typeof value !== "object") return;
      const object = value as Record<string, unknown>;
      if (typeof object.path === "string") paths.add(object.path);
      for (const child of Object.values(object)) collect(child);
    }
    collect(doc.settings);
    for (const scene of doc.scenes) collect(scene.settings);
    if ([...paths].some((path) => !path.startsWith(prefix) || path.includes("..")))
      return respond({ error: "Invalid tour media reference" }, 400);
    const signed = await admin.storage.from("tnp-panoramas").createSignedUrls([...paths], 300);
    if (signed.error || signed.data?.some((item) => item.error))
      return respond({ error: "Some tour media is unavailable" }, 503);
    const urls = new Map((signed.data || []).map((item) => [item.path, item.signedUrl]));
    function resolve(value: unknown) {
      if (!value || typeof value !== "object") return;
      const object = value as Record<string, unknown>;
      if (typeof object.path === "string") object.url = urls.get(object.path) || "";
      for (const child of Object.values(object)) resolve(child);
    }
    resolve(doc.settings);
    for (const scene of doc.scenes) {
      scene.panorama_url = urls.get(scene.storage_path) || "";
      resolve(scene.settings);
    }
    return respond(doc);
  } catch (error) {
    console.error("TNP tour service", error instanceof Error ? error.message : "unknown error");
    return respond({ error: "The tour could not be loaded" }, 500);
  }
});
