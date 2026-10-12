import { Trade, Settings, InstrumentConfig } from '../types/trade';
import { DEFAULT_INSTRUMENTS } from './calculations';

const STORAGE_KEY_TRADES = 'nexus_futures_trades_v1';
const STORAGE_KEY_SETTINGS = 'nexus_futures_settings_v1';

export const INITIAL_SETTINGS: Settings = {
  instruments: DEFAULT_INSTRUMENTS,
  privacyMode: false,
  requirePin: false,
  pinCode: '',
  csvDelimiter: ';', // Standard for Excel in Spanish-speaking regions (semicolon prevents decimal comma conflicts)
};

export const INITIAL_SAMPLE_TRADES: Trade[] = [
  {
    id: 'TRD-20261008-001',
    date: '2026-10-08',
    time: '09:42',
    instrument: 'MNQ',
    direction: 'LONG',
    status: 'CERRADA',
    entries: [
      { id: 'e1', entryNumber: 1, contracts: 1, price: 20380.50, time: '09:42', notes: 'Rebote en VWAP + FVG' },
      { id: 'e2', entryNumber: 2, contracts: 2, price: 20392.00, time: '09:46', notes: 'Confirmación de ruptura de micro-rango' },
      { id: 'e3', entryNumber: 3, contracts: 1, price: 20405.25, time: '09:51', notes: 'Piramidación a favor de tendencia' },
    ],
    totalContracts: 4,
    weightedAvgPrice: 20392.44, // (1*20380.5 + 2*20392 + 1*20405.25) / 4 = 81569.75 / 4 = 20392.4375
    initialStop: 20360.00,
    currentStop: 20410.00, // Trailing stop en positivo
    takeProfit: 20465.00,
    exitPrice: 20460.00,
    exitDate: '2026-10-08',
    exitTime: '10:18',
    commissions: 8.50,
    grossPoints: 67.56,
    grossPnL: 540.48, // 67.56 pts * 4 cts * $2/pt = $540.48
    netPnL: 531.98,
    initialRiskPoints: 32.44,
    initialRiskDollars: 259.52, // 32.44 * 4 * 2
    rMultiple: 2.05,
    outcome: 'GANADORA',
    session: 'Nueva York Apertura',
    strategy: 'Pullback VWAP / FVG',
    emotionsBefore: ['Calma', 'Enfocado'],
    emotionsDuring: ['Paciencia', 'Confianza'],
    emotionsAfter: ['Satisfecho con el plan'],
    disciplineScore: 5,
    mistakes: ['Ninguno (Plan ejecutado)'],
    lessons: 'Excelente paciencia esperando que la micro-estructura confirmara la entrada.',
    screenshotUrl: '',
    notes: 'Operación ejecutada estrictamente acorde al plan de trading.',
    createdAt: '2026-10-08T09:42:00.000Z',
    updatedAt: '2026-10-08T10:18:00.000Z',
  },
  {
    id: 'TRD-20261009-002',
    date: '2026-10-09',
    time: '10:15',
    instrument: 'MGC',
    direction: 'SHORT',
    status: 'CERRADA',
    entries: [
      { id: 'e1', entryNumber: 1, contracts: 1, price: 2652.50, time: '10:15', notes: 'Rechazo en zona de resistencia' },
      { id: 'e2', entryNumber: 2, contracts: 1, price: 2654.50, time: '10:19', notes: 'Promedio en punto pivote' },
    ],
    totalContracts: 2,
    weightedAvgPrice: 2653.50, // (2652.5 + 2654.5)/2 = 2653.50
    initialStop: 2658.00,
    currentStop: 2658.00,
    takeProfit: 2642.00,
    exitPrice: 2658.00, // Tocó Stop loss
    exitDate: '2026-10-09',
    exitTime: '10:35',
    commissions: 6.00,
    grossPoints: -4.50, // Short: 2653.50 - 2658.00 = -4.50 pts
    grossPnL: -90.00, // -4.5 pts * 2 cts * $10/pt = -$90.00
    netPnL: -96.00,
    initialRiskPoints: 4.50,
    initialRiskDollars: 90.00,
    rMultiple: -1.07,
    outcome: 'PERDIDA',
    session: 'Nueva York AM',
    strategy: 'Reversión en Resistencia',
    emotionsBefore: ['Ligera impaciencia'],
    emotionsDuring: ['Tensión'],
    emotionsAfter: ['Aceptación del stop'],
    disciplineScore: 4,
    mistakes: ['Entrada temprana sin confirmación de volumen'],
    lessons: 'El oro venía con momentum alcista tras datos macro. Mejor esperar ruptura de mínimos locales.',
    notes: 'Stop respetado sin moverlo. Pérdida controlada.',
    createdAt: '2026-10-09T10:15:00.000Z',
    updatedAt: '2026-10-09T10:35:00.000Z',
  },
  {
    id: 'TRD-20261010-003',
    date: '2026-10-10',
    time: '09:35',
    instrument: 'MNQ',
    direction: 'SHORT',
    status: 'CERRADA',
    entries: [
      { id: 'e1', entryNumber: 1, contracts: 2, price: 20485.00, time: '09:35', notes: 'Falso rompimiento de máximos pre-market' },
    ],
    totalContracts: 2,
    weightedAvgPrice: 20485.00,
    initialStop: 20510.00,
    currentStop: 20470.00,
    takeProfit: 20415.00,
    exitPrice: 20420.00,
    exitDate: '2026-10-10',
    exitTime: '09:58',
    commissions: 4.96,
    grossPoints: 65.00, // Short: 20485 - 20420 = +65.00 pts
    grossPnL: 260.00, // 65 * 2 * 2 = $260.00
    netPnL: 255.04,
    initialRiskPoints: 25.00,
    initialRiskDollars: 100.00,
    rMultiple: 2.55,
    outcome: 'GANADORA',
    session: 'Nueva York Apertura',
    strategy: 'Trampa de Liquidez / Falso Breakout',
    emotionsBefore: ['Calma', 'Concentrado'],
    emotionsDuring: ['Tranquilidad'],
    emotionsAfter: ['Satisfecho'],
    disciplineScore: 5,
    mistakes: ['Ninguno (Plan ejecutado)'],
    lessons: 'El setup de apertura con barrido de liquidez funcionó a la perfección.',
    notes: 'Salida manual en primer soporte clave antes de rebote.',
    createdAt: '2026-10-10T09:35:00.000Z',
    updatedAt: '2026-10-10T09:58:00.000Z',
  },
  {
    id: 'TRD-20261011-004',
    date: '2026-10-11',
    time: '14:10',
    instrument: 'MGC',
    direction: 'LONG',
    status: 'CERRADA',
    entries: [
      { id: 'e1', entryNumber: 1, contracts: 1, price: 2645.20, time: '14:10', notes: 'Entrada inicial en soporte diario' },
      { id: 'e2', entryNumber: 2, contracts: 1, price: 2646.80, time: '14:15', notes: 'Segunda entrada tras retest exitoso' },
    ],
    totalContracts: 2,
    weightedAvgPrice: 2646.00,
    initialStop: 2641.00,
    currentStop: 2646.00,
    takeProfit: 2656.00,
    exitPrice: 2654.00,
    exitDate: '2026-10-11',
    exitTime: '15:02',
    commissions: 6.00,
    grossPoints: 8.00, // Long: 2654.00 - 2646.00 = +8.00 pts
    grossPnL: 160.00, // 8 pts * 2 cts * $10/pt = $160.00
    netPnL: 154.00,
    initialRiskPoints: 5.00,
    initialRiskDollars: 100.00,
    rMultiple: 1.54,
    outcome: 'GANADORA',
    session: 'Nueva York PM',
    strategy: 'Continuación de Tendencia',
    emotionsBefore: ['Calma'],
    emotionsDuring: ['Paciencia'],
    emotionsAfter: ['Satisfecho'],
    disciplineScore: 5,
    mistakes: ['Ninguno (Plan ejecutado)'],
    lessons: 'La sesión de la tarde tuvo buena continuidad tras compresión.',
    notes: 'Toma de beneficios cerca del target preestablecido.',
    createdAt: '2026-10-11T14:10:00.000Z',
    updatedAt: '2026-10-11T15:02:00.000Z',
  },
];

export function loadTradesFromStorage(): Trade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRADES);
    if (!raw) {
      // First run: save and return initial verified samples
      saveTradesToStorage(INITIAL_SAMPLE_TRADES);
      return INITIAL_SAMPLE_TRADES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error loading trades from storage:', err);
    return INITIAL_SAMPLE_TRADES;
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
