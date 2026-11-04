import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const env = (key: string) => { const v = Deno.env.get(key); if (!v) throw new Error("Server configuration error"); return v; };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const token = (req.headers.get("Authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return json(401, { error: "Unauthorized" });
    const url = env("SUPABASE_URL");
    const anon = createClient(url, env("SUPABASE_ANON_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await anon.auth.getUser(token);
    if (authError || !authData.user) return json(401, { error: "Unauthorized" });
    let body: unknown; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "Invalid request body" });
    const input = body as Record<string, unknown>;
    if (Object.keys(input).length !== 1 || input.confirmacao !== "APAGAR") return json(400, { error: "Confirmação APAGAR obrigatória" });
    const service = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: deleteError } = await service.auth.admin.deleteUser(authData.user.id);
    if (deleteError) return json(500, { error: "Não foi possível excluir a conta" });
    return json(200, { message: "Conta excluída" });
  } catch { return json(500, { error: "Internal server error" }); }
});
