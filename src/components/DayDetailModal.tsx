import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { getResolvedProductMap, NIGHT_COLOR_STYLES } from '../data/skincareData';
import type {
  AppSettings,
  CatalogProduct,
  DayCompletion,
  Period,
  Product,
  RoutineStep,
  SkincarePlan,
} from '../types';
import { formatDatePtBr } from '../utils/dateUtils';
import { getDayPlan } from '../utils/schedule';

interface DayDetailModalProps {
  dateStr: string | null;
  todayStr: string;
  plan: SkincarePlan;
  catalog: CatalogProduct[];
  settings: AppSettings;
  completion?: DayCompletion;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onTogglePeriod: (dateStr: string, period: Period) => void;
}

export function DayDetailModal({
  dateStr,
  todayStr,
  plan,
  catalog,
  settings,
  completion,
  onClose,
  onSelectProduct,
  onTogglePeriod,
}: DayDetailModalProps) {
  if (!dateStr) return null;

  const productMap = getResolvedProductMap(plan, catalog);
  const dayPlan = getDayPlan(dateStr, settings, plan, catalog);
  const nightStyle = NIGHT_COLOR_STYLES[dayPlan.nightColor];
  const isToday = dateStr === todayStr;
  const isFuture = dateStr > todayStr;
  const canToggle = !isFuture && dayPlan.phase > 0;
  const morningDone = Boolean(completion?.morningDone);
  const nightDone = Boolean(completion?.nightDone);

  const renderStepRow = (step: RoutineStep) => {
    const product = productMap[step.productId];
    if (!product) return null;
    const altProduct = step.alternativeProductId
      ? productMap[step.alternativeProductId]
      : null;

    return (
      <div
        key={`${step.stepNumber}-${step.productId}`}
        className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white border border-[#EFE5DC] hover:border-[#5A2C1C]/40 transition-colors"
      >
        <button
          type="button"
          onClick={() => onSelectProduct(product)}
          className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
        >
          <span className="w-6 h-6 rounded-full bg-[#F6EDE4] text-[#5A2C1C] text-xs font-bold flex items-center justify-center shrink-0">
            {step.stepNumber}
          </span>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: product.bottleColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#261610] truncate">
              {product.shortName}
            </p>
            <p className="text-xs text-[#755D52] truncate">
              {product.brand} • {step.shortHint}
            </p>
          </div>
          <Info className="w-4 h-4 text-[#A28B7F] shrink-0" />
        </button>

        {altProduct && (
          <button
            type="button"
            onClick={() => onSelectProduct(altProduct)}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 shrink-0 cursor-pointer hover:bg-red-100"
          >
            ou {altProduct.shortName}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-detail-title"
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#22120C]/50 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FBF7F2] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#EFE5DC] overflow-hidden animate-sheet-up max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white px-5 pt-5 pb-4 border-b border-[#EFE5DC] flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {isToday && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#5A2C1C] text-white">
                  Hoje
                </span>
              )}
              {dayPlan.phase > 0 ? (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F7EAE0] text-[#5A2C1C]">
                  Dia {dayPlan.dayNumber}/{dayPlan.totalDays} • Semana{' '}
                  {dayPlan.weekNumber}
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  Pré-início
                </span>
              )}
              {dayPlan.phase > 0 && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    dayPlan.laserStatus !== 'none'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : `${nightStyle.bgClass} ${nightStyle.textClass} ${nightStyle.borderClass}`
                  }`}
                >
                  {dayPlan.nightLabel}
                </span>
              )}
            </div>
            <h2
              id="day-detail-title"
              className="mt-1.5 text-lg font-bold text-[#261610]"
            >
              {formatDatePtBr(dateStr, 'long')}
            </h2>
            {dayPlan.phase > 0 && (
              <p className="text-xs text-[#755D52] mt-0.5">
                {dayPlan.phaseName} • {dayPlan.nightSubtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do dia"
            className="p-2 -mr-1 rounded-full text-[#856C60] hover:bg-[#F6EDE4] hover:text-[#261610] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto no-scrollbar">
          {dayPlan.phase === 0 ? (
            <div className="rounded-2xl bg-white border border-[#EFE5DC] p-5 text-center">
              <p className="text-sm font-semibold text-[#261610]">
                Esta data é anterior ao início do plano.
              </p>
              <p className="text-xs text-[#755D52] mt-1">
                {dayPlan.phaseObjective} Você pode alterar a data de início nos
                Ajustes.
              </p>
            </div>
          ) : (
            <>
              {dayPlan.laserBanner && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    {dayPlan.laserBanner}
                  </p>
                </div>
              )}

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#261610]">
                        Rotina da Manhã
                      </h3>
                      <p className="text-xs text-[#755D52] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Horário:{' '}
                        <strong className="text-[#261610]">
                          {settings.morningTime}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {canToggle && (
                    <button
                      type="button"
                      onClick={() => onTogglePeriod(dateStr, 'morning')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        morningDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-[#DFCFC2] text-[#261610] hover:border-[#5A2C1C]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {morningDone ? 'Feita' : 'Marcar feita'}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {dayPlan.morningSteps.map(renderStepRow)}
                </div>
              </section>

              <section className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#261610]">
                        Rotina da Noite ({dayPlan.nightLabel})
                      </h3>
                      <p className="text-xs text-[#755D52] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Horário:{' '}
                        <strong className="text-[#261610]">
                          {settings.nightTime}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {canToggle && (
                    <button
                      type="button"
                      onClick={() => onTogglePeriod(dateStr, 'night')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        nightDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-[#DFCFC2] text-[#261610] hover:border-[#5A2C1C]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {nightDone ? 'Feita' : 'Marcar feita'}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {dayPlan.nightSteps.map(renderStepRow)}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
