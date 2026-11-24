import {
  DEFAULT_CREAMY_PLAN,
  getResolvedProductMap,
  INITIAL_CATALOG_PRODUCTS,
} from '../data/skincareData';
import type {
  AppSettings,
  CatalogProduct,
  DayCompletion,
  DayPlan,
  DayStatus,
  LaserStatus,
  PlanStep,
  Product,
  ProductId,
  RoutineStep,
  SkincarePlan,
} from '../types';
import { addDays, diffDays } from './dateUtils';

function resolveLaserStatus(
  dateStr: string,
  settings: AppSettings,
): LaserStatus {
  let priority: LaserStatus = 'none';
  for (const session of settings.laserSessions) {
    if (!session.date) continue;
    const delta = diffDays(session.date, dateStr);
    if (delta === 0) {
      return 'laser-day';
    }
    if (delta > 0 && delta <= session.daysAfter) {
      priority = 'post-laser';
    } else if (delta < 0 && -delta <= session.daysBefore && priority === 'none') {
      priority = 'pre-laser';
    }
  }
  return priority;
}

function toRoutineSteps(
  steps: PlanStep[],
  productMap: Record<string, Product>,
): RoutineStep[] {
  return steps
    .filter((s) => Boolean(productMap[s.productId]))
    .map((step, index) => ({
      ...step,
      stepNumber: index + 1,
    }));
}

function stepsValid(
  steps: PlanStep[] | undefined,
  productMap: Record<string, Product>,
): steps is PlanStep[] {
  return (
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every((s) => Boolean(productMap[s.productId]))
  );
}

function filterOutAcids(
  steps: PlanStep[],
  productMap: Record<string, Product>,
): PlanStep[] {
  return steps.filter((step) => {
    const prod = productMap[step.productId];
    return prod && !prod.isAcid;
  });
}

