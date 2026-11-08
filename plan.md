

## Verificação antes da publicação — 8 de novembro de 2026

A migration local usa o mesmo número remoto aplicado (`20261108201303_admin_communications.sql` / `admin_communications`); o histórico remoto e as cinco tabelas RLS foram confirmados. A Edge Function `admin-session-control` está `ACTIVE` com `verify_jwt=true`. Antes de qualquer build, `pnpm check`, `pnpm lint`, `pnpm test` (97 aprovados, 1 legado ignorado) e `git diff --check` passaram. O bundle Android foi exportado sem bytecode em `/tmp`; o export padrão falhou somente porque o sandbox é ARM e o `hermesc` instalado é ELF x86_64. A conta Expo autenticada mostrou o projeto existente `@edingtonmaquine/olhonoponto` e como última build concluída a `1.0.1 (8)` do commit `94d979c`; nenhuma build desta implementação havia sido iniciada durante a inspeção.
