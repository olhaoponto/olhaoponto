

## Correções após teste offline e mapa de boas práticas — 10 de novembro de 2026

A rodada corrige o agendamento local do retorno do almoço: depois de cada batida, a tela Hoje recalcula e agenda a notificação diretamente no aparelho, sem depender da sincronização com o Supabase. A agenda local continua sendo cancelada/recriada para evitar duplicidade.

O e-mail salvo atualiza Auth e `profiles` no mesmo fluxo, mantendo a confirmação exigida pelo Supabase. Convites de almoço e lembretes agora podem ser cancelados pelo remetente enquanto aguardam resposta, com estado preservado no histórico e RLS aditiva.

O cronômetro passa a considerar a jornada prevista do dia: segunda a quinta 08:00–18:00 com uma hora de almoço resulta em 9 horas trabalhadas; sexta 08:00–17:00 resulta em 8 horas. Oito horas não aparecem mais como hora extra de segunda a quinta.

O mapa foi simplificado para cinco fases claramente espaçadas, sem estrada colorida embolada. Ao avançar, abre uma recompensa interativa: o usuário arrasta a peça para o encaixe do quebra-cabeça. A abertura alterna cenário, ícone, cor de fundo e movimento conforme o recado do mascote.
