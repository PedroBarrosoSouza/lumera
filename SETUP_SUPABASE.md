# Guia Rápido: Ativar Banco na Nuvem (Supabase + Vercel) — Lumera

Com o Supabase conectado, **Pedro**, **Sabrina** e qualquer usuário criado no Painel Administrativo do **Lumera** compartilham a **base acumulativa de produtos** e têm seus próprios **planos, áreas de aplicação, calendários e históricos** sincronizados na nuvem.

## 1. Conectar o Supabase ao Vercel (Marketplace ou Manual)

### Opção A — Pelo Vercel Marketplace ("Supabase for Vercel")
1. No painel do seu projeto no Vercel, acesse **Integrations** (ou **Marketplace → Supabase**) e conecte um banco Supabase ao projeto `lumera`.
2. A integração cria automaticamente as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `PUBLISHABLE_KEY`), já compatíveis com o build deste projeto.

### Opção B — Manual (variáveis `VITE_`)
1. No Supabase (**Project Settings → API**), copie **Project URL** e **anon / public key**.
2. No Vercel (**Settings → Environment Variables**), adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## 2. Executar o Script SQL no Supabase (Obrigatório!)
Mesmo após conectar pelo Vercel Marketplace, é preciso criar as tabelas, a base acumulativa global de produtos e os usuários iniciais (`pedro` e `sabrina`):

1. Abra o painel do seu projeto no **Supabase** (pode clicar em *Open in Supabase* direto pelo Vercel).
2. No menu lateral esquerdo, clique em **SQL Editor** → **New query**.
3. Copie **todo o conteúdo** de [`supabase/schema.sql`](./supabase/schema.sql), cole no editor e clique em **Run** (`Ctrl + Enter`).
4. Isso cria de forma idempotente:
   - `app_users` e `app_sessions` (com `pedro` / `123` admin e `sabrina` / `123`);
   - `catalog_products` (base acumulativa global sem duplicação, já populada com os itens iniciais);
   - Todas as funções RPC protegidas por RLS e hash bcrypt.

## 3. Fazer Redeploy no Vercel
Após rodar o `schema.sql` e subir este código atualizado para o repositório conectado ao Vercel (ou clicar em **Deployments → Redeploy**), o app já entra conectado na nuvem mostrando **"Nuvem"** no topo.
