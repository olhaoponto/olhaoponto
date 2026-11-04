import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, PageHeading, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';

export default function AboutScreen() {
  const colors = useAppColors();
  const router = useRouter();
  return (
    <ScreenShell contentStyle={{ gap: 16, paddingTop: 20 }}>
      <PageHeading eyebrow="Olha o Ponto" title="Sobre o aplicativo" subtitle="Uma ajuda amigável para acompanhar sua jornada." right={<MaterialCommunityIcons name="clock-time-four-outline" size={28} color={colors.deepTeal} />} />
      <SurfaceCard>
        <AppText variant="subtitle">Por que este app existe</AppText>
        <AppText variant="body">Aplicativo criado por Marcos Edington, com o objetivo de alertar o usuário para não passar do limite de 10:00 horas trabalhadas.</AppText>
      </SurfaceCard>
      <SurfaceCard tone="soft">
        <AppText variant="subtitle">Entenda o limite em linguagem simples</AppText>
        <AppText variant="body">A jornada padrão é comumente apresentada como 8 horas normais, com possibilidade de até 2 horas extras por dia nos termos do Art. 59 da CLT. Por isso, o limite usado como referência no app é de 10:00 horas efetivamente trabalhadas. O intervalo de almoço não entra nessa soma.</AppText>
        <AppText variant="small" color={colors.muted}>Você pode escolher um limite pessoal menor no Perfil. O aplicativo nunca permite configurar mais de 10:00.</AppText>
      </SurfaceCard>
      <SurfaceCard>
        <AppText variant="subtitle">Importante</AppText>
        <AppText variant="body">Este conteúdo é apenas informativo, não é orientação jurídica e não avalia regras coletivas, escalas especiais ou um caso concreto. O app é um controle pessoal e não substitui o registro oficial da empresa. Se tiver dúvidas sobre sua jornada, converse com o empregador ou procure profissional qualificado.</AppText>
      </SurfaceCard>
      <SurfaceCard style={{ alignItems: 'center', gap: 5 }}><AppText variant="tiny" color={colors.muted}>VERSÃO</AppText><AppText variant="subtitle">1.0.0</AppText><AppText variant="tiny" color={colors.muted}>Dados protegidos e acesso controlado.</AppText></SurfaceCard>
      <ActionButton title="Termos de uso e política de privacidade" variant="outline" onPress={() => router.push('/terms')} />
    </ScreenShell>
  );
}
