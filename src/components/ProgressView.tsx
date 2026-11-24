import {
  Award,
  Bot,
  CheckCircle2,
  Edit3,
  Flame,
  Info,
  Moon,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { resolvePlanProducts } from '../data/skincareData';
import type {
  AppSettings,
  CatalogProduct,
  DayCompletion,
  Product,
  SkincarePlan,
} from '../types';
import { computeProgressStats, getDayPlan } from '../utils/schedule';

interface ProgressViewProps {
  todayStr: string;
  plan: SkincarePlan;
  catalog: CatalogProduct[];
  settings: AppSettings;
  completions: Record<string, DayCompletion>;
  onSelectProduct: (product: Product) => void;
  onOpenEditor: (tab?: 'ai' | 'products' | 'schedule') => void;
}

export function ProgressView({
  todayStr,
  plan,
  catalog,
  settings,
  completions,
  onSelectProduct,
  onOpenEditor,
}: ProgressViewProps) {
  const stats = computeProgressStats(todayStr, settings, completions, plan);
  const todayPlan = getDayPlan(todayStr, settings, plan, catalog);
  const resolvedProducts = resolvePlanProducts(plan, catalog);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white border border-[#EFE5DC] p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#5A2C1C]">
              {plan.name}
            </p>
            <h2 className="text-lg font-extrabold text-[#261610] mt-0.5">
              {stats.currentDayNumber === 0
                ? 'Plano ainda não iniciado'
                : `Dia ${stats.currentDayNumber} de ${stats.totalDays}`}
            </h2>
          </div>
          <span className="text-xl font-extrabold text-[#5A2C1C] tabular-nums">
            {stats.planProgressPct}%
          </span>
        </div>

        <div className="mt-3 h-2.5 w-full rounded-full bg-[#EFE4DA] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4A2316] via-[#A65A3E] to-[#E8A682] transition-all duration-500"
            style={{ width: `${stats.planProgressPct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#755D52]">
              <Flame className="w-4 h-4 text-orange-500" />
              Sequência atual
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#261610] tabular-nums">
              {stats.currentStreak}{' '}
              <span className="text-xs font-semibold text-[#755D52]">
                {stats.currentStreak === 1 ? 'dia' : 'dias'}
              </span>
            </p>
          </div>

          <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#755D52]">
              <Award className="w-4 h-4 text-amber-500" />
              Melhor sequência
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#261610] tabular-nums">
              {stats.bestStreak}{' '}
              <span className="text-xs font-semibold text-[#755D52]">
                {stats.bestStreak === 1 ? 'dia' : 'dias'}
              </span>
            </p>
          </div>

          <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#755D52]">
              <TrendingUp className="w-4 h-4 text-[#5A2C1C]" />
              Taxa de conclusão
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#5A2C1C] tabular-nums">
              {stats.overallRate}%
            </p>
          </div>

          <div className="rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#755D52]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Dias completos
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#261610] tabular-nums">
              {stats.completedDays}
              <span className="text-xs font-semibold text-rose-600 ml-2">
                ({stats.missedDays} perdidos)
              </span>
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 px-3 py-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <Sun className="w-3.5 h-3.5" /> Manhã
            </span>
            <span className="text-xs font-extrabold text-amber-950 tabular-nums">
              {stats.morningRate}% ({stats.morningDoneCount})
            </span>
          </div>

          <div className="rounded-xl bg-indigo-50/70 border border-indigo-200/70 px-3 py-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
              <Moon className="w-3.5 h-3.5" /> Noite
            </span>
            <span className="text-xs font-extrabold text-indigo-950 tabular-nums">
              {stats.nightRate}% ({stats.nightDoneCount})
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-[#F7EAE0]/80 border border-[#5A2C1C]/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#5A2C1C]">
            Personalize seus produtos e fases
          </p>
          <p className="text-xs text-[#3E2920] mt-0.5">
            Reutilize produtos da base ({catalog.length}) ou importe do Gemini.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenEditor('ai')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5A2C1C] hover:bg-[#3D1C11] text-white text-xs font-bold cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            Importar IA
          </button>
          <button
            type="button"
            onClick={() => onOpenEditor('products')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#5A2C1C]/30 text-[#5A2C1C] text-xs font-bold cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Editar
          </button>
        </div>
      </section>

      <section className="rounded-3xl bg-white border border-[#EFE5DC] p-5 shadow-xs space-y-3">
        <div>
          <h2 className="text-base font-extrabold text-[#261610]">
            Fases do Tratamento ({plan.phases.length})
          </h2>
          <p className="text-xs text-[#755D52]">
            Acompanhe a evolução do seu cronograma no calendário
          </p>
        </div>

        <div className="space-y-2.5">
          {plan.phases.map((phase) => {
            const isCurrent = todayPlan.phase === phase.phase;
            const isDone =
              todayPlan.dayNumber > phase.endDay && todayPlan.phase > 0;

            return (
              <div
                key={`${phase.phase}-${phase.name}`}
                className={`rounded-2xl border p-3.5 transition-colors ${
                  isCurrent
                    ? 'bg-[#F7EAE0]/65 border-[#5A2C1C]/40'
                    : isDone
                      ? 'bg-emerald-50/40 border-emerald-200/70'
                      : 'bg-[#FBF7F2] border-[#EFE5DC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#261610]">
                    {phase.name}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#5A2C1C] text-white">
                      Fase atual
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Concluída
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-[#5A2C1C] mt-0.5">
                  {phase.weeksLabel || `Dias ${phase.startDay} a ${phase.endDay}`}
                </p>
                <p className="text-xs font-medium text-[#422C22] mt-1.5 bg-white/80 rounded-lg px-2.5 py-1.5 border border-black/5">
                  {phase.patternLabel}
                </p>
                <p className="text-xs text-[#755D52] mt-1.5 leading-relaxed">
                  {phase.objective}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl bg-white border border-[#EFE5DC] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-[#261610]">
              Meus Produtos ({resolvedProducts.length})
            </h2>
            <p className="text-xs text-[#755D52]">
              Toque em qualquer item para ver modo de uso, precauções e onde aplicar
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenEditor('products')}
            className="text-xs font-bold text-[#5A2C1C] hover:underline shrink-0 cursor-pointer"
          >
            Gerenciar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {resolvedProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelectProduct(product)}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FBF7F2] border border-[#EFE5DC] hover:border-[#5A2C1C]/40 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-4 h-4 rounded-full shrink-0 ring-2 ring-white shadow-xs"
                  style={{ backgroundColor: product.bottleColor }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#261610] truncate">
                    {product.brand} • {product.name}
                  </p>
                  <p className="text-xs text-[#755D52] truncate">
                    Aplicar: {product.whereToApply}
                  </p>
                </div>
              </div>
              <Info className="w-4 h-4 text-[#5A2C1C] shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
