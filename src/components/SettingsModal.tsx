import {
  Bell,
  Bot,
  CalendarPlus,
  Clock,
  Edit3,
  KeyRound,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { resolvePlanProducts } from '../data/skincareData';
import type { CreateUserInput } from '../services/backend';
import type {
  AdminUserSummary,
  AppSettings,
  CatalogProduct,
  LaserSession,
  SkincarePlan,
  UserProfile,
  UserRole,
} from '../types';
import { getMondayOfWeek, getTodayStr } from '../utils/dateUtils';
import { downloadICS } from '../utils/ics';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showAppNotification,
} from '../utils/notifications';

interface SettingsModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  backendMode: 'supabase' | 'local';
  plan: SkincarePlan;
  catalog: CatalogProduct[];
  settings: AppSettings;
  onClose: () => void;
  onUpdateSettings: (next: AppSettings) => void;
  onResetProgress: () => void;
  onOpenEditor: (tab?: 'ai' | 'products' | 'schedule') => void;
  onChangePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  onLogout: () => void;
  onAdminListUsers: () => Promise<AdminUserSummary[]>;
  onAdminCreateUser: (input: CreateUserInput) => Promise<AdminUserSummary>;
  onAdminResetPassword: (
    targetUserId: string,
    newPassword: string,
  ) => Promise<void>;
  onAdminDeleteUser: (targetUserId: string) => Promise<void>;
}

