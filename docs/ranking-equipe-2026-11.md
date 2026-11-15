# Disputa da equipe — 2026-11

## Investigação

1. A tabela de usuários é `public.profiles`, ligada a `auth.users`. Ela guarda identidade, papel, atividade, preferências de jornada e aceite de termos. A Home lê o perfil pelo `services/auth-service.ts`; Configurações atualiza preferências; a tela Admin lista perfis e a Edge Function `admin-create-user` cria contas.
2. Não existe tabela ou conceito de Contatos/equipe no projeto Olha o Ponto. O ranking adiciona somente metadados de participação em `profiles`; batidas e peças continuam nas tabelas existentes.
3. Não existe chat institucional neste app. A única criação automática relacionada ao jogo é feita em `services/journey-service.ts` por `awardPieceForEntry`, quando uma batida válida recebe uma peça.
4. Não existe uma tabela/coluna de permissões por item de menu. A navegação atual é fixa em Expo Router; por isso “Contatos” e uma permissão de menu não fazem parte deste produto.

## Implementado no código

- Cenários flat pastel determinísticos em `assets/mapa/`, com gerador em `scripts/gerar-cenarios/generate.mjs`.
- Cenário Praia do anexo copiado sem reconversão; SHA-256 validado: `dc94ca03c32e5a41a8f966a11345af35164833abe42c9eacdb01f85a60c1ebd8`.
- Ranking opt-in com abas Semana/Geral, cache offline, card abaixo da jornada, configuração de apelido e texto de privacidade.
- Migration proposta em `supabase/migrations/20261114100000_ranking_equipe.sql`; não aplicada.
- Fluxo de criação de usuário preparado para herdar `equipe_id`; Edge Function não publicada.
- Exportação JSON inclui o estado de participação do próprio usuário.

## Banco e impacto

A migration adiciona quatro colunas em `profiles`, um índice único condicionado, backfill seguro quando existe exatamente um administrador ativo e a função `SECURITY DEFINER ranking_equipe`. Não altera RLS de `time_entries` ou `jornada_pecas`. Se houver mais de um administrador ativo, ela interrompe antes do backfill para exigir decisão manual.

## Rollback

O SQL comentado ao final da migration revoga a função, remove índice e colunas. Antes de executar rollback, remova o card/serviço se a versão publicada ainda depender das colunas.

## Validação local

- `sha256sum assets/mapa/cenario2.webp` validado contra o anexo.
- Três arquivos são WebP 1080×1920 e cada um tem menos de 300 KB.
- Testes unitários de ordenação/desempate em `tests/ranking.test.ts`.
- Não testado em aparelho Android nesta etapa.

## Fase 2 — somente TODO

- Sequência de dias com quatro batidas no horário.
- Selos mensais.
- Desafio coletivo que libera cenário/mascote.
- Notificação opcional quando um colega ultrapassar a posição.
