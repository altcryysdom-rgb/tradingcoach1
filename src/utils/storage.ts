import { Trade, Settings, InstrumentConfig } from '../types/trade';
import { DEFAULT_INSTRUMENTS } from './calculations';

const STORAGE_KEY_TRADES = 'nexus_futures_trades_v1';
const STORAGE_KEY_SETTINGS = 'nexus_futures_settings_v1';

// IDs de las cuatro operaciones ficticias de versiones anteriores; se purgan del caché y la nube.
export const LEGACY_SAMPLE_TRADE_IDS = [
  'TRD-20261008-001',
  'TRD-20261009-002',
  'TRD-20261010-003',
  'TRD-20261011-004',
] as const;
const LEGACY_SAMPLE_TRADE_ID_SET = new Set<string>(LEGACY_SAMPLE_TRADE_IDS);

export const INITIAL_SETTINGS: Settings = {
  instruments: DEFAULT_INSTRUMENTS,
  privacyMode: false,
  requirePin: false,
  pinCode: '',
  csvDelimiter: ';', // Standard for Excel in Spanish-speaking regions (semicolon prevents decimal comma conflicts)
};

// La aplicación comienza sin operaciones ficticias. Los datos reales se registran manualmente.

export function loadTradesFromStorage(): Trade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRADES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const realTrades = parsed.filter((trade) => !LEGACY_SAMPLE_TRADE_ID_SET.has(String(trade?.id || '')));
    if (realTrades.length !== parsed.length) saveTradesToStorage(realTrades);
    return realTrades;
  } catch (err) {
    console.error('Error loading trades from storage:', err);
    return [];
  }
}

export function saveTradesToStorage(trades: Trade[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(trades));
  } catch (err) {
    console.error('Error saving trades to storage:', err);
  }
}

export function loadSettingsFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) {
      saveSettingsToStorage(INITIAL_SETTINGS);
      return INITIAL_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_SETTINGS,
      ...parsed,
      instruments: {
        ...DEFAULT_INSTRUMENTS,
        ...(parsed.instruments || {}),
      },
    };
  } catch (err) {
    console.error('Error loading settings:', err);
    return INITIAL_SETTINGS;
  }
}

export function saveSettingsToStorage(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving settings to storage:', err);
  }
}

/**
 * Exports trades to Excel-compatible CSV with UTF-8 BOM.
 */
export function exportTradesToCSV(trades: Trade[], delimiter: string = ';'): void {
  const headers = [
    'ID Operación',
    'Fecha',
    'Hora',
    'Instrumento',
    'Dirección',
    'Estado',
    'Resultado',
    'Total Contratos',
    'N° Entradas',
    'Precio Promedio Ponderado',
    'Stop Inicial',
    'Stop Vigente',
    'Take Profit',
    'Precio Salida',
    'Puntos Brutos',
    'PnL Bruto (USD)',
    'Comisiones (USD)',
    'PnL Neto (USD)',
    'Riesgo Inicial (USD)',
    'Múltiplo R',
    'Estrategia',
    'Sesión',
    'Disciplina (1-5)',
    'Errores',
    'Lecciones',
    'Detalle de Entradas',
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = trades.map((t) => {
    const entriesSummary = t.entries
      .map(
        (e) =>
          `E${e.entryNumber}: ${e.contracts}ct @ ${e.price}${e.notes ? ` (${e.notes})` : ''}`
      )
      .join(' | ');

    return [
      escapeCSV(t.id),
      escapeCSV(t.date),
      escapeCSV(t.time),
      escapeCSV(t.instrument),
      escapeCSV(t.direction),
      escapeCSV(t.status),
      escapeCSV(t.outcome),
      escapeCSV(t.totalContracts),
      escapeCSV(t.entries.length),
      escapeCSV(t.weightedAvgPrice.toFixed(2)),
      escapeCSV(t.initialStop ? t.initialStop.toFixed(2) : ''),
      escapeCSV(t.currentStop ? t.currentStop.toFixed(2) : ''),
      escapeCSV(t.takeProfit ? t.takeProfit.toFixed(2) : ''),
      escapeCSV(t.exitPrice ? t.exitPrice.toFixed(2) : ''),
      escapeCSV(t.grossPoints.toFixed(2)),
      escapeCSV(t.grossPnL.toFixed(2)),
      escapeCSV(t.commissions.toFixed(2)),
      escapeCSV(t.netPnL.toFixed(2)),
      escapeCSV(t.initialRiskDollars.toFixed(2)),
      escapeCSV(t.rMultiple !== null ? t.rMultiple.toFixed(2) : ''),
      escapeCSV(t.strategy),
      escapeCSV(t.session),
      escapeCSV(t.disciplineScore),
      escapeCSV(t.mistakes.join(', ')),
      escapeCSV(t.lessons),
      escapeCSV(entriesSummary),
    ].join(delimiter);
  });

  const csvContent =
    '\uFEFF' + [headers.join(delimiter), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `diario_trading_futuros_mnq_mgc_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a complete JSON backup file with trades and settings.
 */
export function exportBackupJSON(trades: Trade[], settings: Settings): void {
  const backup = {
    appName: 'Diario de Trading Futuros MNQ & MGC',
    exportedAt: new Date().toISOString(),
    version: '1.0',
    trades,
    settings,
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `backup_diario_trading_${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Restores trades and settings from a JSON backup file.
 */
export function parseBackupJSON(jsonString: string): {
  success: boolean;
  trades?: Trade[];
  settings?: Settings;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString);
    if (!data.trades || !Array.isArray(data.trades)) {
      return { success: false, error: 'El archivo no contiene un arreglo válido de operaciones (trades).' };
    }
    return {
      success: true,
      trades: data.trades,
      settings: data.settings,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Formato JSON inválido.' };
  }
}
