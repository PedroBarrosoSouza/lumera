import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { getResolvedProductMap, NIGHT_COLOR_STYLES } from '../data/skincareData';
import type {
  AppSettings,
  CatalogProduct,
  DayCompletion,
  Period,
  Product,
  ProductId,
  RoutineStep,
  SkincarePlan,
} from '../types';
import { formatDatePtBr } from '../utils/dateUtils';
import { getDayPlan } from '../utils/schedule';
import { CalmingTimer } from './CalmingTimer';

interface TodayViewProps {
  todayStr: string;
  displayName: string;
  plan: SkincarePlan;
  catalog: CatalogProduct[];
  settings: AppSettings;
  completion?: DayCompletion;
  calmingTimerEnd: number | null;
  onStartTimer: (durationSeconds: number) => void;
  onStopTimer: () => void;
  onSelectProduct: (product: Product) => void;
  onToggleStep: (
    dateStr: string,
    period: Period,
    productId: ProductId,
    allStepIds: ProductId[],
  ) => void;
  onTogglePeriod: (dateStr: string, period: Period) => void;
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getRecommendedPeriod(
  hour: number,
  morningDone: boolean,
  nightDone: boolean,
): Period {
  if (!morningDone && (hour < 14 || nightDone)) return 'morning';
  if (!nightDone) return 'night';
  return hour < 14 ? 'morning' : 'night';
}

export function TodayView({
  todayStr,
  displayName,
  plan,
  catalog,
  settings,
  completion,
  calmingTimerEnd,
  onStartTimer,
  onStopTimer,
  onSelectProduct,
  onToggleStep,
  onTogglePeriod,
}: TodayViewProps) {
  const hour = new Date().getHours();
  const productMap = getResolvedProductMap(plan, catalog);
  const dayPlan = getDayPlan(todayStr, settings, plan, catalog);
  const nightStyle = NIGHT_COLOR_STYLES[dayPlan.nightColor];

  const morningDone = Boolean(completion?.morningDone);
  const nightDone = Boolean(completion?.nightDone);
  const bothDone = morningDone && nightDone;

  const recommendedPeriod = getRecommendedPeriod(hour, morningDone, nightDone);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(recommendedPeriod);

  const activeSteps: RoutineStep[] =
    selectedPeriod === 'morning' ? dayPlan.morningSteps : dayPlan.nightSteps;
  const activeStepIds = activeSteps.map((s) => s.productId);
  const checkedStepIds =
    selectedPeriod === 'morning'
      ? completion?.morningSteps ?? []
      : completion?.nightSteps ?? [];
  const isSelectedPeriodDone =
    selectedPeriod === 'morning' ? morningDone : nightDone;

  const nextTime =
    recommendedPeriod === 'morning' ? settings.morningTime : settings.nightTime;
  const nextTitle =
    recommendedPeriod === 'morning'
      ? 'Rotina da Manhã'
      : `Rotina da Noite • ${dayPlan.nightLabel}`;

  const firstName = displayName.trim().split(' ')[0] || displayName;

  if (dayPlan.phase === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-[#421E13] via-[#7A3B26] to-[#B86A4C] text-white p-6 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#F7D7B5]">
            {getGreeting(hour)}, {firstName}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">
            {formatDatePtBr(todayStr, 'weekday')}
          </h1>
          <p className="mt-2 text-sm text-[#FDF3EA] leading-relaxed">
            {dayPlan.phaseObjective}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 text-xs font-semibold">
            <Clock className="w-4 h-4" />
            Início configurado para {settings.startDate.split('-').reverse().join('/')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero / Personalização de Hoje */}
      <section className="rounded-3xl bg-gradient-to-br from-[#421E13] via-[#7A3B26] to-[#B86A4C] text-white p-5 shadow-lg shadow-[#5A2C1C]/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#F7D7B5]">
              {getGreeting(hour)}, {firstName} • Semana {dayPlan.weekNumber} • Dia{' '}
              {Math.min(dayPlan.dayNumber, dayPlan.totalDays)}/{dayPlan.totalDays}
            </p>
            <h1 className="mt-0.5 text-xl font-extrabold leading-tight">
              {formatDatePtBr(todayStr, 'weekday')}
            </h1>
            <p className="text-xs text-[#F7D7B5]/90 mt-0.5">
              {dayPlan.phaseName}
            </p>
          </div>

          <span
            className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border ${
              dayPlan.laserStatus !== 'none'
                ? 'bg-amber-300/20 border-amber-200/50 text-amber-100'
                : 'bg-white/15 border-white/25 text-white'
            }`}
          >
            {dayPlan.nightLabel}
          </span>
        </div>

        {/* Próxima Rotina */}
        <div className="mt-4 rounded-2xl bg-white/12 backdrop-blur-xs border border-white/18 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FBF7F2] text-[#5A2C1C] flex items-center justify-center shrink-0 shadow-xs">
              {bothDone ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : recommendedPeriod === 'morning' ? (
                <Sun className="w-5 h-5 text-[#C9714E]" />
              ) : (
                <Moon className="w-5 h-5 text-[#5A2C1C]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#F7D7B5]">
                {bothDone ? 'Meta do dia batida' : 'O que fazer agora'}
              </p>
              <p className="text-sm font-bold text-white leading-snug">
                {bothDone ? 'Manhã e Noite concluídas!' : nextTitle}
              </p>
              <p className="text-xs text-[#FDF3EA]/90 leading-snug mt-0.5">
                {bothDone
                  ? 'Sua pele agradece a constância'
                  : `Horário: ${nextTime} • ${
                      recommendedPeriod === 'morning'
                        ? 'Rotina matinal'
                        : dayPlan.nightSubtitle
                    }`}
              </p>
            </div>
          </div>

          {!bothDone && selectedPeriod !== recommendedPeriod && (
            <button
              type="button"
              onClick={() => setSelectedPeriod(recommendedPeriod)}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FBF7F2] text-[#5A2C1C] text-xs font-bold hover:bg-[#F7EAE0] transition-colors cursor-pointer"
            >
              Abrir
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Banner Depilação a Laser se ativo */}
      {dayPlan.laserBanner && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-900">
              {dayPlan.nightLabel} Ativo
            </p>
            <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
              {dayPlan.laserBanner}
            </p>
            {dayPlan.pausedAcids && dayPlan.pausedAcids.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dayPlan.pausedAcids.map((id) => {
                  const prod = productMap[id];
                  if (!prod) return null;
                  return (
                    <span
                      key={id}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200"
                    >
                      Pausado: {prod.shortName}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seletor Manhã / Noite */}
      <div className="grid grid-cols-2 gap-2.5 bg-white p-1.5 rounded-2xl border border-[#EFE5DC] shadow-2xs">
        <button
          type="button"
          onClick={() => setSelectedPeriod('morning')}
          className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
            selectedPeriod === 'morning'
              ? 'bg-[#5A2C1C] text-white shadow-sm'
              : 'text-[#6A5044] hover:bg-[#FBF7F2]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-bold leading-none">Manhã</p>
              <p
                className={`text-[11px] mt-0.5 leading-none ${
                  selectedPeriod === 'morning'
                    ? 'text-[#F7D7B5]'
                    : 'text-[#947C70]'
                }`}
              >
                {settings.morningTime}
              </p>
            </div>
          </div>
          {morningDone && (
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                selectedPeriod === 'morning'
                  ? 'bg-white text-[#5A2C1C]'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSelectedPeriod('night')}
          className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
            selectedPeriod === 'night'
              ? 'bg-[#5A2C1C] text-white shadow-sm'
              : 'text-[#6A5044] hover:bg-[#FBF7F2]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-bold leading-none">Noite</p>
              <p
                className={`text-[11px] mt-0.5 leading-none ${
                  selectedPeriod === 'night'
                    ? 'text-[#F7D7B5]'
                    : 'text-[#947C70]'
                }`}
              >
                {settings.nightTime}
              </p>
            </div>
          </div>
          {nightDone && (
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                selectedPeriod === 'night'
                  ? 'bg-white text-[#5A2C1C]'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          )}
        </button>
      </div>

      {/* Cabeçalho da Lista de Passos */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-bold text-[#261610]">
            {selectedPeriod === 'morning'
              ? 'Passos da Manhã'
              : `Passos da Noite • ${dayPlan.nightLabel}`}
          </h2>
          <p className="text-xs text-[#755D52]">
            {selectedPeriod === 'morning'
              ? 'Toque em qualquer produto para ver como usar, precauções e onde aplicar'
              : dayPlan.nightSubtitle}
          </p>
        </div>

        {selectedPeriod === 'night' && dayPlan.laserStatus === 'none' && (
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${nightStyle.bgClass} ${nightStyle.textClass} ${nightStyle.borderClass}`}
          >
            {dayPlan.nightLabel}
          </span>
        )}
      </div>

