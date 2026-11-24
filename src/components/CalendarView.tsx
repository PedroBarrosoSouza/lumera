import { Check, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useState } from 'react';
import { NIGHT_COLOR_STYLES } from '../data/skincareData';
import type {
  AppSettings,
  CatalogProduct,
  DayCompletion,
  SkincarePlan,
} from '../types';
import {
  formatMonthYearPtBr,
  getMonthGrid,
  parseDateStr,
} from '../utils/dateUtils';
import { getDayPlan, getDayStatus } from '../utils/schedule';

interface CalendarViewProps {
  todayStr: string;
  plan: SkincarePlan;
  catalog: CatalogProduct[];
  settings: AppSettings;
  completions: Record<string, DayCompletion>;
  onSelectDay: (dateStr: string) => void;
}

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarView({
  todayStr,
  plan,
  catalog,
  settings,
  completions,
  onSelectDay,
}: CalendarViewProps) {
  const initialDate = parseDateStr(todayStr);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const grid = getMonthGrid(viewYear, viewMonth);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const dt = parseDateStr(todayStr);
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth());
  };

  let monthCompleted = 0;
  let monthPartial = 0;
  let monthMissed = 0;
  for (const dStr of grid) {
    if (!dStr) continue;
    const status = getDayStatus(
      dStr,
      todayStr,
      settings.startDate,
      completions,
      plan.totalDays,
    );
    if (status === 'completed') monthCompleted++;
    else if (status === 'partial') monthPartial++;
    else if (status === 'missed') monthMissed++;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-white border border-[#EFE5DC] p-3 text-center">
          <p className="text-lg font-extrabold text-emerald-700 tabular-nums">
            {monthCompleted}
          </p>
          <p className="text-[11px] font-medium text-[#755D52]">Dias feitos</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#EFE5DC] p-3 text-center">
          <p className="text-lg font-extrabold text-amber-600 tabular-nums">
            {monthPartial}
          </p>
          <p className="text-[11px] font-medium text-[#755D52]">Parciais</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#EFE5DC] p-3 text-center">
          <p className="text-lg font-extrabold text-rose-600 tabular-nums">
            {monthMissed}
          </p>
          <p className="text-[11px] font-medium text-[#755D52]">Perdidos</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-[#EFE5DC] p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Mês anterior"
            className="w-9 h-9 rounded-xl border border-[#EFE5DC] flex items-center justify-center text-[#5A4035] hover:bg-[#FBF7F2] cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-[#261610]">
              {formatMonthYearPtBr(viewYear, viewMonth)}
            </h2>
            <button
              type="button"
              onClick={handleGoToday}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F7EAE0] text-[#5A2C1C] hover:bg-[#EED8C7] cursor-pointer"
            >
              Hoje
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Próximo mês"
            className="w-9 h-9 rounded-xl border border-[#EFE5DC] flex items-center justify-center text-[#5A4035] hover:bg-[#FBF7F2] cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {WEEKDAY_HEADERS.map((wd) => (
            <div
              key={wd}
              className="text-center text-[11px] font-bold text-[#947C70] py-1"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {grid.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`empty-${idx}`} className="h-14" />;
            }

            const dayNum = Number(dateStr.split('-')[2]);
            const isToday = dateStr === todayStr;
            const dayPlan = getDayPlan(dateStr, settings, plan, catalog);
            const status = getDayStatus(
              dateStr,
              todayStr,
              settings.startDate,
              completions,
              plan.totalDays,
            );
            const inPlan =
              dayPlan.dayNumber >= 1 && dayPlan.dayNumber <= plan.totalDays;
            const nightStyle = NIGHT_COLOR_STYLES[dayPlan.nightColor];

            let cellBg = 'bg-[#FBF7F2] border-transparent';
            if (status === 'completed') {
              cellBg = 'bg-emerald-50 border-emerald-200';
            } else if (status === 'partial') {
              cellBg = 'bg-amber-50/70 border-amber-200';
            } else if (status === 'missed') {
              cellBg = 'bg-rose-50/70 border-rose-200';
            } else if (inPlan) {
              cellBg = 'bg-white border-[#EFE5DC]';
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDay(dateStr)}
                className={`relative h-14 rounded-2xl border flex flex-col items-center justify-between py-1.5 px-1 transition-all cursor-pointer hover:scale-[1.03] ${cellBg} ${
                  isToday
                    ? 'ring-2 ring-[#5A2C1C] ring-offset-1 border-[#5A2C1C]'
                    : ''
                } ${!inPlan ? 'opacity-50' : ''}`}
              >
                <div className="w-full flex items-center justify-between px-0.5">
                  <span
                    className={`text-xs font-bold leading-none ${
                      isToday ? 'text-[#5A2C1C]' : 'text-[#261610]'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {status === 'completed' && (
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  )}
                  {status === 'partial' && (
                    <span
                      title="Parcial (Manhã ou Noite)"
                      className="w-2 h-2 rounded-full bg-amber-500"
                    />
                  )}
                  {status === 'missed' && (
                    <span
                      title="Deixou de fazer"
                      className="w-2 h-2 rounded-full bg-rose-500"
                    />
                  )}
                </div>

                {inPlan ? (
                  dayPlan.laserStatus !== 'none' ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-extrabold leading-none">
                      <Zap className="w-2.5 h-2.5" />
                      L
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold leading-none ${nightStyle.bgClass} ${nightStyle.textClass}`}
                    >
                      {dayPlan.nightBadge}
                    </span>
                  )
                ) : (
                  <span className="text-[9px] text-[#B39D91] leading-none">
                    —
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3.5 border-t border-[#F2E8DF] space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-[#755D52]">
            {plan.nightRoutines.map((night) => {
              const st = NIGHT_COLOR_STYLES[night.color];
              return (
                <span key={night.id} className="inline-flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${st.bgClass} ${st.textClass}`}
                  >
                    {night.badge}
                  </span>
                  {night.label}
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                L
              </span>
              Laser
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-[#755D52]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-flex items-center justify-center text-white">
                <Check className="w-2 h-2" strokeWidth={3} />
              </span>
              Dia completo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Parcial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Não feito
            </span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[#856C60]">
        Toque em qualquer dia do calendário para ver os produtos e horários de Manhã e Noite.
      </p>
    </div>
  );
}
