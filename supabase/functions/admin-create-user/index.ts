import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const env = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error("Server configuration error");
  return value;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) return json(401, { error: "Unauthorized" });
    const url = env("SUPABASE_URL");
    const anon = createClient(url, env("SUPABASE_ANON_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await anon.auth.getUser(match[1]);
    if (authError || !authData.user) return json(401, { error: "Unauthorized" });
    const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: requester, error: profileError } = await admin.from("profiles").select("role,ativo").eq("id", authData.user.id).maybeSingle();
    if (profileError) return json(500, { error: "Unable to authorize request" });
    if (requester?.role !== "admin" || requester?.ativo !== true) return json(403, { error: "Forbidden" });

    let body: unknown;
    try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "Invalid request body" });
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((k) => !["nome", "email", "senhaProvisoria"].includes(k))) return json(400, { error: "Invalid request fields" });
    if (typeof input.nome !== "string" || typeof input.email !== "string" || typeof input.senhaProvisoria !== "string") return json(400, { error: "nome, email, and senhaProvisoria are required" });
    const nome = input.nome.trim();
    const email = input.email.trim().toLowerCase();
    const senha = input.senhaProvisoria;
    if (!nome || nome.length > 120) return json(400, { error: "Invalid nome" });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Invalid email" });
    if (senha.length < 12 || senha.length > 128 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha) || !/[^A-Za-z0-9]/.test(senha)) return json(400, { error: "Senha provisória deve ter 12–128 caracteres e incluir maiúscula, minúscula, número e símbolo" });

    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, senha_provisoria: true } });
    if (createError || !created.user) {
      const conflict = createError?.code === "email_exists" || createError?.status === 422;
      return json(conflict ? 409 : 400, { error: conflict ? "Não foi possível criar usuário com esses dados" : "Não foi possível criar usuário" });
    }
    const { error: updateError } = await admin.from("profiles").update({ nome, senha_provisoria: true }).eq("id", created.user.id);
    if (updateError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json(500, { error: "Não foi possível finalizar a criação do usuário" });
    }
    return json(201, { user_id: created.user.id, message: "Usuário criado" });
  } catch {
    return json(500, { error: "Internal server error" });
  }
});
