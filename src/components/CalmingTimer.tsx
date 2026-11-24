import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CalmingTimerProps {
  waitMinutes?: number;
  productName?: string;
  timerEnd: number | null;
  onStart: (durationSeconds: number) => void;
  onStop: () => void;
}

export function CalmingTimer({
  waitMinutes = 15,
  productName = 'Calming Cream',
  timerEnd,
  onStart,
  onStop,
}: CalmingTimerProps) {
  const durationSeconds = Math.max(60, Math.round(waitMinutes * 60));
  const [now, setNow] = useState(() => Date.now());
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);

  const isRunning = timerEnd !== null && timerEnd > now;

  useEffect(() => {
    if (!timerEnd) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => window.clearInterval(id);
  }, [timerEnd]);

  const remainingSeconds = isRunning
    ? Math.max(0, Math.ceil((timerEnd - now) / 1000))
    : pausedRemaining ?? durationSeconds;

  const isFinished =
    timerEnd !== null && timerEnd <= now && pausedRemaining === null;

  const displaySeconds = isFinished ? 0 : remainingSeconds;
  const mins = String(Math.floor(displaySeconds / 60)).padStart(2, '0');
  const secs = String(displaySeconds % 60).padStart(2, '0');
  const progressPct = Math.min(
    100,
    Math.max(0, ((durationSeconds - displaySeconds) / durationSeconds) * 100),
  );

  const handleToggle = () => {
    if (isRunning) {
      setPausedRemaining(remainingSeconds);
      onStop();
    } else {
      const targetSeconds =
        pausedRemaining && pausedRemaining > 0
          ? pausedRemaining
          : durationSeconds;
      setPausedRemaining(null);
      onStart(targetSeconds);
    }
  };

  const handleReset = () => {
    setPausedRemaining(null);
    onStop();
  };

  return (
    <div
      className="mt-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-950">
              {isFinished
                ? `${waitMinutes} min concluídos! Pode seguir`
                : `Aguardar ${waitMinutes} min antes do próximo passo`}
            </p>
            <p className="text-[11px] text-amber-800">
              Para absorção completa de {productName}
            </p>
          </div>
        </div>

        <span className="font-mono text-base font-extrabold text-amber-950 tabular-nums">
          {mins}:{secs}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full rounded-full bg-amber-200/70 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isFinished ? 'bg-emerald-600' : 'bg-amber-600'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Controls */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" /> Pausar
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />{' '}
              {pausedRemaining
                ? 'Retomar'
                : isFinished
                  ? `Iniciar novo (${waitMinutes}m)`
                  : `Iniciar ${waitMinutes} min`}
            </>
          )}
        </button>

        {(isRunning || pausedRemaining !== null || isFinished) && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/60 text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Zerar
          </button>
        )}
      </div>
    </div>
  );
}
