import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, TextField, useAppColors } from '@/components/ui';

const DEFAULT_APP_LINK = 'https://expo.dev/accounts/edingtonmaquine/projects/olhonoponto/builds';

export function AppDownloadShareCard() {
  const colors = useAppColors();
  const [link, setLink] = useState(DEFAULT_APP_LINK);
  const [error, setError] = useState('');
  const [shared, setShared] = useState(false);

  const shareLink = async () => {
    const value = link.trim();
    let parsed: URL;
    try { parsed = new URL(value); }
    catch { setError('Cole um link HTTPS válido para o aplicativo.'); return; }
    if (parsed.protocol !== 'https:') { setError('Use um link seguro que comece com https://.'); return; }
    const message = `Baixe o Olha o Ponto pelo link: ${value}\n\nPara usar o sistema, solicite acesso ao administrador do sistema.`;
    setError(''); setShared(false);
    try {
      await Share.share({ title: 'Instale o Olha o Ponto', message });
      setShared(true);
    } catch { setError('Não foi possível abrir o menu de compartilhamento neste aparelho.'); }
  };

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.heading}><MaterialCommunityIcons name="share-variant-outline" size={24} color={colors.deepTeal} /><View style={{ flex: 1, gap: 4 }}><AppText variant="subtitle">Compartilhar o aplicativo</AppText><AppText variant="small" color={colors.muted}>Edite ou copie o link para enviar por WhatsApp ou outro aplicativo.</AppText></View></View>
      <TextField label="Link de instalação / página de builds" value={link} onChangeText={(value) => { setLink(value); setError(''); setShared(false); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" multiline numberOfLines={2} style={styles.linkField} accessibilityLabel="Link do aplicativo para copiar ou compartilhar" />
      <AppText variant="tiny" color={colors.muted}>A pessoa deverá solicitar liberação ao administrador para acessar o sistema.</AppText>
      {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
      {shared ? <AppText variant="small" color={colors.deepTeal}>Menu de compartilhamento aberto.</AppText> : null}
      <ActionButton title="Compartilhar link" onPress={() => void shareLink()} icon={<MaterialCommunityIcons name="share-variant" size={19} color="#FFFFFF" />} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  linkField: { minHeight: 64, textAlignVertical: 'top' },
});
