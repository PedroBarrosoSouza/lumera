import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildProductNormalizedKey,
  clonePlan,
  DEFAULT_CREAMY_PLAN,
  ensureNormalizedPlan,
  findExistingCatalogProduct,
  INITIAL_CATALOG_PRODUCTS,
  STARTER_SIMPLE_PLAN,
} from '../data/skincareData';
import type {
  AdminUserSummary,
  AppSettings,
  CatalogProduct,
  CatalogProductInput,
  CatalogUpsertResult,
  DayCompletion,
  SkincarePlan,
  UserProfile,
  UserRole,
  UserWorkspaceData,
} from '../types';
import { slugifyId } from '../utils/planImport';
import { getDefaultSettings, normalizeSettings } from '../utils/storage';

export interface LoginResponse {
  token: string;
  user: UserProfile;
  data: UserWorkspaceData;
}

export interface RestoreSessionResponse {
  user: UserProfile;
  data: UserWorkspaceData;
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  starterTemplate: 'creamy' | 'simple';
}

export interface BackendService {
  mode: 'supabase' | 'local';
  login(username: string, password: string): Promise<LoginResponse>;
  restoreSession(token: string): Promise<RestoreSessionResponse | null>;
  logout(token: string): Promise<void>;
  saveUserData(token: string, data: UserWorkspaceData): Promise<void>;
  changePassword(
    token: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void>;
  listCatalog(token: string): Promise<CatalogProduct[]>;
  upsertCatalogProducts(
    token: string,
    products: CatalogProductInput[],
  ): Promise<{ catalog: CatalogProduct[]; results: CatalogUpsertResult[] }>;
  updateCatalogProduct(
    token: string,
    product: CatalogProductInput,
  ): Promise<CatalogProduct[]>;
  adminListUsers(token: string): Promise<AdminUserSummary[]>;
  adminCreateUser(
    token: string,
    input: CreateUserInput,
  ): Promise<AdminUserSummary>;
  adminResetPassword(
    token: string,
    targetUserId: string,
    newPassword: string,
  ): Promise<void>;
  adminDeleteUser(token: string, targetUserId: string): Promise<void>;
}

const LOCAL_DB_KEY = 'creamy-multiuser-db-v3';

interface RawRpcUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  plan?: SkincarePlan | null;
  settings?: Partial<AppSettings> | null;
  completions?: Record<string, DayCompletion> | null;
}

function hydrateWorkspaceData(
  raw: RawRpcUser,
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): UserWorkspaceData {
  const rawPlan = raw.plan;
  const hasSteps =
    rawPlan &&
    ((Array.isArray(rawPlan.morningSteps) && rawPlan.morningSteps.length > 0) ||
      (Array.isArray(rawPlan.nightRoutines) && rawPlan.nightRoutines.length > 0) ||
      Boolean(rawPlan.userProducts && Object.keys(rawPlan.userProducts).length > 0) ||
      Boolean(rawPlan.products && rawPlan.products.length > 0));

  return {
    plan: hasSteps
      ? ensureNormalizedPlan(rawPlan!, catalog)
      : clonePlan(DEFAULT_CREAMY_PLAN),
    settings: normalizeSettings(raw.settings),
    completions: raw.completions ?? {},
  };
}

function normalizeCatalogInput(input: CatalogProductInput): CatalogProduct {
  const brand = input.brand.trim();
  const name = input.name.trim();
  return {
    id: input.id.trim() || slugifyId(`${brand}-${name}`, 'produto'),
    brand,
    name,
    shortName: input.shortName.trim() || name,
    normalizedKey:
      input.normalizedKey?.trim() || buildProductNormalizedKey(brand, name),
    bottleLabel: input.bottleLabel.trim() || 'Item da rotina',
    bottleColor: input.bottleColor.trim() || '#2E9E60',
    usageOfficial: input.usageOfficial.trim(),
    precautions: input.precautions.trim(),
    quantity: input.quantity.trim() || 'Quantidade indicada',
    defaultFocus: input.defaultFocus.trim() || 'Cuidado facial diário.',
    isAcid: Boolean(input.isAcid),
  };
}

