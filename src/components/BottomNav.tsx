import { BarChart3, CalendarDays, Sparkles } from 'lucide-react';
import type { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  todayPendingCount: number;
}

export function BottomNav({
  activeTab,
  onChangeTab,
  todayPendingCount,
}: BottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#EADFD5] pb-safe shadow-[0_-6px_24px_rgba(20,107,92,0.06)]"
    >
      <div className="max-w-lg mx-auto grid grid-cols-3 items-end px-4 pt-2 pb-1">
        {/* Esquerda: Calendário */}
        <button
          type="button"
          onClick={() => onChangeTab('calendar')}
          aria-current={activeTab === 'calendar' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors cursor-pointer ${
            activeTab === 'calendar'
              ? 'text-[#5A2C1C] font-semibold'
              : 'text-[#856C60] hover:text-[#261610]'
          }`}
        >
          <CalendarDays className="w-5 h-5" strokeWidth={activeTab === 'calendar' ? 2.4 : 1.9} />
          <span className="text-[11px] tracking-tight">Calendário</span>
        </button>

        {/* Centro: Hoje (destaque) */}
        <div className="flex justify-center -mt-6">
          <button
            type="button"
            onClick={() => onChangeTab('today')}
            aria-label="Hoje"
            aria-current={activeTab === 'today' ? 'page' : undefined}
            className="relative z-10 flex flex-col items-center cursor-pointer group"
          >
            <span
              className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-lg ${
                activeTab === 'today'
                  ? 'bg-gradient-to-br from-[#4A2316] via-[#7A3B26] to-[#B86A4C] text-[#FBF7F2] scale-105 ring-4 ring-[#FBF7F2] shadow-[#5A2C1C]/30'
                  : 'bg-[#F7EAE0] text-[#5A2C1C] ring-4 ring-[#FBF7F2] group-hover:bg-[#EED8C7]'
              }`}
            >
              <Sparkles className="w-6 h-6" strokeWidth={2.2} />
              {todayPendingCount > 0 && (
                <span
                  aria-hidden="true"
                  title={`${todayPendingCount} rotina(s) pendente(s) hoje`}
                  className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#C9714E] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
                >
                  {todayPendingCount}
                </span>
              )}
            </span>
            <span
              className={`mt-1 text-[11px] tracking-tight ${
                activeTab === 'today'
                  ? 'text-[#5A2C1C] font-bold'
                  : 'text-[#856C60] font-medium'
              }`}
            >
              Hoje
            </span>
          </button>
        </div>

        {/* Direita: Progresso */}
        <button
          type="button"
          onClick={() => onChangeTab('progress')}
          aria-current={activeTab === 'progress' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors cursor-pointer ${
            activeTab === 'progress'
              ? 'text-[#5A2C1C] font-semibold'
              : 'text-[#856C60] hover:text-[#261610]'
          }`}
        >
          <BarChart3 className="w-5 h-5" strokeWidth={activeTab === 'progress' ? 2.4 : 1.9} />
          <span className="text-[11px] tracking-tight">Progresso</span>
        </button>
      </div>
    </nav>
  );
}
