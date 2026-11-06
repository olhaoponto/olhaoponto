import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, AppText, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { acceptTerms } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';

const TERMS_VERSION = '1.0-2026-11';

export default function TermsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);

  const handleAccept = async () => {
    if (!session) { setError('Sua sessão não está ativa. Entre novamente para registrar o aceite.'); return; }
    setLoading(true); setError('');
    try {
      const result = await acceptTerms(TERMS_VERSION);
      if (result.error || !result.data) { setError(result.error || 'Não foi possível registrar seu aceite.'); return; }
      useAppStore.getState().setProfile(result.data);
      router.replace('/(tabs)');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registrar o aceite. Tente novamente.');
    } finally { setLoading(false); }
  };

  return (
    <ScreenShell contentStyle={{ gap: 16, paddingBottom: 34 }}>
      <AppText variant="tiny" color={colors.deepTeal} style={{ letterSpacing: 1.1, textTransform: 'uppercase' }}>Antes de continuar</AppText>
      <AppText variant="title">Termos de uso e privacidade</AppText>
      <AppText variant="small" color={colors.muted}>Versão {TERMS_VERSION} · Olha o Ponto</AppText>
      <SurfaceCard>
        <AppText variant="subtitle">O que o aplicativo faz</AppText>
        <AppText variant="body">O Olha o Ponto ajuda você a acompanhar, por conta própria, os horários que registra no relógio da empresa e a receber alertas para não ultrapassar o limite configurado. O registro no aplicativo é um controle pessoal e não substitui o espelho oficial nem as regras do seu empregador.</AppText>
      </SurfaceCard>
      <SurfaceCard>
        <AppText variant="subtitle">Dados e finalidade</AppText>
        <AppText variant="body">São armazenados seu nome, e-mail, preferências e as batidas que você registra, exclusivamente para autenticar sua conta, exibir seu histórico, calcular totais e programar lembretes. As notificações de jornada são locais no dispositivo; o app não envia alertas push a um servidor.</AppText>
      </SurfaceCard>
      <SurfaceCard>
        <AppText variant="subtitle">Acesso e segurança</AppText>
        <AppText variant="body">As batidas ficam associadas à sua conta no Supabase e protegidas por regras de acesso. Você vê apenas seus próprios horários; a administração gerencia contas, mas não consulta batidas de outras pessoas. Não existe cadastro público: a conta é criada pela administração.</AppText>
      </SurfaceCard>
      <SurfaceCard>
        <AppText variant="subtitle">Seus direitos</AppText>
        <AppText variant="body">Você pode consultar, corrigir e exportar seus dados, e solicitar a exclusão da conta e dos registros pelo Perfil. Os dados locais podem permanecer no aparelho enquanto você estiver conectado; ao sair, o cache local do app é removido. O tratamento segue a LGPD, Lei nº 13.709/2018.</AppText>
      </SurfaceCard>
      <SurfaceCard tone="soft">
        <AppText variant="subtitle">Aviso informativo</AppText>
        <AppText variant="body">A explicação sobre 8 horas normais e até 2 horas extras se refere, de forma geral, ao Art. 59 da CLT. Não é aconselhamento jurídico nem avaliação de um caso específico. Consulte sua empresa ou profissional qualificado para orientação aplicável à sua situação.</AppText>
      </SurfaceCard>
      <Pressable onPress={() => setAccepted((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} style={styles.acceptRow}>
        <View style={[styles.checkbox, { borderColor: accepted ? colors.deepTeal : colors.border, backgroundColor: accepted ? colors.deepTeal : 'transparent' }]}>{accepted ? <AppText variant="small" color="#FFFFFF">✓</AppText> : null}</View>
        <AppText variant="small" style={{ flex: 1 }}>Li e aceito os Termos de Uso e a Política de Privacidade.</AppText>
      </Pressable>
      {!session ? <AppText variant="small" color={colors.error}>Sua sessão não está ativa. Entre novamente para continuar.</AppText> : null}
      {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
      <ActionButton title="Aceitar e continuar" onPress={handleAccept} loading={loading} disabled={!accepted || !profile || !session} />
      {!session ? <ActionButton title="Voltar ao login" variant="outline" onPress={() => router.replace('/login')} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  acceptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
