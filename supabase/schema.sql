-- ============================================================================
-- Lumera Skincare • Multi-usuário + Base Acumulativa Global de Produtos
-- Execute este arquivo completo no SQL Editor do seu projeto Supabase.
-- Ele é idempotente: pode ser executado novamente sem apagar usuários ou dados.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabelas principais
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  plan_json jsonb,
  settings_json jsonb,
  completions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Base acumulativa global de produtos (compartilhada entre todos os usuários)
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id text PRIMARY KEY,
  brand text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  normalized_key text NOT NULL UNIQUE,
  bottle_label text NOT NULL DEFAULT 'Item da rotina',
  bottle_color text NOT NULL DEFAULT '#2E9E60',
  usage_official text NOT NULL,
  precautions text NOT NULL DEFAULT '',
  quantity text NOT NULL DEFAULT 'Quantidade indicada',
  default_focus text NOT NULL DEFAULT 'Cuidado facial diário.',
  is_acid boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON public.app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON public.app_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_catalog_products_brand_name ON public.catalog_products(brand, name);

-- 2. Ativa Row Level Security sem policies públicas (todo acesso passa pelas RPCs SECURITY DEFINER)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

-- Helper interno para montar retorno público do usuário (sem password_hash)
CREATE OR REPLACE FUNCTION public._skincare_user_payload(u public.app_users)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'displayName', u.display_name,
    'role', u.role,
    'plan', u.plan_json,
    'settings', u.settings_json,
    'completions', u.completions_json
  );
$$;

-- Helper interno para montar retorno de produto do catálogo global
CREATE OR REPLACE FUNCTION public._skincare_catalog_payload(c public.catalog_products)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'brand', c.brand,
    'name', c.name,
    'shortName', c.short_name,
    'normalizedKey', c.normalized_key,
    'bottleLabel', c.bottle_label,
    'bottleColor', c.bottle_color,
    'usageOfficial', c.usage_official,
    'precautions', c.precautions,
    'quantity', c.quantity,
    'defaultFocus', c.default_focus,
    'isAcid', c.is_acid
  );
$$;