      {/* Lista de Produtos */}
      {activeSteps.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#EFE5DC] p-5 text-center text-xs text-[#755D52]">
          Nenhum passo cadastrado neste turno. Use <strong>Progresso</strong> ou{' '}
          <strong>Ajustes</strong> para adicionar produtos à sua rotina.
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeSteps.map((step) => {
            const product = productMap[step.productId];
            if (!product) return null;
            const altProduct = step.alternativeProductId
              ? productMap[step.alternativeProductId]
              : null;
            const isChecked =
              isSelectedPeriodDone || checkedStepIds.includes(step.productId);
            const showWaitTimer =
              selectedPeriod === 'night' &&
              Boolean(step.waitMinutes && step.waitMinutes > 0);

            return (
              <div
                key={`${selectedPeriod}-${step.stepNumber}-${step.productId}`}
                className={`rounded-2xl border p-3.5 transition-all ${
                  isChecked
                    ? 'bg-emerald-50/55 border-emerald-200/90'
                    : 'bg-white border-[#EFE5DC] shadow-2xs hover:border-[#5A2C1C]/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={`Marcar ${product.shortName} como usado`}
                    onClick={() =>
                      onToggleStep(
                        todayStr,
                        selectedPeriod,
                        step.productId,
                        activeStepIds,
                      )
                    }
                    className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-[#5A2C1C] border-[#5A2C1C] text-white'
                        : 'bg-[#FBF7F2] border-[#D2BFB0] text-transparent hover:border-[#5A2C1C]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      className="w-full text-left flex items-start justify-between gap-2 cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[#856C60]">
                            Passo {step.stepNumber}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F6EDE4] text-[#6A5044]">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: product.bottleColor }}
                            />
                            {product.brand}
                          </span>
                        </div>

                        <p
                          className={`mt-1 text-sm font-bold leading-snug ${
                            isChecked
                              ? 'text-[#5A2C1C] line-through decoration-[#5A2C1C]/40'
                              : 'text-[#261610] group-hover:text-[#5A2C1C]'
                          }`}
                        >
                          {product.name}
                        </p>
                        <p className="text-xs text-[#755D52] mt-0.5">
                          {step.shortHint}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5A2C1C] bg-[#F7EAE0] px-2.5 py-1 rounded-full shrink-0 mt-1 group-hover:bg-[#EED8C7]">
                        <Info className="w-3.5 h-3.5" />
                        Como usar
                      </span>
                    </button>

                    {altProduct && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(altProduct)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: altProduct.bottleColor }}
                          />
                          Ou usar {altProduct.shortName} (ver modo de uso)
                        </button>
                      </div>
                    )}

                    {showWaitTimer && (
                      <CalmingTimer
                        waitMinutes={step.waitMinutes}
                        productName={product.shortName}
                        timerEnd={calmingTimerEnd}
                        onStart={onStartTimer}
                        onStop={onStopTimer}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botão principal de concluir rotina */}
      <button
        type="button"
        onClick={() => onTogglePeriod(todayStr, selectedPeriod)}
        className={`w-full py-4 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md ${
          isSelectedPeriodDone
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            : 'bg-[#5A2C1C] hover:bg-[#3D1C11] text-white shadow-[#5A2C1C]/25'
        }`}
      >
        {isSelectedPeriodDone ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            {selectedPeriod === 'morning'
              ? 'Rotina da Manhã Concluída! (Toque para desfazer)'
              : 'Rotina da Noite Concluída! (Toque para desfazer)'}
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            {selectedPeriod === 'morning'
              ? 'Marcar Rotina da Manhã como Feita'
              : 'Marcar Rotina da Noite como Feita'}
          </>
        )}
      </button>
    </div>
  );
}
