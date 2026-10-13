import React, { useState, useRef } from 'react';
import { Settings, Trade, InstrumentConfig } from '../types/trade';
import { exportBackupJSON, parseBackupJSON } from '../utils/storage';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Shield,
  RotateCcw,
  Check,
  AlertTriangle,
  Lock,
  DollarSign,
  FileSpreadsheet,
  Info,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface SettingsBackupProps {
  settings: Settings;
  trades: Trade[];
  user?: User | null;
  isSyncing?: boolean;
  onUpdateSettings: (newSettings: Settings) => void;
  onRestoreBackup: (trades: Trade[], settings?: Settings) => void;
  onResetToSampleTrades: () => void;
  onClearAllTrades: () => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onSyncLocalToCloud?: () => Promise<void>;
}

export const SettingsBackup: React.FC<SettingsBackupProps> = ({
  settings,
  trades,
  user,
  isSyncing,
  onUpdateSettings,
  onRestoreBackup,
  onResetToSampleTrades,
  onClearAllTrades,
  onSignIn,
  onSignOut,
  onSyncLocalToCloud,
}) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInstrumentChange = (
    symbol: string,
    field: keyof InstrumentConfig,
    val: number
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      instruments: {
        ...prev.instruments,
        [symbol]: {
          ...prev.instruments[symbol],
          [field]: val,
        },
      },
    }));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(localSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleExportBackup = () => {
    exportBackupJSON(trades, settings);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    setRestoreSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = parseBackupJSON(content);
      if (result.success && result.trades) {
        onRestoreBackup(result.trades, result.settings);
        setRestoreSuccess(
          `Copia de seguridad restaurada exitosamente con ${result.trades.length} operaciones.`
        );
      } else {
        setRestoreError(result.error || 'Error al procesar el archivo de respaldo.');
      }
    };
    reader.onerror = () => {
      setRestoreError('Error al leer el archivo seleccionado.');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span>Configuración, Privacidad y Copias de Seguridad</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Tus datos se almacenan de manera 100% privada y local en tu navegador con opción de sincronización en la nube gratuita (Firebase Firestore).
        </p>
      </div>

      {/* Cloud Persistence & Multi-device Sync */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Sincronización en la Nube (Firebase Firestore)
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
            Plan Spark 100% Gratuito ($0 USD)
          </span>
        </div>

        {user ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">{user.email}</p>
                  <p className="text-[11px] text-emerald-800 flex items-center gap-1.5 mt-0.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse"></span>
                    Conectado · Sincronización en tiempo real activa entre PC y celular
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onSyncLocalToCloud && (
                  <button
                    type="button"
                    disabled={isPushing || isSyncing}
                    onClick={async () => {
                      setIsPushing(true);
                      setSyncMessage(null);
                      try {
                        await onSyncLocalToCloud();
                        setSyncMessage('¡Operaciones locales sincronizadas exitosamente a la nube!');
                        setTimeout(() => setSyncMessage(null), 3500);
                      } catch (err: any) {
                        setSyncMessage('Error al sincronizar: ' + (err.message || 'Intente nuevamente'));
                      } finally {
                        setIsPushing(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-[#0f1f38] hover:bg-[#1a365d] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-blue-300 ${isPushing || isSyncing ? 'animate-spin' : ''}`} />
                    <span>Forzar Subida a Nube</span>
                  </button>
                )}
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                )}
              </div>
            </div>

            {syncMessage && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] block font-medium">Aislamiento de Seguridad</span>
                <span className="font-semibold text-emerald-700 text-xs mt-0.5 block">Solo tú tienes acceso</span>
                <p className="text-[10px] text-slate-500 mt-1">Reglas Zero-Trust: nadie más puede ver tus números o psicología.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] block font-medium">Límite Diario Gratuito</span>
                <span className="font-semibold text-slate-900 text-xs mt-0.5 block">50,000 lecturas / 20k escrituras</span>
                <p className="text-[10px] text-slate-500 mt-1">Holgura total para operativa personal diaria sin cargos.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[10px] block font-medium">Respaldo Local Permanente</span>
                <span className="font-semibold text-slate-900 text-xs mt-0.5 block">Caché Offline Activo</span>
                <p className="text-[10px] text-slate-500 mt-1">Si no tienes internet, sigues operando en tu navegador sin problemas.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Inicia sesión para sincronizar entre tu Computadora y tu Celular
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-lg">
                Conecta tu cuenta de Google para sincronizar el diario con Firebase Firestore. Al iniciar sesión, la lista de la nube reemplaza el caché local; la sincronización manual reemplaza la colección completa.
              </p>
            </div>
            {onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="px-4 py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs active:scale-95"
              >
                <LogIn className="w-4 h-4 text-blue-300" />
                <span>Conectar con Google</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Free & Private Guarantee Banner */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-start gap-3">
        <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h2 className="font-bold text-slate-900 text-sm">
            Privacidad Total y Gratuita
          </h2>
          <p className="text-slate-600 leading-relaxed font-sans">
            Esta aplicación opera de forma cliente-servidor aislada y privada en tu dispositivo. Ningún dato financiero o personal se envía a terceros ni se indexa públicamente. No requiere tarjeta de crédito ni suscripciones pagas.
          </p>
        </div>
      </div>

      {/* 1. Point Values Configuration */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span>1. Configuración de Valor por Punto de Futuros</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              Valores oficiales por contrato
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* MNQ Configuration */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 font-mono">
                  MNQ (Micro E-mini Nasdaq-100)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Índice</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor por Punto Entero (USD)
                </label>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={localSettings.instruments['MNQ']?.pointValue ?? 2.0}
                    onChange={(e) =>
                      handleInstrumentChange('MNQ', 'pointValue', Number(e.target.value))
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                  <span className="text-slate-500 text-xs whitespace-nowrap">/ punto</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Estándar CME: $2.00 USD (Tick de 0.25 = $0.50)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Comisión Estimada por Contrato (USD round-turn)
                </label>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={localSettings.instruments['MNQ']?.defaultCommission ?? 1.24}
                    onChange={(e) =>
                      handleInstrumentChange('MNQ', 'defaultCommission', Number(e.target.value))
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                  <span className="text-slate-500 text-xs whitespace-nowrap">/ ct</span>
                </div>
              </div>
            </div>

            {/* MGC Configuration */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 font-mono">
                  MGC (Micro Gold / Micro Oro)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Metal</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor por Punto Entero (USD)
                </label>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={localSettings.instruments['MGC']?.pointValue ?? 10.0}
                    onChange={(e) =>
                      handleInstrumentChange('MGC', 'pointValue', Number(e.target.value))
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                  <span className="text-slate-500 text-xs whitespace-nowrap">/ punto</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Estándar COMEX: $10.00 USD ($1.00 de movimiento = $10.00)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Comisión Estimada por Contrato (USD round-turn)
                </label>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={localSettings.instruments['MGC']?.defaultCommission ?? 1.50}
                    onChange={(e) =>
                      handleInstrumentChange('MGC', 'defaultCommission', Number(e.target.value))
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                  <span className="text-slate-500 text-xs whitespace-nowrap">/ ct</span>
                </div>
              </div>
            </div>
          </div>

          {/* CSV Delimiter & Privacy mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Separador para Exportación CSV a Excel
              </label>
              <select
                value={localSettings.csvDelimiter}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    csvDelimiter: e.target.value as ';' | ',',
                  }))
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
              >
                <option value=";">Punto y coma ( ; ) - Recomendado para Excel en Español</option>
                <option value=",">Coma ( , ) - Estándar Internacional</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Modo Privado al Iniciar
              </label>
              <label className="flex items-center gap-2 mt-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.privacyMode}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      privacyMode: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
                />
                <span>Ocultar montos monetarios (PnL) por defecto</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Configuración guardada correctamente
              </span>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Guardar Configuración
            </button>
          </div>
        </div>
      </form>

      {/* 2. Backup & Restore Operations */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-600" />
            <span>2. Copias de Seguridad y Restauración</span>
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">Formato JSON Seguro</span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-sans">
          Descarga un archivo con todo tu historial de operaciones y parámetros para guardarlo en tu Google Drive, disco duro o enviártelo por correo. Puedes restaurarlo en cualquier momento o equipo.
        </p>

        {restoreSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{restoreSuccess}</span>
          </div>
        )}

        {restoreError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{restoreError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Export JSON Button */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Descargar Copia de Seguridad</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Genera un archivo de respaldo con tus {trades.length} operaciones actuales.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-blue-300" />
              <span>Descargar Archivo JSON</span>
            </button>
          </div>

          {/* Import JSON Button */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Restaurar desde Respaldo</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Selecciona un archivo JSON generado previamente para recuperar tus datos.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
              >
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Cargar Archivo de Respaldo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Journal Maintenance */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>3. Mantenimiento del diario</span>
        </h2>
        <p className="text-[11px] text-slate-500 max-w-lg">
          El diario empieza vacío, sin operaciones ficticias. Puedes borrar las operaciones del navegador y de la nube para comenzar desde cero.
        </p>
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-rose-700">Borrar todas las operaciones</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Elimina las operaciones de esta cuenta en el navegador y en Firebase.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
          >
            Limpiar Diario
          </button>
        </div>
      </div>
      {/* Confirmation Modal to Clear All Trades */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  ¿Borrar todas las operaciones?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Esta acción eliminará todas las operaciones registradas para comenzar el diario desde cero. Asegúrate de haber descargado una copia de seguridad JSON previamente si deseas conservar tus datos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  onClearAllTrades();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                Sí, Limpiar Diario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