export function getDayPlan(
  dateStr: string,
  settings: AppSettings,
  plan: SkincarePlan = DEFAULT_CREAMY_PLAN,
  catalog: CatalogProduct[] = INITIAL_CATALOG_PRODUCTS,
): DayPlan {
  const productMap = getResolvedProductMap(plan, catalog);
  const resolvedProducts = Object.values(productMap);
  const totalDays = Math.max(1, plan.totalDays || 84);
  const dayNumber = diffDays(settings.startDate, dateStr) + 1;
  const laserStatus = resolveLaserStatus(dateStr, settings);
  const defaultNight = plan.nightRoutines[0] ?? {
    id: 'N',
    badge: 'N',
    label: 'Noite',
    subtitle: 'Rotina noturna',
    color: 'emerald' as const,
    steps: [],
  };

  if (dayNumber < 1) {
    return {
      dateStr,
      dayNumber,
      totalDays,
      weekNumber: 0,
      phase: 0,
      phaseName: 'Antes do início do plano',
      phaseObjective: `Seu plano começa em ${settings.startDate.split('-').reverse().join('/')}.`,
      nightType: defaultNight.id,
      nightBadge: '—',
      nightLabel: 'Pré-início',
      nightSubtitle: 'Plano ainda não iniciado nesta data',
      nightColor: defaultNight.color,
      laserStatus,
      morningSteps: [],
      nightSteps: [],
    };
  }

  const weekNumber = Math.floor((dayNumber - 1) / 7) + 1;
  const sortedPhases = [...plan.phases].sort((a, b) => a.startDay - b.startDay);
  const matchedPhase = sortedPhases.find(
    (p) => dayNumber >= p.startDay && dayNumber <= p.endDay,
  );
  const fallbackPhase = sortedPhases[sortedPhases.length - 1] ?? {
    phase: 1,
    name: 'Rotina Contínua',
    weeksLabel: `Dias 1 a ${totalDays}`,
    startDay: 1,
    endDay: totalDays,
    patternLabel: defaultNight.label,
    objective: plan.subtitle,
    nightPattern: [defaultNight.id],
  };

  const isMaintenance = !matchedPhase && dayNumber > totalDays;
  const activePhase = matchedPhase ?? fallbackPhase;
  const pattern =
    activePhase.nightPattern.length > 0
      ? activePhase.nightPattern
      : [defaultNight.id];

  const offsetInPhase = Math.max(0, dayNumber - activePhase.startDay);
  const nightId = pattern[offsetInPhase % pattern.length];
  const nightCfg =
    plan.nightRoutines.find((n) => n.id === nightId) ?? defaultNight;

  const phaseNumber = isMaintenance
    ? sortedPhases.length + 1
    : activePhase.phase;
  const phaseName = isMaintenance
    ? `Manutenção (Pós-${totalDays} Dias)`
    : activePhase.name;
  const phaseObjective = isMaintenance
    ? 'Ciclo contínuo de manutenção seguindo o padrão da fase final.'
    : activePhase.objective;

  let nightLabel = nightCfg.label;
  let nightSubtitle = nightCfg.subtitle;
  let nightColor = nightCfg.color;
  let nightBadge = nightCfg.badge || nightCfg.id.slice(0, 2);
  let laserBanner: string | undefined;
  let pausedAcids: ProductId[] | undefined;

  let rawMorning = plan.morningSteps;
  let rawNight = nightCfg.steps;

  if (laserStatus !== 'none') {
    const acidProducts = resolvedProducts.filter((p) => p.isAcid);
    const acidIds = acidProducts.map((p) => p.id);
    const acidNames = acidProducts.map((p) => p.shortName).join(', ');
    pausedAcids = acidIds;
    nightColor = 'amber';
    nightBadge = 'L';

    if (laserStatus === 'pre-laser') {
      nightLabel = 'Modo Pré-Laser';
      nightSubtitle = 'Ácidos pausados na área do laser (7 a 14 dias antes)';
      laserBanner = acidNames
        ? `Protocolo Pré-Laser: suspenda os ácidos (${acidNames}) na área do laser.`
        : 'Protocolo Pré-Laser ativo: mantenha apenas limpeza, hidratação e proteção solar.';
      rawMorning = stepsValid(plan.laserProtocol?.preLaserMorningSteps, productMap)
        ? plan.laserProtocol!.preLaserMorningSteps!
        : filterOutAcids(plan.morningSteps, productMap);
      rawNight = stepsValid(plan.laserProtocol?.preLaserNightSteps, productMap)
        ? plan.laserProtocol!.preLaserNightSteps!
        : filterOutAcids(nightCfg.steps, productMap);
    } else {
      nightLabel =
        laserStatus === 'laser-day' ? 'Dia do Laser' : 'Pós-Laser';
      nightSubtitle =
        laserStatus === 'laser-day'
          ? 'Limpeza + Hidratação + Calmante'
          : 'Recuperação e barreira (5 a 7 dias após)';
      laserBanner =
        laserStatus === 'laser-day'
          ? 'Dia da sessão a laser: use apenas produtos suaves, hidratantes/calmantes e protetor solar.'
          : 'Protocolo Pós-Laser: use apenas itens hidratantes e calmantes. Reintroduza os ácidos somente sem ardência, calor ou sensibilidade.';
      rawMorning = stepsValid(plan.laserProtocol?.postLaserMorningSteps, productMap)
        ? plan.laserProtocol!.postLaserMorningSteps!
        : filterOutAcids(plan.morningSteps, productMap);
      rawNight = stepsValid(plan.laserProtocol?.postLaserNightSteps, productMap)
        ? plan.laserProtocol!.postLaserNightSteps!
        : filterOutAcids(nightCfg.steps, productMap);
    }
  }

  return {
    dateStr,
    dayNumber,
    totalDays,
    weekNumber,
    phase: phaseNumber,
    phaseName,
    phaseObjective,
    nightType: nightCfg.id,
    nightBadge,
    nightLabel,
    nightSubtitle,
    nightColor,
    laserStatus,
    laserBanner,
    pausedAcids,
    morningSteps: toRoutineSteps(rawMorning, productMap),
    nightSteps: toRoutineSteps(rawNight, productMap),
  };
}

