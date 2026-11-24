import { Cloud, HardDrive, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { CalendarView } from './components/CalendarView';
import { DayDetailModal } from './components/DayDetailModal';
import { LoginView } from './components/LoginView';
import { ProductModal } from './components/ProductModal';
import { ProgressView } from './components/ProgressView';
import { RoutineEditorModal } from './components/RoutineEditorModal';
import { SettingsModal } from './components/SettingsModal';
import { TodayView } from './components/TodayView';
import {
  ensureNormalizedPlan,
  INITIAL_CATALOG_PRODUCTS,
} from './data/skincareData';
import { backend, type CreateUserInput } from './services/backend';
import type {
  ActiveTab,
  AppSettings,
  CatalogProduct,
  CatalogProductInput,
  DayCompletion,
  Period,
  Product,
  ProductId,
  SkincarePlan,
  UserProfile,
  UserWorkspaceData,
} from './types';
import { getTodayStr } from './utils/dateUtils';
import { playSoftChime, showAppNotification } from './utils/notifications';
import { getDayPlan } from './utils/schedule';
import {
  loadCalmingTimerEnd,
  loadNotifiedToday,
  loadSessionToken,
  saveCalmingTimerEnd,
  saveNotifiedToday,
  saveSessionToken,
  saveUserCache,
} from './utils/storage';

const EMPTY_COMPLETION: DayCompletion = {
  morningSteps: [],
  nightSteps: [],
  morningDone: false,
  nightDone: false,
};

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    loadSessionToken(),
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<UserWorkspaceData | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(
    () => [...INITIAL_CATALOG_PRODUCTS],
  );
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const [calmingTimerEnd, setCalmingTimerEnd] = useState<number | null>(null);
  const [notifiedToday, setNotifiedToday] = useState<Record<string, boolean>>(
    {},
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    tab: 'ai' | 'products' | 'schedule';
  }>({ open: false, tab: 'ai' });

  const timerNotifiedRef = useRef<number | null>(null);
  const saveDebounceRef = useRef<number | null>(null);
  const skipNextSaveRef = useRef<boolean>(false);
  const todayStr = getTodayStr();

  // Restore existing session + global product catalog on mount
  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      const savedToken = loadSessionToken();
      if (!savedToken) {
        if (!cancelled) setIsAuthLoading(false);
        return;
      }
      try {
        const res = await backend.restoreSession(savedToken);
        if (cancelled) return;
        if (res) {
          const loadedCatalog = await backend
            .listCatalog(savedToken)
            .catch(() => [...INITIAL_CATALOG_PRODUCTS]);
          if (cancelled) return;
          skipNextSaveRef.current = true;
          setCatalog(loadedCatalog);
          setSessionToken(savedToken);
          setCurrentUser(res.user);
          setWorkspace({
            ...res.data,
            plan: ensureNormalizedPlan(res.data.plan, loadedCatalog),
          });
          setCalmingTimerEnd(loadCalmingTimerEnd(res.user.id));
          setNotifiedToday(loadNotifiedToday(res.user.id));
        } else {
          saveSessionToken(null);
          setSessionToken(null);
        }
      } catch {
        if (!cancelled) {
          saveSessionToken(null);
          setSessionToken(null);
        }
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    };
    void initAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced sync to backend whenever workspace changes
  useEffect(() => {
    if (!sessionToken || !currentUser || !workspace) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    saveUserCache(currentUser.id, workspace);
    setSyncStatus('saving');

    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
    }

    const activeToken = sessionToken;
    const snapshot = workspace;
    saveDebounceRef.current = window.setTimeout(() => {
      backend
        .saveUserData(activeToken, snapshot)
        .then(() => setSyncStatus('saved'))
        .catch(() => setSyncStatus('error'));
    }, 350);

    return () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
      }
    };
  }, [workspace, sessionToken, currentUser]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const hasOpenModal = Boolean(
      selectedProduct ||
        selectedDayStr ||
        isSettingsOpen ||
        editorState.open,
    );
    document.body.style.overflow = hasOpenModal ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedProduct, selectedDayStr, isSettingsOpen, editorState.open]);

  // Foreground notification scheduler + wait timer alert
  useEffect(() => {
    if (!currentUser || !workspace) return;

    const checkTimersAndReminders = () => {
      const now = Date.now();

      if (
        calmingTimerEnd &&
        now >= calmingTimerEnd &&
        timerNotifiedRef.current !== calmingTimerEnd
      ) {
        timerNotifiedRef.current = calmingTimerEnd;
        playSoftChime();
        void showAppNotification(
          'Tempo de espera concluído!',
          'Você já pode aplicar o próximo passo da sua rotina.',
          'calming-timer-done',
        );
      }

      if (!workspace.settings.webNotificationsEnabled) return;

      const d = new Date();
      const currentToday = getTodayStr();
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes(),
      ).padStart(2, '0')}`;
      const dayPlan = getDayPlan(
        currentToday,
        workspace.settings,
        workspace.plan,
        catalog,
      );
      if (dayPlan.phase === 0) return;

      const morningKey = `${currentToday}-morning-${workspace.settings.morningTime}`;
      const nightKey = `${currentToday}-night-${workspace.settings.nightTime}`;
      const todayComp = workspace.completions[currentToday];

      if (
        hhmm === workspace.settings.morningTime &&
        !notifiedToday[morningKey] &&
        !todayComp?.morningDone
      ) {
        const nextMap = { ...notifiedToday, [morningKey]: true };
        setNotifiedToday(nextMap);
        saveNotifiedToday(currentUser.id, nextMap);
        void showAppNotification(
          `Skincare da Manhã (${workspace.settings.morningTime})`,
          `Dia ${dayPlan.dayNumber}/${dayPlan.totalDays} • Hora da sua rotina matinal!`,
          morningKey,
        );
      }

      if (
        hhmm === workspace.settings.nightTime &&
        !notifiedToday[nightKey] &&
        !todayComp?.nightDone
      ) {
        const nextMap = { ...notifiedToday, [nightKey]: true };
        setNotifiedToday(nextMap);
        saveNotifiedToday(currentUser.id, nextMap);
        void showAppNotification(
          `Skincare ${dayPlan.nightLabel} (${workspace.settings.nightTime})`,
          `Dia ${dayPlan.dayNumber}/${dayPlan.totalDays} • ${dayPlan.nightSubtitle}`,
          nightKey,
        );
      }
    };

    checkTimersAndReminders();
    const intervalId = window.setInterval(checkTimersAndReminders, 15_000);
    return () => window.clearInterval(intervalId);
  }, [currentUser, workspace, catalog, calmingTimerEnd, notifiedToday]);

  const handleLogin = async (username: string, password: string) => {
    const res = await backend.login(username, password);
    const loadedCatalog = await backend
      .listCatalog(res.token)
      .catch(() => [...INITIAL_CATALOG_PRODUCTS]);

    skipNextSaveRef.current = true;
    saveSessionToken(res.token);
    setCatalog(loadedCatalog);
    setSessionToken(res.token);
    setCurrentUser(res.user);
    setWorkspace({
      ...res.data,
      plan: ensureNormalizedPlan(res.data.plan, loadedCatalog),
    });
    setCalmingTimerEnd(loadCalmingTimerEnd(res.user.id));
    setNotifiedToday(loadNotifiedToday(res.user.id));
    setActiveTab('today');
    setSyncStatus('idle');
  };

  const handleLogout = async () => {
    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    const tok = sessionToken;
    saveSessionToken(null);
    setSessionToken(null);
    setCurrentUser(null);
    setWorkspace(null);
    setCatalog([...INITIAL_CATALOG_PRODUCTS]);
    setIsSettingsOpen(false);
    setSelectedDayStr(null);
    setSelectedProduct(null);
    setEditorState({ open: false, tab: 'ai' });
    setSyncStatus('idle');
    if (tok) {
      await backend.logout(tok).catch(() => {});
    }
  };

  const handleToggleStep = (
    dateStr: string,
    period: Period,
    productId: ProductId,
    allStepIds: ProductId[],
  ) => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      const current = prev.completions[dateStr] ?? EMPTY_COMPLETION;
      const listKey = period === 'morning' ? 'morningSteps' : 'nightSteps';
      const doneKey = period === 'morning' ? 'morningDone' : 'nightDone';

      const currentSteps = current[doneKey]
        ? [...allStepIds]
        : [...current[listKey]];
      const exists = currentSteps.includes(productId);
      const nextSteps = exists
        ? currentSteps.filter((id) => id !== productId)
        : [...currentSteps, productId];

      const allChecked =
        allStepIds.length > 0 &&
        allStepIds.every((id) => nextSteps.includes(id));

      return {
        ...prev,
        completions: {
          ...prev.completions,
          [dateStr]: {
            ...current,
            [listKey]: nextSteps,
            [doneKey]: allChecked,
          },
        },
      };
    });
  };

  const handleTogglePeriod = (dateStr: string, period: Period) => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      const dayPlan = getDayPlan(dateStr, prev.settings, prev.plan, catalog);
      const stepIds = (
        period === 'morning' ? dayPlan.morningSteps : dayPlan.nightSteps
      ).map((s) => s.productId);

      const current = prev.completions[dateStr] ?? EMPTY_COMPLETION;
      const listKey = period === 'morning' ? 'morningSteps' : 'nightSteps';
      const doneKey = period === 'morning' ? 'morningDone' : 'nightDone';
      const nextDone = !current[doneKey];

      return {
        ...prev,
        completions: {
          ...prev.completions,
          [dateStr]: {
            ...current,
            [doneKey]: nextDone,
            [listKey]: nextDone ? stepIds : [],
          },
        },
      };
    });
  };

  const handleStartTimer = (durationSeconds: number) => {
    if (!currentUser) return;
    timerNotifiedRef.current = null;
    const end = Date.now() + durationSeconds * 1000;
    setCalmingTimerEnd(end);
    saveCalmingTimerEnd(currentUser.id, end);
  };

  const handleStopTimer = () => {
    if (!currentUser) return;
    setCalmingTimerEnd(null);
    saveCalmingTimerEnd(currentUser.id, null);
  };

  const handleUpdateSettings = (nextSettings: AppSettings) => {
    setWorkspace((prev) => (prev ? { ...prev, settings: nextSettings } : prev));
  };

  const handleSavePlan = (nextPlan: SkincarePlan) => {
    setWorkspace((prev) =>
      prev
        ? { ...prev, plan: ensureNormalizedPlan(nextPlan, catalog) }
        : prev,
    );
  };

  const handleUpsertCatalogProducts = useCallback(
    async (products: CatalogProductInput[]) => {
      if (!sessionToken) throw new Error('Sessão expirada.');
      const res = await backend.upsertCatalogProducts(sessionToken, products);
      setCatalog(res.catalog);
      return res;
    },
    [sessionToken],
  );

  const handleUpdateCatalogProduct = useCallback(
    async (product: CatalogProductInput) => {
      if (!sessionToken) throw new Error('Sessão expirada.');
      const nextCatalog = await backend.updateCatalogProduct(
        sessionToken,
        product,
      );
      setCatalog(nextCatalog);
      return nextCatalog;
    },
    [sessionToken],
  );

  const handleResetProgress = () => {
    if (!currentUser) return;
    setCalmingTimerEnd(null);
    saveCalmingTimerEnd(currentUser.id, null);
    setWorkspace((prev) => (prev ? { ...prev, completions: {} } : prev));
  };

  const handleChangePassword = useCallback(
    async (currentPwd: string, newPwd: string) => {
      if (!sessionToken) throw new Error('Sessão expirada.');
      await backend.changePassword(sessionToken, currentPwd, newPwd);
    },
    [sessionToken],
  );

  const handleAdminListUsers = useCallback(async () => {
    if (!sessionToken) throw new Error('Sessão expirada.');
    return backend.adminListUsers(sessionToken);
  }, [sessionToken]);

  const handleAdminCreateUser = useCallback(
    async (input: CreateUserInput) => {
      if (!sessionToken) throw new Error('Sessão expirada.');
      return backend.adminCreateUser(sessionToken, input);
    },
    [sessionToken],
  );

  const handleAdminResetPassword = useCallback(
    async (targetUserId: string, newPwd: string) => {
      if (!sessionToken) throw new Error('Sessão expirada.');
      await backend.adminResetPassword(sessionToken, targetUserId, newPwd);
    },
    [sessionToken],
  );

  const handleAdminDeleteUser = useCallback(
    async (targetUserId: string) => {
      if (!sessionToken) throw new Error('Sessão expirada.');
      await backend.adminDeleteUser(sessionToken, targetUserId);
    },
    [sessionToken],
  );

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#FBF7F2] flex items-center justify-center">
        <div className="text-center space-y-3">
          <img
            src="/lumera-logo.png"
            alt="Lumera"
            className="h-10 w-auto mx-auto object-contain animate-pulse"
          />
          <p className="text-xs font-semibold text-[#755D52]">
            Carregando sua rotina...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser || !workspace || !sessionToken) {
    return <LoginView backendMode={backend.mode} onLogin={handleLogin} />;
  }

  const todayPlan = getDayPlan(
    todayStr,
    workspace.settings,
    workspace.plan,
    catalog,
  );
  const todayCompletion = workspace.completions[todayStr];
  const todayPendingCount =
    todayPlan.phase === 0
      ? 0
      : (todayCompletion?.morningDone ? 0 : 1) +
        (todayCompletion?.nightDone ? 0 : 1);

  return (
    <div className="min-h-screen bg-[#FBF7F2] text-[#261610] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-[#FBF7F2]/92 backdrop-blur-md border-b border-[#EFE5DC]/90">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <img
              src="/lumera-logo.png"
              alt="Lumera"
              className="h-6 w-auto object-contain"
            />
            <p className="text-[11px] font-medium text-[#755D52] mt-1 leading-none flex items-center gap-1.5 truncate">
              <span className="truncate font-semibold text-[#5A2C1C]">
                {workspace.plan.name}
              </span>
              <span>•</span>
              <span>@{currentUser.username}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                {backend.mode === 'supabase' ? (
                  <Cloud className="w-3 h-3 text-emerald-600" />
                ) : (
                  <HardDrive className="w-3 h-3 text-[#B86A4C]" />
                )}
                {syncStatus === 'saving'
                  ? 'Salvando...'
                  : syncStatus === 'error'
                    ? 'Erro ao sincronizar'
                    : backend.mode === 'supabase'
                      ? 'Nuvem'
                      : 'Local'}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Abrir ajustes e notificações"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#EFE5DC] text-xs font-semibold text-[#261610] hover:border-[#B86A4C]/60 shadow-2xs shrink-0 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[#5A2C1C]" />
            <span>Ajustes</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-28">
        {activeTab === 'today' && (
          <TodayView
            todayStr={todayStr}
            displayName={currentUser.displayName}
            plan={workspace.plan}
            catalog={catalog}
            settings={workspace.settings}
            completion={todayCompletion}
            calmingTimerEnd={calmingTimerEnd}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            onSelectProduct={setSelectedProduct}
            onToggleStep={handleToggleStep}
            onTogglePeriod={handleTogglePeriod}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            todayStr={todayStr}
            plan={workspace.plan}
            catalog={catalog}
            settings={workspace.settings}
            completions={workspace.completions}
            onSelectDay={setSelectedDayStr}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            todayStr={todayStr}
            plan={workspace.plan}
            catalog={catalog}
            settings={workspace.settings}
            completions={workspace.completions}
            onSelectProduct={setSelectedProduct}
            onOpenEditor={(tab = 'ai') => setEditorState({ open: true, tab })}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        todayPendingCount={todayPendingCount}
      />

      <DayDetailModal
        dateStr={selectedDayStr}
        todayStr={todayStr}
        plan={workspace.plan}
        catalog={catalog}
        settings={workspace.settings}
        completion={
          selectedDayStr ? workspace.completions[selectedDayStr] : undefined
        }
        onClose={() => setSelectedDayStr(null)}
        onSelectProduct={setSelectedProduct}
        onTogglePeriod={handleTogglePeriod}
      />

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <RoutineEditorModal
        isOpen={editorState.open}
        plan={workspace.plan}
        catalog={catalog}
        initialTab={editorState.tab}
        onClose={() => setEditorState((s) => ({ ...s, open: false }))}
        onSavePlan={handleSavePlan}
        onUpsertCatalogProducts={handleUpsertCatalogProducts}
        onUpdateCatalogProduct={handleUpdateCatalogProduct}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        currentUser={currentUser}
        backendMode={backend.mode}
        plan={workspace.plan}
        catalog={catalog}
        settings={workspace.settings}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onResetProgress={handleResetProgress}
        onOpenEditor={(tab = 'ai') => setEditorState({ open: true, tab })}
        onChangePassword={handleChangePassword}
        onLogout={handleLogout}
        onAdminListUsers={handleAdminListUsers}
        onAdminCreateUser={handleAdminCreateUser}
        onAdminResetPassword={handleAdminResetPassword}
        onAdminDeleteUser={handleAdminDeleteUser}
      />
    </div>
  );
}

export default App;