export function SettingsModal({
  isOpen,
  currentUser,
  backendMode,
  plan,
  catalog,
  settings,
  onClose,
  onUpdateSettings,
  onResetProgress,
  onOpenEditor,
  onChangePassword,
  onLogout,
  onAdminListUsers,
  onAdminCreateUser,
  onAdminResetPassword,
  onAdminDeleteUser,
}: SettingsModalProps) {
  const [laserDate, setLaserDate] = useState(() => getTodayStr());
  const [daysBefore, setDaysBefore] = useState(10);
  const [daysAfter, setDaysAfter] = useState(7);
  const [notifStatusMsg, setNotifStatusMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdFeedback, setPwdFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [isSavingPwd, setIsSavingPwd] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [newUserTemplate, setNewUserTemplate] = useState<'creamy' | 'simple'>(
    'simple',
  );
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [resetPwdTargetId, setResetPwdTargetId] = useState<string | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmReset(false);
    setPwdFeedback(null);
    setAdminError(null);
    setAdminSuccess(null);

    if (currentUser.role === 'admin') {
      setAdminLoading(true);
      onAdminListUsers()
        .then((users) => setAdminUsers(users))
        .catch((err) =>
          setAdminError(
            err instanceof Error ? err.message : 'Erro ao listar usuários.',
          ),
        )
        .finally(() => setAdminLoading(false));
    }
  }, [isOpen, currentUser.role, onAdminListUsers]);

  if (!isOpen) return null;

  const permission = getNotificationPermission();
  const planProductCount = resolvePlanProducts(plan, catalog).length;

  const handleToggleWebNotifications = async () => {
    if (settings.webNotificationsEnabled) {
      onUpdateSettings({ ...settings, webNotificationsEnabled: false });
      setNotifStatusMsg('Notificações no navegador desativadas.');
      return;
    }

    const res = await requestNotificationPermission();
    if (res === 'granted') {
      onUpdateSettings({ ...settings, webNotificationsEnabled: true });
      setNotifStatusMsg(
        'Permissão concedida! Os lembretes aparecerão nos horários configurados quando o app estiver aberto.',
      );
    } else if (res === 'denied') {
      setNotifStatusMsg(
        'Permissão bloqueada pelo navegador. Para celular Android fechado, recomendamos usar o arquivo .ics no Google Agenda abaixo.',
      );
    } else {
      setNotifStatusMsg(
        'Navegador sem suporte ou aguardando permissão. Use o Google Agenda (.ics) abaixo para notificações garantidas no Android.',
      );
    }
  };

  const handleTestNotification = async () => {
    const res = await requestNotificationPermission();
    if (res !== 'granted') {
      setNotifStatusMsg(
        'Ative a permissão de notificação no navegador para testar.',
      );
      return;
    }
    const ok = await showAppNotification(
      `${plan.name} • Lembrete`,
      `Horário configurado: Manhã ${settings.morningTime} e Noite ${settings.nightTime}.`,
      'test-notification',
    );
    setNotifStatusMsg(
      ok
        ? 'Notificação de teste enviada!'
        : 'Não foi possível exibir a notificação neste ambiente.',
    );
  };

  const handleAddLaserSession = () => {
    if (!laserDate) return;
    const newSession: LaserSession = {
      id: `${laserDate}-${Date.now()}`,
      date: laserDate,
      daysBefore,
      daysAfter,
    };
    onUpdateSettings({
      ...settings,
      laserSessions: [...settings.laserSessions, newSession].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    });
  };

  const handleRemoveLaserSession = (id: string) => {
    onUpdateSettings({
      ...settings,
      laserSessions: settings.laserSessions.filter((s) => s.id !== id),
    });
  };

  const handleSubmitPasswordChange = async () => {
    setPwdFeedback(null);
    if (!currentPwd || !newPwd) {
      setPwdFeedback({ ok: false, text: 'Preencha a senha atual e a nova.' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdFeedback({
        ok: false,
        text: 'A confirmação da nova senha não confere.',
      });
      return;
    }
    setIsSavingPwd(true);
    try {
      await onChangePassword(currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setShowChangePassword(false);
      setPwdFeedback({ ok: true, text: 'Senha alterada com sucesso!' });
    } catch (err) {
      setPwdFeedback({
        ok: false,
        text:
          err instanceof Error ? err.message : 'Erro ao alterar sua senha.',
      });
    } finally {
      setIsSavingPwd(false);
    }
  };

  const handleCreateUser = async () => {
    setAdminError(null);
    setAdminSuccess(null);
    if (!newUsername.trim() || !newUserPassword.trim()) {
      setAdminError('Preencha o login do usuário e a senha inicial.');
      return;
    }
    setIsCreatingUser(true);
    try {
      const created = await onAdminCreateUser({
        username: newUsername.trim(),
        displayName: newDisplayName.trim() || newUsername.trim(),
        password: newUserPassword,
        role: newUserRole,
        starterTemplate: newUserTemplate,
      });
      setAdminUsers((prev) => [...prev, created]);
      setNewUsername('');
      setNewDisplayName('');
      setNewUserPassword('123');
      setAdminSuccess(`Usuário "${created.username}" criado com sucesso!`);
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : 'Erro ao criar usuário.',
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleResetTargetPassword = async (targetId: string) => {
    setAdminError(null);
    setAdminSuccess(null);
    try {
      await onAdminResetPassword(targetId, resetPwdValue);
      setResetPwdTargetId(null);
      setResetPwdValue('');
      setAdminSuccess('Senha do usuário redefinida com sucesso.');
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : 'Erro ao redefinir senha.',
      );
    }
  };

  const handleDeleteTargetUser = async (targetId: string) => {
    setAdminError(null);
    setAdminSuccess(null);
    try {
      await onAdminDeleteUser(targetId);
      setAdminUsers((prev) => prev.filter((u) => u.id !== targetId));
      setDeleteConfirmId(null);
      setAdminSuccess('Usuário removido.');
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : 'Erro ao remover usuário.',
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#22120C]/50 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FBF7F2] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#EFE5DC] overflow-hidden animate-sheet-up max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white px-5 py-4 border-b border-[#EFE5DC] flex items-center justify-between">
          <div>
            <h2
              id="settings-modal-title"
              className="text-lg font-extrabold text-[#261610]"
            >
              Ajustes & Conta
            </h2>
            <p className="text-xs text-[#755D52]">
              Conta, rotina personalizada, notificações e laser
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ajustes"
            className="p-2 -mr-1 rounded-full text-[#856C60] hover:bg-[#F6EDE4] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto no-scrollbar">
          {/* Minha Conta */}
          <section className="rounded-2xl bg-white border border-[#EFE5DC] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#5A2C1C] text-white flex items-center justify-center font-extrabold text-sm shrink-0">
                  {currentUser.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-extrabold text-[#261610] truncate">
                      {currentUser.displayName}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        currentUser.role === 'admin'
                          ? 'bg-[#F7EAE0] text-[#5A2C1C]'
                          : 'bg-[#F6EDE4] text-[#755D52]'
                      }`}
                    >
                      {currentUser.role === 'admin' ? 'Admin' : 'Usuário'}
                    </span>
                  </div>
                  <p className="text-xs text-[#755D52]">
                    @{currentUser.username} •{' '}
                    {backendMode === 'supabase' ? 'Nuvem Supabase' : 'Modo Local'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowChangePassword((v) => !v);
                  setPwdFeedback(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5A2C1C] hover:underline cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {showChangePassword
                  ? 'Fechar alteração de senha'
                  : 'Alterar minha senha'}
              </button>

              {pwdFeedback && (
                <p
                  className={`mt-2 text-xs font-semibold px-3 py-2 rounded-xl ${
                    pwdFeedback.ok
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {pwdFeedback.text}
                </p>
              )}

              {showChangePassword && (
                <div className="mt-2.5 rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-3 space-y-2">
                  <input
                    type="password"
                    placeholder="Senha atual"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    className="w-full rounded-lg border border-[#DFCFC2] bg-white px-3 py-2 text-xs font-semibold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="password"
                      placeholder="Nova senha"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className="w-full rounded-lg border border-[#DFCFC2] bg-white px-3 py-2 text-xs font-semibold"
                    />
                    <input
                      type="password"
                      placeholder="Confirmar nova"
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      className="w-full rounded-lg border border-[#DFCFC2] bg-white px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSavingPwd}
                    onClick={handleSubmitPasswordChange}
                    className="w-full py-2 rounded-lg bg-[#5A2C1C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {isSavingPwd ? 'Salvando...' : 'Salvar nova senha'}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Meu Plano & Produtos */}
          <section className="rounded-2xl bg-white border border-[#EFE5DC] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[#261610]">
                  Meu Plano & Produtos
                </p>
                <p className="text-xs text-[#755D52]">
                  {plan.name} • {planProductCount} no seu plano ({catalog.length}{' '}
                  na base)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditor('ai');
                }}
                className="py-2.5 px-3 rounded-xl bg-[#5A2C1C] hover:bg-[#3D1C11] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                Importar do Gemini
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditor('products');
                }}
                className="py-2.5 px-3 rounded-xl bg-[#FBF7F2] border border-[#DFCFC2] text-[#261610] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-[#5A2C1C]" />
                Editar Manual
              </button>
            </div>
          </section>

          {/* Painel Administrativo */}
          {currentUser.role === 'admin' && (
            <section className="rounded-2xl bg-white border-2 border-[#5A2C1C]/30 p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#5A2C1C]">
                  <ShieldCheck className="w-4 h-4" />
                  Painel Administrativo
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F7EAE0] text-[#5A2C1C]">
                  Exclusivo Admin
                </span>
              </div>

              {adminError && (
                <p className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {adminError}
                </p>
              )}
              {adminSuccess && (
                <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  {adminSuccess}
                </p>
              )}

              <div className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-3 space-y-2.5">
                <p className="text-xs font-bold text-[#261610] flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[#5A2C1C]" />
                  Adicionar Novo Usuário
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nome (ex.: Maria)"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    autoCapitalize="none"
                    placeholder="Login (ex.: maria)"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Senha inicial"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs font-semibold"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="rounded-lg border border-[#DFCFC2] bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select
                    value={newUserTemplate}
                    onChange={(e) =>
                      setNewUserTemplate(e.target.value as 'creamy' | 'simple')
                    }
                    className="rounded-lg border border-[#DFCFC2] bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    <option value="simple">Modelo Básico</option>
                    <option value="creamy">Modelo Creamy</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isCreatingUser}
                  onClick={handleCreateUser}
                  className="w-full py-2 rounded-xl bg-[#5A2C1C] hover:bg-[#3D1C11] disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[#755D52] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Usuários Cadastrados ({adminUsers.length})
                </p>

                {adminLoading ? (
                  <p className="text-xs text-[#755D52]">Carregando...</p>
                ) : (
                  adminUsers.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-[#261610] truncate">
                              {u.displayName}
                            </p>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                u.role === 'admin'
                                  ? 'bg-[#F7EAE0] text-[#5A2C1C]'
                                  : 'bg-white border border-[#EFE5DC] text-[#755D52]'
                              }`}
                            >
                              {u.role === 'admin' ? 'Admin' : 'Usuário'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#755D52]">
                            @{u.username}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setResetPwdTargetId(
                                resetPwdTargetId === u.id ? null : u.id,
                              );
                              setResetPwdValue('');
                            }}
                            className="px-2 py-1 rounded-lg bg-white border border-[#DFCFC2] text-[11px] font-semibold text-[#261610] cursor-pointer"
                          >
                            Senha
                          </button>

                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              aria-label={`Excluir ${u.username}`}
                              onClick={() =>
                                setDeleteConfirmId(
                                  deleteConfirmId === u.id ? null : u.id,
                                )
                              }
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {resetPwdTargetId === u.id && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Nova senha"
                            value={resetPwdValue}
                            onChange={(e) => setResetPwdValue(e.target.value)}
                            className="flex-1 rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleResetTargetPassword(u.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#5A2C1C] text-white text-xs font-bold cursor-pointer"
                          >
                            Salvar
                          </button>
                        </div>
                      )}

                      {deleteConfirmId === u.id && (
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5">
                          <span className="text-[11px] font-semibold text-rose-900">
                            Excluir @{u.username}?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 rounded bg-white text-[11px] font-semibold cursor-pointer"
                            >
                              Não
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTargetUser(u.id)}
                              className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Sim, excluir
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Horários & Data de início */}
          <section className="rounded-2xl bg-white border border-[#EFE5DC] p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#261610]">
              <Clock className="w-4 h-4 text-[#5A2C1C]" />
              Horários e Início do Plano
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#755D52]">
                  Rotina da Manhã
                </span>
                <input
                  type="time"
                  value={settings.morningTime}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      morningTime: e.target.value || '07:30',
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] px-3 py-2 text-sm font-semibold text-[#261610] focus:outline-hidden focus:border-[#5A2C1C]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#755D52]">
                  Rotina da Noite
                </span>
                <input
                  type="time"
                  value={settings.nightTime}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      nightTime: e.target.value || '21:30',
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] px-3 py-2 text-sm font-semibold text-[#261610] focus:outline-hidden focus:border-[#5A2C1C]"
                />
              </label>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-xs font-semibold text-[#755D52]">
                  Data de Início (Dia 1 • Fase 1)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      startDate: getMondayOfWeek(getTodayStr()),
                    })
                  }
                  className="text-[11px] font-bold text-[#5A2C1C] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Segunda desta semana
                </button>
              </div>
              <input
                type="date"
                value={settings.startDate}
                onChange={(e) => {
                  if (e.target.value) {
                    onUpdateSettings({
                      ...settings,
                      startDate: e.target.value,
                    });
                  }
                }}
                className="mt-1 w-full rounded-xl border border-[#DFCFC2] bg-[#FBF7F2] px-3 py-2 text-sm font-semibold text-[#261610] focus:outline-hidden focus:border-[#5A2C1C]"
              />
            </div>
          </section>

          {/* Notificações no Celular */}
          <section className="rounded-2xl bg-white border border-[#EFE5DC] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#261610]">
              <Bell className="w-4 h-4 text-[#5A2C1C]" />
              Notificações no Celular (Android e iPhone)
            </div>

            <div className="rounded-xl bg-[#F7EAE0]/70 border border-[#5A2C1C]/20 p-3.5 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <CalendarPlus className="w-5 h-5 text-[#5A2C1C] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-[#5A2C1C]">
                    Lembretes garantidos no Google/Apple Agenda (.ics)
                  </p>
                  <p className="text-xs text-[#3E2920] mt-0.5 leading-relaxed">
                    Gera os {plan.totalDays * 2} eventos do seu plano nos seus
                    horários exatos, com alarme e lista de produtos do dia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadICS(settings, plan, catalog)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#5A2C1C] hover:bg-[#3D1C11] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4" />
                Baixar Calendário (.ics)
              </button>
            </div>

            <div className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#261610]">
                    Notificações diretas no PWA
                  </p>
                  <p className="text-[11px] text-[#755D52]">
                    Status:{' '}
                    {permission === 'granted'
                      ? 'Permitido'
                      : permission === 'denied'
                        ? 'Bloqueado'
                        : 'Aguardando'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleWebNotifications}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    settings.webNotificationsEnabled && permission === 'granted'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-[#DFCFC2] text-[#261610]'
                  }`}
                >
                  {settings.webNotificationsEnabled && permission === 'granted'
                    ? 'Ativado'
                    : 'Ativar'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="text-xs font-semibold text-[#5A2C1C] hover:underline cursor-pointer"
                >
                  Testar notificação agora
                </button>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#856C60]">
                  <Smartphone className="w-3.5 h-3.5" /> Instale na Tela Inicial
                </span>
              </div>

              {notifStatusMsg && (
                <p className="text-[11px] font-medium text-[#5A2C1C] bg-[#F7EAE0] px-2.5 py-1.5 rounded-lg">
                  {notifStatusMsg}
                </p>
              )}
            </div>
          </section>

          {/* Modo Depilação a Laser */}
          <section className="rounded-2xl bg-white border border-[#EFE5DC] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#261610]">
              <Zap className="w-4 h-4 text-amber-600" />
              Modo Depilação a Laser
            </div>
            <p className="text-xs text-[#755D52] leading-relaxed">
              Pausa automaticamente produtos marcados como ácido antes da sessão e
              ativa o protocolo calmante no dia e pós-laser.
            </p>

            <div className="rounded-xl bg-[#FBF7F2] border border-[#EFE5DC] p-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#755D52]">
                    Data da sessão
                  </span>
                  <input
                    type="date"
                    value={laserDate}
                    onChange={(e) => setLaserDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#261610]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-[#755D52]">
                    Dias antes (7–14)
                  </span>
                  <select
                    value={daysBefore}
                    onChange={(e) => setDaysBefore(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#261610]"
                  >
                    {[7, 8, 9, 10, 11, 12, 13, 14].map((d) => (
                      <option key={d} value={d}>
                        {d} dias antes
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-[#755D52]">
                    Dias depois (5–7)
                  </span>
                  <select
                    value={daysAfter}
                    onChange={(e) => setDaysAfter(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#DFCFC2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#261610]"
                  >
                    {[5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} dias depois
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddLaserSession}
                className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Adicionar sessão a laser
              </button>
            </div>

            {settings.laserSessions.length > 0 && (
              <div className="space-y-2">
                {settings.laserSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200"
                  >
                    <div>
                      <p className="text-xs font-bold text-amber-950">
                        Sessão: {session.date.split('-').reverse().join('/')}
                      </p>
                      <p className="text-[11px] text-amber-800">
                        Pausa {session.daysBefore}d antes • Pós-laser{' '}
                        {session.daysAfter}d depois
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remover sessão a laser"
                      onClick={() => handleRemoveLaserSession(session.id)}
                      className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-200/70 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Resetar progresso */}
          <section className="pt-1 pb-2">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Zerar marcações de progresso
              </button>
            ) : (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-rose-900">
                  Apagar todos os checks feitos?
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-xs font-semibold text-[#261610] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetProgress();
                      setConfirmReset(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