function createSupabaseBackend(client: SupabaseClient): BackendService {
  return {
    mode: 'supabase',

    async login(username, password) {
      const { data, error } = await client.rpc('skincare_login', {
        p_username: username,
        p_password: password,
      });
      if (error) throw new Error(error.message);
      const payload = data as { token: string; user: RawRpcUser };
      return {
        token: payload.token,
        user: {
          id: payload.user.id,
          username: payload.user.username,
          displayName: payload.user.displayName,
          role: payload.user.role,
        },
        data: hydrateWorkspaceData(payload.user),
      };
    },

    async restoreSession(token) {
      const { data, error } = await client.rpc('skincare_get_session', {
        p_token: token,
      });
      if (error || !data) return null;
      const rawUser = data as RawRpcUser;
      return {
        user: {
          id: rawUser.id,
          username: rawUser.username,
          displayName: rawUser.displayName,
          role: rawUser.role,
        },
        data: hydrateWorkspaceData(rawUser),
      };
    },

    async logout(token) {
      await client.rpc('skincare_logout', { p_token: token });
    },

    async saveUserData(token, workspace) {
      const { error } = await client.rpc('skincare_save_user_data', {
        p_token: token,
        p_plan: workspace.plan,
        p_settings: workspace.settings,
        p_completions: workspace.completions,
      });
      if (error) throw new Error(error.message);
    },

    async changePassword(token, currentPassword, newPassword) {
      const { error } = await client.rpc('skincare_change_password', {
        p_token: token,
        p_current_password: currentPassword,
        p_new_password: newPassword,
      });
      if (error) throw new Error(error.message);
    },

    async listCatalog(token) {
      const { data, error } = await client.rpc('skincare_list_catalog', {
        p_token: token,
      });
      if (error) throw new Error(error.message);
      const list = (data as CatalogProduct[]) ?? [];
      return list.length > 0 ? list : [...INITIAL_CATALOG_PRODUCTS];
    },

    async upsertCatalogProducts(token, products) {
      const prepared = products.map(normalizeCatalogInput);
      const { data, error } = await client.rpc(
        'skincare_upsert_catalog_products',
        {
          p_token: token,
          p_products: prepared,
        },
      );
      if (error) throw new Error(error.message);
      return data as {
        catalog: CatalogProduct[];
        results: CatalogUpsertResult[];
      };
    },

    async updateCatalogProduct(token, product) {
      const prepared = normalizeCatalogInput(product);
      const { data, error } = await client.rpc(
        'skincare_update_catalog_product',
        {
          p_token: token,
          p_product: prepared,
        },
      );
      if (error) throw new Error(error.message);
      return (data as CatalogProduct[]) ?? [];
    },

    async adminListUsers(token) {
      const { data, error } = await client.rpc('skincare_admin_list_users', {
        p_token: token,
      });
      if (error) throw new Error(error.message);
      return (data as AdminUserSummary[]) ?? [];
    },

    async adminCreateUser(token, input) {
      const initialPlan =
        input.starterTemplate === 'creamy'
          ? clonePlan(DEFAULT_CREAMY_PLAN)
          : clonePlan(STARTER_SIMPLE_PLAN);

      const { data, error } = await client.rpc('skincare_admin_create_user', {
        p_token: token,
        p_username: input.username,
        p_display_name: input.displayName,
        p_password: input.password,
        p_role: input.role,
        p_initial_plan: initialPlan,
        p_initial_settings: getDefaultSettings(),
      });
      if (error) throw new Error(error.message);
      return data as AdminUserSummary;
    },

    async adminResetPassword(token, targetUserId, newPassword) {
      const { error } = await client.rpc('skincare_admin_reset_password', {
        p_token: token,
        p_target_user_id: targetUserId,
        p_new_password: newPassword,
      });
      if (error) throw new Error(error.message);
    },

    async adminDeleteUser(token, targetUserId) {
      const { error } = await client.rpc('skincare_admin_delete_user', {
        p_token: token,
        p_target_user_id: targetUserId,
      });
      if (error) throw new Error(error.message);
    },
  };
}

interface LocalStoredUser {
  id: string;
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  plan: SkincarePlan;
  settings: AppSettings;
  completions: Record<string, DayCompletion>;
  createdAt: string;
  updatedAt: string;
}

interface LocalDbSchema {
  users: LocalStoredUser[];
  sessions: Record<string, string>; // token -> userId
  catalog: CatalogProduct[];
}

export interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalDemoBackend(
  storage: SimpleStorage | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): BackendService {
  let memoryFallback: string | null = null;

  const readDb = (): LocalDbSchema => {
    const raw = storage ? storage.getItem(LOCAL_DB_KEY) : memoryFallback;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as LocalDbSchema;
        if (Array.isArray(parsed.users) && parsed.sessions) {
          return {
            users: parsed.users,
            sessions: parsed.sessions,
            catalog:
              Array.isArray(parsed.catalog) && parsed.catalog.length > 0
                ? parsed.catalog
                : [...INITIAL_CATALOG_PRODUCTS],
          };
        }
      } catch {
        // Re-seed below
      }
    }

    const nowIso = new Date().toISOString();
    const seeded: LocalDbSchema = {
      users: [
        {
          id: 'user-pedro',
          username: 'pedro',
          displayName: 'Pedro',
          password: '123',
          role: 'admin',
          plan: clonePlan(DEFAULT_CREAMY_PLAN),
          settings: getDefaultSettings(),
          completions: {},
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: 'user-sabrina',
          username: 'sabrina',
          displayName: 'Sabrina',
          password: '123',
          role: 'user',
          plan: clonePlan(DEFAULT_CREAMY_PLAN),
          settings: getDefaultSettings(),
          completions: {},
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      sessions: {},
      catalog: [...INITIAL_CATALOG_PRODUCTS],
    };
    writeDb(seeded);
    return seeded;
  };

  const writeDb = (db: LocalDbSchema) => {
    const serialized = JSON.stringify(db);
    if (storage) {
      storage.setItem(LOCAL_DB_KEY, serialized);
    } else {
      memoryFallback = serialized;
    }
  };

  const requireSessionUser = (
    db: LocalDbSchema,
    token: string,
  ): LocalStoredUser => {
    const userId = db.sessions[token];
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('Sessão inválida ou expirada.');
    return user;
  };

  const requireAdmin = (db: LocalDbSchema, token: string): LocalStoredUser => {
    const user = requireSessionUser(db, token);
    if (user.role !== 'admin') {
      throw new Error('Acesso restrito a administradores.');
    }
    return user;
  };

  const sortedCatalog = (catalog: CatalogProduct[]): CatalogProduct[] =>
    catalog
      .slice()
      .sort((a, b) =>
        `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, 'pt-BR'),
      );

  return {
    mode: 'local',

    async login(username, password) {
      const db = readDb();
      const norm = username.trim().toLowerCase();
      const user = db.users.find((u) => u.username === norm);
      if (!user || user.password !== password) {
        throw new Error('Usuário ou senha inválidos.');
      }
      const token = makeId();
      db.sessions[token] = user.id;
      writeDb(db);
      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
        data: {
          plan: ensureNormalizedPlan(clonePlan(user.plan), db.catalog),
          settings: normalizeSettings(user.settings),
          completions: { ...user.completions },
        },
      };
    },

    async restoreSession(token) {
      const db = readDb();
      const userId = db.sessions[token];
      const user = db.users.find((u) => u.id === userId);
      if (!user) return null;
      return {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
        data: {
          plan: ensureNormalizedPlan(clonePlan(user.plan), db.catalog),
          settings: normalizeSettings(user.settings),
          completions: { ...user.completions },
        },
      };
    },

    async logout(token) {
      const db = readDb();
      delete db.sessions[token];
      writeDb(db);
    },

    async saveUserData(token, workspace) {
      const db = readDb();
      const user = requireSessionUser(db, token);
      user.plan = ensureNormalizedPlan(clonePlan(workspace.plan), db.catalog);
      user.settings = normalizeSettings(workspace.settings);
      user.completions = { ...workspace.completions };
      user.updatedAt = new Date().toISOString();
      writeDb(db);
    },

    async changePassword(token, currentPassword, newPassword) {
      const db = readDb();
      const user = requireSessionUser(db, token);
      if (user.password !== currentPassword) {
        throw new Error('Senha atual incorreta.');
      }
      if (newPassword.trim().length < 3) {
        throw new Error('A nova senha deve ter pelo menos 3 caracteres.');
      }
      user.password = newPassword;
      user.updatedAt = new Date().toISOString();
      writeDb(db);
    },

    async listCatalog(token) {
      const db = readDb();
      requireSessionUser(db, token);
      return sortedCatalog(db.catalog);
    },

    async upsertCatalogProducts(token, products) {
      const db = readDb();
      requireSessionUser(db, token);
      const results: CatalogUpsertResult[] = [];

      for (const rawInput of products) {
        const normalized = normalizeCatalogInput(rawInput);
        const existing = findExistingCatalogProduct(db.catalog, {
          id: normalized.id,
          brand: normalized.brand,
          name: normalized.name,
          normalizedKey: normalized.normalizedKey,
        });

        if (existing) {
          results.push({
            requestedId: rawInput.id,
            canonicalId: existing.id,
            reused: true,
            product: existing,
          });
        } else {
          if (!normalized.brand || !normalized.name || !normalized.usageOfficial) {
            throw new Error(
              'Todo novo produto na base precisa de marca, nome e modo de uso.',
            );
          }

          let uniqueId = normalized.id;
          let suffix = 2;
          while (db.catalog.some((c) => c.id === uniqueId)) {
            uniqueId = `${normalized.id}-${suffix++}`;
          }

          const inserted: CatalogProduct = {
            ...normalized,
            id: uniqueId,
          };
          db.catalog.push(inserted);
          results.push({
            requestedId: rawInput.id,
            canonicalId: inserted.id,
            reused: false,
            product: inserted,
          });
        }
      }

      writeDb(db);
      return {
        catalog: sortedCatalog(db.catalog),
        results,
      };
    },

    async updateCatalogProduct(token, product) {
      const db = readDb();
      requireSessionUser(db, token);
      const normalized = normalizeCatalogInput(product);

      const conflict = db.catalog.find(
        (c) =>
          c.normalizedKey === normalized.normalizedKey &&
          c.id !== normalized.id,
      );
      if (conflict) {
        throw new Error(
          'Já existe outro produto cadastrado com esta mesma marca e nome.',
        );
      }

      const idx = db.catalog.findIndex((c) => c.id === normalized.id);
      if (idx === -1) {
        throw new Error('Produto não encontrado na base global.');
      }
      db.catalog[idx] = normalized;
      writeDb(db);
      return sortedCatalog(db.catalog);
    },

    async adminListUsers(token) {
      const db = readDb();
      requireAdmin(db, token);
      return db.users
        .slice()
        .sort((a, b) =>
          a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1,
        )
        .map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          role: u.role,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        }));
    },

    async adminCreateUser(token, input) {
      const db = readDb();
      requireAdmin(db, token);

      const normUsername = input.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{2,32}$/.test(normUsername)) {
        throw new Error(
          'Usuário deve ter entre 2 e 32 caracteres (letras minúsculas, números, ., _ ou -).',
        );
      }
      if (input.password.trim().length < 3) {
        throw new Error('A senha inicial deve ter pelo menos 3 caracteres.');
      }
      if (db.users.some((u) => u.username === normUsername)) {
        throw new Error('Já existe um usuário com esse login.');
      }

      const nowIso = new Date().toISOString();
      const newUser: LocalStoredUser = {
        id: makeId(),
        username: normUsername,
        displayName: input.displayName.trim() || normUsername,
        password: input.password,
        role: input.role,
        plan:
          input.starterTemplate === 'creamy'
            ? clonePlan(DEFAULT_CREAMY_PLAN)
            : clonePlan(STARTER_SIMPLE_PLAN),
        settings: getDefaultSettings(),
        completions: {},
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.users.push(newUser);
      writeDb(db);

      return {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      };
    },

    async adminResetPassword(token, targetUserId, newPassword) {
      const db = readDb();
      requireAdmin(db, token);
      if (newPassword.trim().length < 3) {
        throw new Error('A nova senha deve ter pelo menos 3 caracteres.');
      }
      const target = db.users.find((u) => u.id === targetUserId);
      if (!target) throw new Error('Usuário não encontrado.');
      target.password = newPassword;
      target.updatedAt = new Date().toISOString();
      for (const [sessTok, uid] of Object.entries(db.sessions)) {
        if (uid === targetUserId) delete db.sessions[sessTok];
      }
      writeDb(db);
    },

    async adminDeleteUser(token, targetUserId) {
      const db = readDb();
      const admin = requireAdmin(db, token);
      if (targetUserId === admin.id) {
        throw new Error(
          'Você não pode excluir a própria conta de administrador.',
        );
      }
      const before = db.users.length;
      db.users = db.users.filter((u) => u.id !== targetUserId);
      if (db.users.length === before) {
        throw new Error('Usuário não encontrado.');
      }
      for (const [sessTok, uid] of Object.entries(db.sessions)) {
        if (uid === targetUserId) delete db.sessions[sessTok];
      }
      writeDb(db);
    },
  };
}

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(
  supabaseUrl?.trim() && supabaseAnonKey?.trim(),
);

const supabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!.trim(), supabaseAnonKey!.trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const backend: BackendService = supabaseClient
  ? createSupabaseBackend(supabaseClient)
  : createLocalDemoBackend();
