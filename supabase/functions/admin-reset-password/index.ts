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
    if (Object.keys(input).some((k) => !["user_id", "nova_senha"].includes(k)) || typeof input.user_id !== "string" || typeof input.nova_senha !== "string") return json(400, { error: "user_id and nova_senha are required" });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.user_id)) return json(400, { error: "Invalid user_id" });
    const senha = input.nova_senha;
    if (senha.length < 12 || senha.length > 128 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha) || !/[^A-Za-z0-9]/.test(senha)) return json(400, { error: "A senha deve ter 12–128 caracteres e incluir maiúscula, minúscula, número e símbolo" });
    const { data: target, error: getError } = await service.auth.admin.getUserById(input.user_id);
    if (getError || !target.user) return json(404, { error: "Usuário não encontrado" });
    const metadata = { ...(target.user.user_metadata ?? {}), senha_provisoria: true };
    const { error: authUpdateError } = await service.auth.admin.updateUserById(input.user_id, { password: senha, user_metadata: metadata });
    if (authUpdateError) return json(400, { error: "Não foi possível atualizar a senha" });
    const { error: profileUpdateError } = await service.from("profiles").update({ senha_provisoria: true }).eq("id", input.user_id);
    if (profileUpdateError) return json(500, { error: "Senha alterada, mas não foi possível atualizar o perfil" });
    return json(200, { message: "Senha redefinida" });
  } catch { return json(500, { error: "Internal server error" }); }
});
