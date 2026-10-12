import React, { useState } from 'react';
import { Eye, EyeOff, Plus, Cloud, LogIn, LogOut, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  currentTab: 'dashboard' | 'coach' | 'new-trade' | 'history' | 'verifier' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'coach' | 'new-trade' | 'history' | 'verifier' | 'settings') => void;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  tradeCount: number;
  user: User | null;
  isSyncing: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  privacyMode,
  onTogglePrivacy,
  tradeCount,
  user,
  isSyncing,
  onSignIn,
  onSignOut,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#0f1f38] text-white border-b border-[#1e3a5f] px-4 lg:px-8 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('dashboard')}
            className="text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
          >
            <span className="text-base font-bold tracking-tight text-white group-hover:text-blue-200 transition-colors whitespace-nowrap">
              FUTUROS <span className="text-blue-300 font-mono">MNQ</span> & <span className="text-amber-300 font-mono">MGC</span>
            </span>
            <span className="hidden sm:inline text-xs text-slate-300 ml-2 font-medium tracking-normal">
              · Diario Privado
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium text-slate-200">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`whitespace-nowrap transition-colors px-3 py-1.5 rounded-lg cursor-pointer ${
              currentTab === 'dashboard'
                ? 'text-white bg-[#1e3a5f] font-semibold border border-[#2b4c7e] shadow-xs'
                : 'hover:text-white hover:bg-[#162e4e]'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab('coach')}
            className={`whitespace-nowrap transition-colors px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'coach'
                ? 'text-white bg-[#1e3a5f] font-semibold border border-[#2b4c7e] shadow-xs'
                : 'hover:text-white hover:bg-[#162e4e]'
            }`}
          >
            <span>Trading Coach</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-900/80 border border-blue-500/50 text-blue-200 font-medium">
              Gemini
            </span>
          </button>
          <button
            onClick={() => onSelectTab('history')}
            className={`whitespace-nowrap transition-colors px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'history'
                ? 'text-white bg-[#1e3a5f] font-semibold border border-[#2b4c7e] shadow-xs'
                : 'hover:text-white hover:bg-[#162e4e]'
            }`}
          >
            Historial ({tradeCount})
          </button>
          <button
            onClick={() => onSelectTab('verifier')}
            className={`whitespace-nowrap transition-colors px-3 py-1.5 rounded-lg cursor-pointer ${
              currentTab === 'verifier'
                ? 'text-white bg-[#1e3a5f] font-semibold border border-[#2b4c7e] shadow-xs'
                : 'hover:text-white hover:bg-[#162e4e]'
            }`}
          >
            Auditor de Fórmulas
          </button>
          <button
            onClick={() => onSelectTab('settings')}
            className={`whitespace-nowrap transition-colors px-3 py-1.5 rounded-lg cursor-pointer ${
              currentTab === 'settings'
                ? 'text-white bg-[#1e3a5f] font-semibold border border-[#2b4c7e] shadow-xs'
                : 'hover:text-white hover:bg-[#162e4e]'
            }`}
          >
            Ajustes & Backup
          </button>
        </nav>

        {/* Zone 3: Primary Action, Cloud Auth & Privacy Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Cloud Sync & Auth Button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#2b4c7e] bg-[#162e4e] text-slate-100 text-xs hover:bg-[#1e3a5f] transition-colors cursor-pointer"
                title={`Conectado como ${user.email}. Sincronizado en la nube.`}
              >
                {isSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-blue-300" />
                )}
                <span className="hidden sm:inline font-mono text-[11px] max-w-[120px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50 text-xs text-slate-800">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-slate-500 text-[10px]">Cuenta conectada</p>
                    <p className="text-slate-900 font-semibold truncate">{user.email}</p>
                    <p className="text-emerald-700 text-[10px] mt-1 flex items-center gap-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      Sincronización PC y Celular Activa
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSelectTab('settings');
                    }}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Ver estado de la nube en Ajustes
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-2 text-rose-700 hover:bg-rose-50 transition-colors flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#2b4c7e] bg-[#162e4e] text-slate-200 hover:text-white hover:bg-[#1e3a5f] text-xs font-medium transition-colors cursor-pointer"
              title="Iniciar sesión con Google para sincronizar tus operaciones entre tu computadora y tu celular"
            >
              <LogIn className="w-3.5 h-3.5 text-blue-300" />
              <span className="hidden sm:inline">Conectar Nube</span>
            </button>
          )}

          {/* Privacy Toggle */}
          <button
            onClick={onTogglePrivacy}
            title={privacyMode ? 'Mostrar montos' : 'Ocultar montos (Modo Privado)'}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              privacyMode
                ? 'bg-amber-900/30 border-amber-500/50 text-amber-200'
                : 'bg-[#162e4e] border-[#2b4c7e] text-slate-200 hover:bg-[#1e3a5f] hover:text-white'
            }`}
          >
            {privacyMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Privado</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Visible</span>
              </>
            )}
          </button>

          {/* Register Trade Button */}
          <button
            onClick={() => onSelectTab('new-trade')}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar Operación</span>
            <span className="sm:hidden">Nuevo Trade</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around pt-2.5 mt-2.5 border-t border-[#1e3a5f] text-xs">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`py-1 px-2 rounded ${currentTab === 'dashboard' ? 'text-white font-bold bg-[#1e3a5f]' : 'text-slate-300'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectTab('coach')}
          className={`py-1 px-2 rounded ${currentTab === 'coach' ? 'text-white font-bold bg-[#1e3a5f]' : 'text-slate-300'}`}
        >
          Coach AI
        </button>
        <button
          onClick={() => onSelectTab('history')}
          className={`py-1 px-2 rounded ${currentTab === 'history' ? 'text-white font-bold bg-[#1e3a5f]' : 'text-slate-300'}`}
        >
          Historial ({tradeCount})
        </button>
        <button
          onClick={() => onSelectTab('verifier')}
          className={`py-1 px-2 rounded ${currentTab === 'verifier' ? 'text-white font-bold bg-[#1e3a5f]' : 'text-slate-300'}`}
        >
          Fórmulas
        </button>
        <button
          onClick={() => onSelectTab('settings')}
          className={`py-1 px-2 rounded ${currentTab === 'settings' ? 'text-white font-bold bg-[#1e3a5f]' : 'text-slate-300'}`}
        >
          Ajustes
        </button>
      </div>
    </header>
  );
};