export function getDayStatus(
  dateStr: string,
  todayStr: string,
  startDate: string,
  completions: Record<string, DayCompletion>,
  totalDays = 84,
): DayStatus {
  const dayNumber = diffDays(startDate, dateStr) + 1;
  if (dayNumber < 1 || dayNumber > totalDays) {
    return 'outside';
  }
  const c = completions[dateStr];
  const morningDone = Boolean(c?.morningDone);
  const nightDone = Boolean(c?.nightDone);

  if (morningDone && nightDone) return 'completed';
  if (morningDone || nightDone) return 'partial';
  if (dateStr < todayStr) return 'missed';
  if (dateStr === todayStr) return 'pending';
  return 'future';
}

export interface ProgressStats {
  totalDays: number;
  totalDaysPassed: number;
  completedDays: number;
  partialDays: number;
  missedDays: number;
  morningDoneCount: number;
  nightDoneCount: number;
  morningRate: number;
  nightRate: number;
  overallRate: number;
  currentStreak: number;
  bestStreak: number;
  currentDayNumber: number;
  planProgressPct: number;
}

export function computeProgressStats(
  todayStr: string,
  settings: AppSettings,
  completions: Record<string, DayCompletion>,
  plan: SkincarePlan = DEFAULT_CREAMY_PLAN,
): ProgressStats {
  const totalDays = Math.max(1, plan.totalDays || 84);
  const rawDay = diffDays(settings.startDate, todayStr) + 1;
  const currentDayNumber = Math.max(0, Math.min(totalDays, rawDay));
  const totalDaysPassed = Math.max(0, Math.min(totalDays, rawDay));

  let completedDays = 0;
  let partialDays = 0;
  let missedDays = 0;
  let morningDoneCount = 0;
  let nightDoneCount = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  for (let i = 0; i < totalDaysPassed; i++) {
    const dStr = addDays(settings.startDate, i);
    const c = completions[dStr];
    const m = Boolean(c?.morningDone);
    const n = Boolean(c?.nightDone);

    if (m) morningDoneCount++;
    if (n) nightDoneCount++;

    if (m && n) {
      completedDays++;
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else if (m || n) {
      partialDays++;
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else if (dStr < todayStr) {
      missedDays++;
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  if (totalDaysPassed > 0) {
    const todayComp = completions[todayStr];
    const todayHasAny = Boolean(todayComp?.morningDone || todayComp?.nightDone);
    const startOffset = todayHasAny ? totalDaysPassed - 1 : totalDaysPassed - 2;

    for (let i = startOffset; i >= 0; i--) {
      const dStr = addDays(settings.startDate, i);
      const c = completions[dStr];
      if (c?.morningDone || c?.nightDone) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  const pastDaysCount = Math.max(0, Math.min(totalDays, rawDay - 1));
  const todayComp = completions[todayStr];
  const morningDenom =
    pastDaysCount +
    (rawDay >= 1 && rawDay <= totalDays && todayComp?.morningDone ? 1 : 0);
  const nightDenom =
    pastDaysCount +
    (rawDay >= 1 && rawDay <= totalDays && todayComp?.nightDone ? 1 : 0);
  const overallDenom = morningDenom + nightDenom;

  const morningRate =
    morningDenom > 0 ? Math.round((morningDoneCount / morningDenom) * 100) : 0;
  const nightRate =
    nightDenom > 0 ? Math.round((nightDoneCount / nightDenom) * 100) : 0;
  const overallRate =
    overallDenom > 0
      ? Math.round(((morningDoneCount + nightDoneCount) / overallDenom) * 100)
      : 0;

  return {
    totalDays,
    totalDaysPassed,
    completedDays,
    partialDays,
    missedDays,
    morningDoneCount,
    nightDoneCount,
    morningRate,
    nightRate,
    overallRate,
    currentStreak,
    bestStreak,
    currentDayNumber,
    planProgressPct: Math.round((currentDayNumber / totalDays) * 100),
  };
}
