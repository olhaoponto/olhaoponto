import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (payload: Record<string, unknown>, status = 200) => new Response(JSON.stringify(payload), { status, headers: corsHeaders });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Configuração administrativa indisponível.' }, 500);

  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sessão obrigatória.' }, 401);

  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Sessão inválida.' }, 401);

  const { data: caller, error: callerError } = await service
    .from('profiles')
    .select('role,ativo')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (callerError || !caller || caller.role !== 'admin' || caller.ativo !== true) return json({ error: 'Apenas administradores ativos podem executar esta ação.' }, 403);

  let body: { action?: string; user_id?: string };
  try { body = await request.json(); }
  catch { return json({ error: 'Corpo da solicitação inválido.' }, 400); }

  if (body.action === 'list') {
    const { data, error } = await service
      .from('user_presence')
      .select('user_id,last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(1000);
    if (error) return json({ error: 'Não foi possível carregar a presença dos usuários.' }, 500);
    const now = Date.now();
    const presence = (data ?? []).map((row) => {
      const seen = new Date(row.last_seen_at).getTime();
      const age = now - seen;
      return { user_id: row.user_id, last_seen_at: row.last_seen_at, active_recently: Number.isFinite(seen) && age >= -30_000 && age <= 120_000 };
    });
    return json({ presence, activity_window_seconds: 120 });
  }

  if (body.action === 'force_logout') {
    if (typeof body.user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.user_id)) return json({ error: 'Usuário inválido.' }, 400);
    const { data: target, error: targetError } = await service.from('profiles').select('id').eq('id', body.user_id).maybeSingle();
    if (targetError || !target) return json({ error: 'Não foi possível localizar este usuário.' }, 404);
    const forcedLogoutAt = new Date().toISOString();
    const { error } = await service.from('user_session_controls').upsert({
      user_id: body.user_id,
      forced_logout_at: forcedLogoutAt,
      updated_at: forcedLogoutAt,
    }, { onConflict: 'user_id' });
    if (error) return json({ error: 'Não foi possível registrar a solicitação de logout.' }, 500);
    return json({ ok: true, user_id: body.user_id, forced_logout_at: forcedLogoutAt, message: 'Os aparelhos com a versão atual do app encerrarão a sessão na próxima verificação, em até 30 segundos se estiverem on-line.' });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
});
