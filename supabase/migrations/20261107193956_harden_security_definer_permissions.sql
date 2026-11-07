-- Evita expor funções SECURITY DEFINER internas como endpoints RPC públicos.
-- As funções trigger continuam acionadas pelos triggers existentes; os helpers RLS
-- permanecem executáveis por usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_time_entry() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
