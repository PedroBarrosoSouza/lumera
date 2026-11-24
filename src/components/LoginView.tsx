import {
  Cloud,
  Eye,
  EyeOff,
  HardDrive,
  Lock,
  LogIn,
  User,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface LoginViewProps {
  backendMode: 'supabase' | 'local';
  onLogin: (username: string, password: string) => Promise<void>;
}

export function LoginView({ backendMode, onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password) {
      setErrorMsg('Preencha usuário e senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível entrar.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF7F2] text-[#261610] flex flex-col justify-center px-4 py-8">
      <div className="w-full max-w-md mx-auto space-y-5">
        {/* Branding */}
        <div className="text-center space-y-2.5">
          <img
            src="/lumera-logo.png"
            alt="Lumera"
            className="h-12 sm:h-14 w-auto mx-auto object-contain drop-shadow-xs"
          />
          <p className="text-sm text-[#755D52]">
            Entre para acessar seu calendário, produtos e rotina pessoal
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white border border-[#EFE5DC] p-6 shadow-sm space-y-4"
        >
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-bold uppercase tracking-wider text-[#755D52] mb-1.5"
            >
              Usuário
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#947C70] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="ex.: pedro ou sabrina"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#DFCFC2] bg-[#FBF7F2] text-sm font-semibold text-[#261610] placeholder:text-[#B39D91] focus:outline-hidden focus:border-[#5A2C1C] focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-bold uppercase tracking-wider text-[#755D52] mb-1.5"
            >
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#947C70] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-3 rounded-2xl border border-[#DFCFC2] bg-[#FBF7F2] text-sm font-semibold text-[#261610] placeholder:text-[#B39D91] focus:outline-hidden focus:border-[#5A2C1C] focus:bg-white transition-colors"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#947C70] hover:text-[#261610] cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-800"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#5A2C1C] hover:bg-[#3D1C11] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-[#5A2C1C]/20"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'Entrando...' : 'Entrar no meu plano'}
          </button>
        </form>

        {/* Connection Mode Status */}
        <div className="rounded-2xl bg-white/80 border border-[#EFE5DC] p-3.5 text-xs text-[#755D52] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#261610]">
              {backendMode === 'supabase' ? (
                <>
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  Sincronizado na nuvem (Supabase)
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-amber-600" />
                  Modo Local (este dispositivo)
                </>
              )}
            </span>
          </div>

          {backendMode === 'local' ? (
            <p className="text-[11px] leading-relaxed text-[#755D52]">
              Usuários iniciais: <strong>pedro</strong> (Admin) e{' '}
              <strong>sabrina</strong>, senha inicial <strong>123</strong>. Para
              sincronizar entre celulares no Vercel, configure as variáveis do
              Supabase (veja <code>SETUP_SUPABASE.md</code>).
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#755D52]">
              Seus produtos, calendário e histórico ficam salvos na sua conta em
              qualquer celular. Você pode alterar a senha em{' '}
              <strong>Ajustes</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
