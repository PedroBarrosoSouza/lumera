export type ProductId = string;

export type NightColorKey =
  | 'pink'
  | 'emerald'
  | 'sky'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'teal';

/**
 * Produto cadastrado na Base Acumulativa Global do sistema.
 * Compartilhado entre todos os usuários (marca, modo de uso e precauções).
 */
export interface CatalogProduct {
  id: ProductId;
  brand: string;
  name: string;
  shortName: string;
  normalizedKey: string;
  bottleLabel: string;
  bottleColor: string;
  usageOfficial: string;
  precautions: string;
  quantity: string;
  defaultFocus: string;
  isAcid: boolean;
}

export type CatalogProductInput = Omit<CatalogProduct, 'normalizedKey'> & {
  normalizedKey?: string;
};

export interface CatalogUpsertResult {
  requestedId: string;
  canonicalId: string;
  reused: boolean;
  product: CatalogProduct;
}

/**
 * Configuração individual por pessoa dentro do seu próprio plano:
 * onde ela aplica o produto, foco pessoal e frequência/turno.
 */
export interface UserProductConfig {
  productId: ProductId;
  whereToApply: string;
  personalFocus?: string;
  whenToUse?: string;
}

/**
 * Produto resolvido para exibição na UI (Base Global + Áreas do Plano do Usuário).
 */
export interface Product {
  id: ProductId;
  brand: string;
  name: string;
  shortName: string;
  normalizedKey?: string;
  bottleLabel: string;
  bottleColor: string;
  focus: string;
  whereToApply: string;
  usageOfficial: string;
  precautions: string;
  whenToUse: string;
  quantity: string;
  isAcid: boolean;
  laserNote?: string;
}

export type NightType = string;
export type Period = 'morning' | 'night';
export type LaserStatus = 'none' | 'pre-laser' | 'laser-day' | 'post-laser';

export interface PlanStep {
  productId: ProductId;
  shortHint: string;
  waitMinutes?: number;
  alternativeProductId?: ProductId;
  note?: string;
}

export interface RoutineStep extends PlanStep {
  stepNumber: number;
}

export interface NightRoutineConfig {
  id: string;
  badge: string;
  label: string;
  subtitle: string;
  color: NightColorKey;
  steps: PlanStep[];
}

export interface PhaseConfig {
  phase: number;
  name: string;
  weeksLabel: string;
  startDay: number;
  endDay: number;
  patternLabel: string;
  objective: string;
  nightPattern: string[];
}

export interface LaserProtocolConfig {
  enabled: boolean;
  preLaserMorningSteps?: PlanStep[];
  preLaserNightSteps?: PlanStep[];
  postLaserMorningSteps?: PlanStep[];
  postLaserNightSteps?: PlanStep[];
}

export interface SkincarePlan {
  id: string;
  name: string;
  subtitle: string;
  totalDays: number;
  userProducts: Record<ProductId, UserProductConfig>;
  /** Campo legado opcional para migração transparente de planos salvos anteriormente */
  products?: Product[];
  morningSteps: PlanStep[];
  nightRoutines: NightRoutineConfig[];
  phases: PhaseConfig[];
  laserProtocol?: LaserProtocolConfig;
}

export interface DayPlan {
  dateStr: string;
  dayNumber: number;
  totalDays: number;
  weekNumber: number;
  phase: number;
  phaseName: string;
  phaseObjective: string;
  nightType: NightType;
  nightBadge: string;
  nightLabel: string;
  nightSubtitle: string;
  nightColor: NightColorKey;
  laserStatus: LaserStatus;
  laserBanner?: string;
  pausedAcids?: ProductId[];
  morningSteps: RoutineStep[];
  nightSteps: RoutineStep[];
}

export interface LaserSession {
  id: string;
  date: string;
  daysBefore: number;
  daysAfter: number;
}

export interface DayCompletion {
  morningSteps: ProductId[];
  nightSteps: ProductId[];
  morningDone: boolean;
  nightDone: boolean;
}

export interface AppSettings {
  startDate: string;
  morningTime: string;
  nightTime: string;
  webNotificationsEnabled: boolean;
  laserSessions: LaserSession[];
}

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface AdminUserSummary extends UserProfile {
  createdAt: string;
  updatedAt: string;
}

export interface UserWorkspaceData {
  plan: SkincarePlan;
  settings: AppSettings;
  completions: Record<string, DayCompletion>;
}

export type DayStatus =
  | 'completed'
  | 'partial'
  | 'missed'
  | 'pending'
  | 'future'
  | 'outside';

export type ActiveTab = 'calendar' | 'today' | 'progress';