-- 3. RPC: Login por usuário e senha
CREATE OR REPLACE FUNCTION public.skincare_login(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.app_users;
  v_token uuid;
  v_norm_username text := lower(trim(coalesce(p_username, '')));
BEGIN
  IF v_norm_username = '' OR coalesce(p_password, '') = '' THEN
    RAISE EXCEPTION 'Informe usuário e senha.';
  END IF;

  SELECT * INTO v_user
  FROM public.app_users
  WHERE username = v_norm_username;

  IF NOT FOUND OR v_user.password_hash <> crypt(p_password, v_user.password_hash) THEN
    RAISE EXCEPTION 'Usuário ou senha inválidos.';
  END IF;

  DELETE FROM public.app_sessions
  WHERE user_id = v_user.id AND expires_at < now();

  INSERT INTO public.app_sessions (user_id, expires_at)
  VALUES (v_user.id, now() + interval '365 days')
  RETURNING token INTO v_token;

  RETURN jsonb_build_object(
    'token', v_token,
    'user', public._skincare_user_payload(v_user)
  );
END;
$$;

-- 4. RPC: Restaurar sessão a partir do token
CREATE OR REPLACE FUNCTION public.skincare_get_session(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.app_users;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT u.* INTO v_user
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.token = p_token
    AND s.expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.app_sessions
  SET expires_at = now() + interval '365 days'
  WHERE token = p_token;

  RETURN public._skincare_user_payload(v_user);
END;
$$;

-- 5. RPC: Logout
CREATE OR REPLACE FUNCTION public.skincare_logout(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_token IS NOT NULL THEN
    DELETE FROM public.app_sessions WHERE token = p_token;
  END IF;
END;
$$;

-- 6. RPC: Salvar plano, configurações e checks do usuário logado
CREATE OR REPLACE FUNCTION public.skincare_save_user_data(
  p_token uuid,
  p_plan jsonb,
  p_settings jsonb,
  p_completions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_sessions
  WHERE token = p_token AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  UPDATE public.app_users
  SET
    plan_json = p_plan,
    settings_json = p_settings,
    completions_json = coalesce(p_completions, '{}'::jsonb),
    updated_at = now()
  WHERE id = v_user_id;
END;
$$;

-- 7. RPC: Alterar própria senha
CREATE OR REPLACE FUNCTION public.skincare_change_password(
  p_token uuid,
  p_current_password text,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.app_users;
BEGIN
  SELECT u.* INTO v_user
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  IF v_user.password_hash <> crypt(coalesce(p_current_password, ''), v_user.password_hash) THEN
    RAISE EXCEPTION 'Senha atual incorreta.';
  END IF;

  IF length(trim(coalesce(p_new_password, ''))) < 3 THEN
    RAISE EXCEPTION 'A nova senha deve ter pelo menos 3 caracteres.';
  END IF;

  UPDATE public.app_users
  SET
    password_hash = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = v_user.id;
END;
$$;

-- 8. RPC Catálogo Global: Listar todos os produtos da base acumulativa
CREATE OR REPLACE FUNCTION public.skincare_list_catalog(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_sessions
  WHERE token = p_token AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  SELECT coalesce(
    jsonb_agg(public._skincare_catalog_payload(c) ORDER BY lower(c.brand), lower(c.name)),
    '[]'::jsonb
  ) INTO v_result
  FROM public.catalog_products c;

  RETURN v_result;
END;
$$;

-- 9. RPC Catálogo Global: Inserir produtos inéditos ou reutilizar existentes (sem duplicar)
CREATE OR REPLACE FUNCTION public.skincare_upsert_catalog_products(
  p_token uuid,
  p_products jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_item jsonb;
  v_existing public.catalog_products;
  v_req_id text;
  v_brand text;
  v_name text;
  v_norm_key text;
  v_new_id text;
  v_suffix int;
  v_results jsonb := '[]'::jsonb;
  v_catalog jsonb;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_sessions
  WHERE token = p_token AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  IF p_products IS NOT NULL AND jsonb_typeof(p_products) = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_products)
    LOOP
      v_req_id := trim(coalesce(v_item->>'id', ''));
      v_brand := trim(coalesce(v_item->>'brand', ''));
      v_name := trim(coalesce(v_item->>'name', ''));
      v_norm_key := trim(coalesce(v_item->>'normalizedKey', ''));

      IF v_norm_key = '' THEN
        v_norm_key := lower(regexp_replace(v_brand || '::' || v_name, '\s+', ' ', 'g'));
      END IF;

      -- Busca primeiro por id exato ou normalized_key (marca + nome)
      SELECT * INTO v_existing
      FROM public.catalog_products
      WHERE (v_req_id <> '' AND id = v_req_id)
         OR normalized_key = v_norm_key
      LIMIT 1;

      IF FOUND THEN
        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'requestedId', v_req_id,
            'canonicalId', v_existing.id,
            'reused', true,
            'product', public._skincare_catalog_payload(v_existing)
          )
        );
      ELSE
        IF v_brand = '' OR v_name = '' OR trim(coalesce(v_item->>'usageOfficial', '')) = '' THEN
          RAISE EXCEPTION 'Todo novo produto na base precisa de marca, nome e modo de uso.';
        END IF;

        v_new_id := CASE WHEN v_req_id <> '' THEN v_req_id ELSE lower(regexp_replace(v_brand || '-' || v_name, '[^a-zA-Z0-9]+', '-', 'g')) END;
        v_new_id := trim(both '-' from v_new_id);
        IF v_new_id = '' THEN
          v_new_id := 'produto';
        END IF;

        v_suffix := 2;
        WHILE EXISTS (SELECT 1 FROM public.catalog_products WHERE id = v_new_id) LOOP
          v_new_id := v_new_id || '-' || v_suffix::text;
          v_suffix := v_suffix + 1;
        END LOOP;

        INSERT INTO public.catalog_products (
          id,
          brand,
          name,
          short_name,
          normalized_key,
          bottle_label,
          bottle_color,
          usage_official,
          precautions,
          quantity,
          default_focus,
          is_acid,
          created_by
        )
        VALUES (
          v_new_id,
          v_brand,
          v_name,
          coalesce(nullif(trim(v_item->>'shortName'), ''), v_name),
          v_norm_key,
          coalesce(nullif(trim(v_item->>'bottleLabel'), ''), 'Item da rotina'),
          coalesce(nullif(trim(v_item->>'bottleColor'), ''), '#2E9E60'),
          trim(v_item->>'usageOfficial'),
          coalesce(trim(v_item->>'precautions'), ''),
          coalesce(nullif(trim(v_item->>'quantity'), ''), 'Quantidade indicada'),
          coalesce(nullif(trim(v_item->>'defaultFocus'), ''), 'Cuidado facial diário.'),
          coalesce((v_item->>'isAcid')::boolean, false),
          v_user_id
        )
        RETURNING * INTO v_existing;

        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'requestedId', v_req_id,
            'canonicalId', v_existing.id,
            'reused', false,
            'product', public._skincare_catalog_payload(v_existing)
          )
        );
      END IF;
    END LOOP;
  END IF;

  SELECT coalesce(
    jsonb_agg(public._skincare_catalog_payload(c) ORDER BY lower(c.brand), lower(c.name)),
    '[]'::jsonb
  ) INTO v_catalog
  FROM public.catalog_products c;

  RETURN jsonb_build_object(
    'catalog', v_catalog,
    'results', v_results
  );
END;
$$;

-- 10. RPC Catálogo Global: Atualizar informações globais de um produto existente
CREATE OR REPLACE FUNCTION public.skincare_update_catalog_product(
  p_token uuid,
  p_product jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_id text := trim(coalesce(p_product->>'id', ''));
  v_brand text := trim(coalesce(p_product->>'brand', ''));
  v_name text := trim(coalesce(p_product->>'name', ''));
  v_norm_key text := trim(coalesce(p_product->>'normalizedKey', ''));
  v_catalog jsonb;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_sessions
  WHERE token = p_token AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  IF v_id = '' OR v_brand = '' OR v_name = '' THEN
    RAISE EXCEPTION 'ID, marca e nome são obrigatórios.';
  END IF;

  IF v_norm_key = '' THEN
    v_norm_key := lower(regexp_replace(v_brand || '::' || v_name, '\s+', ' ', 'g'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_products
    WHERE normalized_key = v_norm_key AND id <> v_id
  ) THEN
    RAISE EXCEPTION 'Já existe outro produto cadastrado com esta mesma marca e nome.';
  END IF;

  UPDATE public.catalog_products
  SET
    brand = v_brand,
    name = v_name,
    short_name = coalesce(nullif(trim(p_product->>'shortName'), ''), v_name),
    normalized_key = v_norm_key,
    bottle_label = coalesce(nullif(trim(p_product->>'bottleLabel'), ''), bottle_label),
    bottle_color = coalesce(nullif(trim(p_product->>'bottleColor'), ''), bottle_color),
    usage_official = coalesce(nullif(trim(p_product->>'usageOfficial'), ''), usage_official),
    precautions = coalesce(trim(p_product->>'precautions'), precautions),
    quantity = coalesce(nullif(trim(p_product->>'quantity'), ''), quantity),
    default_focus = coalesce(nullif(trim(p_product->>'defaultFocus'), ''), default_focus),
    is_acid = coalesce((p_product->>'isAcid')::boolean, is_acid),
    updated_at = now()
  WHERE id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado na base global.';
  END IF;

  SELECT coalesce(
    jsonb_agg(public._skincare_catalog_payload(c) ORDER BY lower(c.brand), lower(c.name)),
    '[]'::jsonb
  ) INTO v_catalog
  FROM public.catalog_products c;

  RETURN v_catalog;
END;
$$;

-- 11. RPC Admin: Listar usuários
CREATE OR REPLACE FUNCTION public.skincare_admin_list_users(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.app_users;
  v_result jsonb;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();

  IF NOT FOUND OR v_admin.role <> 'admin' THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'displayName', u.display_name,
        'role', u.role,
        'createdAt', u.created_at,
        'updatedAt', u.updated_at
      )
      ORDER BY (u.role = 'admin') DESC, u.created_at ASC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM public.app_users u;

  RETURN v_result;
END;
$$;

-- 12. RPC Admin: Criar usuário
CREATE OR REPLACE FUNCTION public.skincare_admin_create_user(
  p_token uuid,
  p_username text,
  p_display_name text,
  p_password text,
  p_role text DEFAULT 'user',
  p_initial_plan jsonb DEFAULT NULL,
  p_initial_settings jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.app_users;
  v_norm_username text := lower(trim(coalesce(p_username, '')));
  v_clean_name text := trim(coalesce(p_display_name, ''));
  v_clean_role text := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'user' END;
  v_created public.app_users;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();

  IF NOT FOUND OR v_admin.role <> 'admin' THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  IF v_norm_username !~ '^[a-z0-9_.-]{2,32}$' THEN
    RAISE EXCEPTION 'Usuário deve ter entre 2 e 32 caracteres (letras minúsculas, números, ., _ ou -).';
  END IF;

  IF v_clean_name = '' THEN
    v_clean_name := initcap(v_norm_username);
  END IF;

  IF length(trim(coalesce(p_password, ''))) < 3 THEN
    RAISE EXCEPTION 'A senha inicial deve ter pelo menos 3 caracteres.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.app_users WHERE username = v_norm_username) THEN
    RAISE EXCEPTION 'Já existe um usuário com esse login.';
  END IF;

  INSERT INTO public.app_users (
    username,
    display_name,
    password_hash,
    role,
    plan_json,
    settings_json
  )
  VALUES (
    v_norm_username,
    v_clean_name,
    crypt(p_password, gen_salt('bf')),
    v_clean_role,
    p_initial_plan,
    p_initial_settings
  )
  RETURNING * INTO v_created;

  RETURN jsonb_build_object(
    'id', v_created.id,
    'username', v_created.username,
    'displayName', v_created.display_name,
    'role', v_created.role,
    'createdAt', v_created.created_at,
    'updatedAt', v_created.updated_at
  );
END;
$$;

-- 13. RPC Admin: Redefinir senha de outro usuário
CREATE OR REPLACE FUNCTION public.skincare_admin_reset_password(
  p_token uuid,
  p_target_user_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.app_users;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();

  IF NOT FOUND OR v_admin.role <> 'admin' THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  IF length(trim(coalesce(p_new_password, ''))) < 3 THEN
    RAISE EXCEPTION 'A nova senha deve ter pelo menos 3 caracteres.';
  END IF;

  UPDATE public.app_users
  SET
    password_hash = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  DELETE FROM public.app_sessions WHERE user_id = p_target_user_id;
END;
$$;

-- 14. RPC Admin: Excluir usuário
CREATE OR REPLACE FUNCTION public.skincare_admin_delete_user(
  p_token uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.app_users;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();

  IF NOT FOUND OR v_admin.role <> 'admin' THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  IF p_target_user_id = v_admin.id THEN
    RAISE EXCEPTION 'Você não pode excluir a própria conta de administrador.';
  END IF;

  DELETE FROM public.app_users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
END;
$$;

-- 15. Permissões de execução das RPCs para o client web (anon / authenticated)
GRANT EXECUTE ON FUNCTION public.skincare_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_get_session(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_logout(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_save_user_data(uuid, jsonb, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_change_password(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_list_catalog(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_upsert_catalog_products(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_update_catalog_product(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_admin_list_users(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_admin_create_user(uuid, text, text, text, text, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_admin_reset_password(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skincare_admin_delete_user(uuid, uuid) TO anon, authenticated;

-- 16. Usuários iniciais: Pedro (Admin, senha 123) e Sabrina (Usuária, senha 123)
INSERT INTO public.app_users (username, display_name, password_hash, role)
VALUES
  ('pedro', 'Pedro', crypt('123', gen_salt('bf')), 'admin'),
  ('sabrina', 'Sabrina', crypt('123', gen_salt('bf')), 'user')
ON CONFLICT (username) DO NOTHING;

-- 17. Seed inicial da Base Acumulativa Global de Produtos
INSERT INTO public.catalog_products (
  id, brand, name, short_name, normalized_key, bottle_label, bottle_color,
  usage_official, precautions, quantity, default_focus, is_acid
)
VALUES
  (
    'emulsao-limpeza',
    'Creamy',
    'Emulsão de Limpeza',
    'Emulsão de Limpeza',
    'creamy::emulsao de limpeza',
    'Frasco rosa claro, 200ml',
    '#F4A7B9',
    'Aplique 1 pump sobre a pele úmida do rosto e pescoço, massageie até formar espuma leve e enxágue em seguida.',
    'Evite contato direto com os olhos abertos; em caso de ardência, enxágue com água abundante.',
    '1 pump',
    'Limpeza suave sem ressecar ou agredir a pele normal.',
    false
  ),
  (
    'eye-cream',
    'Creamy',
    'Eye Cream',
    'Eye Cream',
    'creamy::eye cream',
    'Frasco cinza, 15g',
    '#8B929E',
    'Com a pele limpa e seca, aplique uma pequena quantidade ao redor do contorno dos olhos (região óssea) com leves batidinhas usando o dedo anelar, sem puxar a pele. Aguarde secar.',
    'Evite a linha dos cílios e o contato direto dentro dos olhos. Não esfregue a pálpebra.',
    'Pequena quantidade',
    'Clareamento de olheiras, firmeza e hidratação dos olhos.',
    false
  ),
  (
    'acido-tranexamico',
    'Creamy',
    'Solução Clareadora Ácido Tranexâmico',
    'Ácido Tranexâmico',
    'creamy::solucao clareadora acido tranexamico',
    'Frasco verde, 90ml',
    '#2E9E60',
    'Com a pele limpa e seca, aplique de 5 a 10 gotas nas mãos e espalhe suavemente. Aguarde absorver completamente antes do próximo passo.',
    'Contém ácido glicólico na fórmula: usar protetor solar pela manhã. Na depilação a laser, pausar 7 a 14 dias antes e 5 a 7 dias depois na área disparada (pode manter no nariz e olhos).',
    '5 a 10 gotas',
    'Clareamento de manchas e uniformização do tom.',
    true
  ),
  (
    'serum-hidratante',
    'Creamy',
    'Sérum Hidratante',
    'Sérum Hidratante',
    'creamy::serum hidratante',
    'Bisnaga azul-água, 30ml',
    '#38BDF8',
    'Coloque algumas gotas sobre a pele limpa e espalhe suavemente. Aguarde secar antes de aplicar o protetor solar ou outro creme.',
    'Evite contato direto com os olhos. Uso externo.',
    'Algumas gotas',
    'Hidratação profunda e leve em camadas, sem pesar ou entupir poros.',
    false
  ),
  (
    'calming-cream',
    'Creamy',
    'Calming Cream',
    'Calming Cream',
    'creamy::calming cream',
    'Bisnaga vermelha, 40g',
    '#EF4444',
    'Espalhe uma camada fina e uniforme. Quando usado antes dos ácidos noturnos, aguarde cerca de 15 minutos para absorção completa.',
    'Uso externo. Aguardar absorção completa antes de aplicar ácidos sobre ele para evitar ardência.',
    'Camada fina e uniforme',
    'Acalma a pele, reforça a barreira e reduz ardência dos ácidos.',
    false
  ),
  (
    'acido-mandelico',
    'Creamy',
    'Gel 7% AHA Ácido Mandélico',
    'Ácido Mandélico 7%',
    'creamy::gel 7% aha acido mandelico',
    'Frasco pink, 30g',
    '#EC4899',
    'Uso exclusivo noturno. Com a pele limpa, seca e previamente hidratada com Calming Cream, aplique de 1 a 2 pumps espalhando suavemente.',
    'Uso exclusivo noturno. Evite contorno dos olhos, cantos do nariz e boca. Obrigatório protetor solar de manhã. Suspenda 7 a 14 dias antes e 5 a 7 dias depois do laser na área tratada.',
    '1 a 2 pumps',
    'Combate espinhas ativas, regula oleosidade e clareia manchas sem irritar.',
    true
  ),
  (
    'acido-glicolico',
    'Creamy',
    'Creme 10% AHA Ácido Glicólico',
    'Ácido Glicólico 10%',
    'creamy::creme 10% aha acido glicolico',
    'Frasco azul, 30g',
    '#2563EB',
    'Uso exclusivo noturno. Sobre a pele hidratada (após Calming Cream) e bem seca, aplique pequena quantidade espalhando suavemente.',
    'Uso exclusivo noturno. Evite pálpebras e mucosas. Não aplicar em pele úmida ou sensibilizada. Suspenda 7 a 14 dias antes e 5 a 7 dias depois do laser na área tratada.',
    'Pequena quantidade',
    'Esfoliação química para cravos e textura irregular.',
    true
  ),
  (
    'protetor-solar',
    'Uso Diário',
    'Protetor Solar Facial',
    'Protetor Solar Facial',
    'uso diario::protetor solar facial',
    'Item complementar obrigatório',
    '#F59E0B',
    'Aplique quantidade generosa (regra dos dois dedos) como último passo da manhã, mesmo em dias nublados ou ambientes fechados.',
    'Reaplicar ao longo do dia em caso de exposição solar direta, suor intenso ou contato com água.',
    'Regra dos dois dedos',
    'Impede que o sol escureça as manchas durante o uso de ácidos.',
    false
  ),
  (
    'gel-limpeza',
    'Uso Diário',
    'Gel de Limpeza Facial',
    'Limpeza Facial',
    'uso diario::gel de limpeza facial',
    'Limpeza diária',
    '#38BDF8',
    'Aplique pequena quantidade na pele úmida, massageie suavemente e enxágue completamente.',
    'Evite contato direto com os olhos. Não esfregue com força para não agredir a barreira cutânea.',
    '1 pump ou moeda pequena',
    'Remover impurezas e oleosidade sem ressecar a pele.',
    false
  ),
  (
    'hidratante-facial',
    'Uso Diário',
    'Hidratante Facial',
    'Hidratante',
    'uso diario::hidratante facial',
    'Hidratação diária',
    '#2E9E60',
    'Espalhe uma camada uniforme após a limpeza e aguarde absorver antes do protetor solar.',
    'Uso externo. Evite área interna dos olhos.',
    'Camada fina',
    'Manter a barreira cutânea saudável e hidratada.',
    false
  )
ON CONFLICT (id) DO NOTHING;
