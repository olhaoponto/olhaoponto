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
    const service = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: requester, error: profileError } = await service.from("profiles").select("role,ativo").eq("id", authData.user.id).maybeSingle();
    if (profileError) return json(500, { error: "Unable to authorize request" });
    if (requester?.role !== "admin" || requester?.ativo !== true) return json(403, { error: "Forbidden" });
    let body: unknown; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "Invalid request body" });
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((k) => !["user_id", "ativo"].includes(k)) || typeof input.user_id !== "string" || typeof input.ativo !== "boolean") return json(400, { error: "user_id and boolean ativo are required" });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.user_id)) return json(400, { error: "Invalid user_id" });
    if (!input.ativo && input.user_id === authData.user.id) return json(400, { error: "Não é possível desativar a própria conta" });
    const { data: targetProfile, error: targetError } = await service.from("profiles").select("id").eq("id", input.user_id).maybeSingle();
    if (targetError) return json(500, { error: "Não foi possível atualizar o usuário" });
    if (!targetProfile) return json(404, { error: "Usuário não encontrado" });
    const { error: profileUpdateError } = await service.from("profiles").update({ ativo: input.ativo }).eq("id", input.user_id);
    if (profileUpdateError) return json(500, { error: "Não foi possível atualizar o usuário" });
    const { error: authUpdateError } = await service.auth.admin.updateUserById(input.user_id, { ban_duration: input.ativo ? "none" : "876000h" });
    if (authUpdateError) {
      await service.from("profiles").update({ ativo: !input.ativo }).eq("id", input.user_id);
      return json(500, { error: "Não foi possível atualizar o usuário" });
    }
    return json(200, { message: input.ativo ? "Usuário ativado" : "Usuário desativado" });
  } catch { return json(500, { error: "Internal server error" }); }
});
