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
  try {
    const text = await request.text();
    if (text.length > 1024) return reply({ error: "Request too large" }, 413);
    const body = JSON.parse(text);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply({ error: "Enter a valid email address" }, 400);
    const client =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data, error } = await admin.rpc("tnp_registration_status", {
      p_email: email,
      p_client: client,
    });
    if (error) return reply({ error: "Unable to check email" }, 503);
    if (data?.limited)
      return reply({ error: "Too many checks. Please try again in ten minutes." }, 429);
    return reply({ exists: data.exists });
  } catch {
    return reply({ error: "Unable to check email" }, 400);
  }
});
