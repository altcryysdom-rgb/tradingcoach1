import React, { useState, useEffect } from 'react';
import {
  Trade,
  TradeEntry,
  TradeDirection,
  TradeStatus,
  Settings,
  TradePhotos,
} from '../types/trade';
import {
  calculateWeightedEntry,
  calculateGrossPoints,
  calculateGrossPnL,
  calculateNetPnL,
  calculateRisk,
  calculateRMultiple,
  determineOutcome,
  formatUSD,
  formatPoints,
  formatR,
} from '../utils/calculations';
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Calculator,
  AlertCircle,
  Save,
  X,
  HelpCircle,
  Star,
  Check,
  Link,
  Info,
  Camera,
} from 'lucide-react';
import { TradePhotoSlots } from './TradePhotoSlots';

interface TradeFormProps {
  initialTrade?: Trade | null;
  settings: Settings;
  userId?: string;
  onSaveTrade: (trade: Trade) => void;
  onCancel: () => void;
}

const STRATEGY_PRESETS = [
  'Pullback VWAP / FVG',
  'Ruptura de Rango (Breakout)',
  'Falso Breakout / Trampa de Liquidez',
  'Reversión en Soporte / Resistencia',
  'Continuación de Tendencia',
  'Apertura Nueva York (09:30)',
  'Retroceso Fibonacci 61.8%',
  'Barrido de Mínimos/Máximos Diarios',
];

const SESSION_PRESETS = [
  'Nueva York Apertura (09:30 - 10:30)',
  'Nueva York AM (10:30 - 12:00)',
  'Nueva York PM (13:30 - 16:00)',
  'Londres (03:00 - 08:00)',
  'Asia (19:00 - 02:00)',
  'Pre-Mercado NY (08:00 - 09:30)',
];

const EMOTIONS_PRESETS = [
  'Calma',
  'Enfocado',
  'Paciencia',
  'Confianza',
  'Ansiedad',
  'Impaciencia',
  'FOMO (Miedo a perderse)',
  'Duda',
  'Miedo a perder',
  'Venganza (Revenge)',
  'Tentación de mover stop',
  'Satisfecho',
  'Frustración',
];

const MISTAKES_PRESETS = [
  'Ninguno (Plan ejecutado)',
  'Entrada prematura / sin confirmación',
  'Entrada tardía por FOMO',
  'Mover Stop Loss alejándolo del precio',
  'Cierre anticipado por miedo / pánico',
  'Sobrelotaje (más contratos de los debidos)',
  'Operar en consolidación sucia',
  'Revenge trading tras stop previo',
  'No aceptar la pérdida a tiempo',
];

export const TradeForm: React.FC<TradeFormProps> = ({
  initialTrade,
  settings,
  userId,
  onSaveTrade,
  onCancel,
}) => {
  const [photos, setPhotos] = useState<TradePhotos>(
    initialTrade?.photos || {}
  );

  // Trade identification and timestamp
  const [tradeId, setTradeId] = useState<string>(
    initialTrade?.id || `TRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [date, setDate] = useState<string>(
    initialTrade?.date || new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState<string>(
    initialTrade?.time || new Date().toTimeString().slice(0, 5)
  );

  // Core parameters
  const [instrument, setInstrument] = useState<string>(
    initialTrade?.instrument || 'MNQ'
  );
  const [direction, setDirection] = useState<TradeDirection>(
    initialTrade?.direction || 'LONG'
  );
  const [status, setStatus] = useState<TradeStatus>(
    initialTrade?.status || 'CERRADA'
  );

  // Up to 6 scale-in entries
  const [entries, setEntries] = useState<TradeEntry[]>(
    initialTrade?.entries && initialTrade.entries.length > 0
      ? initialTrade.entries
      : [
          {
            id: 'e1',
            entryNumber: 1,
            contracts: 1,
            price: instrument === 'MNQ' ? 20400.0 : 2650.0,
            time: new Date().toTimeString().slice(0, 5),
            notes: '',
          },
        ]
  );

  // Trade management levels
  const [initialStop, setInitialStop] = useState<string>(
    initialTrade?.initialStop !== undefined ? String(initialTrade.initialStop) : ''
  );
  const [currentStop, setCurrentStop] = useState<string>(
    initialTrade?.currentStop !== undefined ? String(initialTrade.currentStop) : ''
  );
  const [takeProfit, setTakeProfit] = useState<string>(
    initialTrade?.takeProfit !== undefined ? String(initialTrade.takeProfit) : ''
  );
  const [exitPrice, setExitPrice] = useState<string>(
    initialTrade?.exitPrice !== undefined ? String(initialTrade.exitPrice) : ''
  );
  const [exitDate, setExitDate] = useState<string>(
    initialTrade?.exitDate || date
  );
  const [exitTime, setExitTime] = useState<string>(
    initialTrade?.exitTime || time
  );

  // Commission in USD
  const activeConfig =
    settings.instruments[instrument] || settings.instruments['MNQ'];
  const [commissions, setCommissions] = useState<string>(
    initialTrade?.commissions !== undefined ? String(initialTrade.commissions) : '2.50'
  );

  // Journaling & Psychology
  const [session, setSession] = useState<string>(
    initialTrade?.session || SESSION_PRESETS[0]
  );
  const [strategy, setStrategy] = useState<string>(
    initialTrade?.strategy || STRATEGY_PRESETS[0]
  );
  const [customStrategy, setCustomStrategy] = useState<string>('');
  const [emotions, setEmotions] = useState<string[]>(
    initialTrade?.emotionsBefore || ['Calma', 'Enfocado']
  );
  const [disciplineScore, setDisciplineScore] = useState<number>(
    initialTrade?.disciplineScore || 5
  );
  const [mistakes, setMistakes] = useState<string[]>(
    initialTrade?.mistakes || ['Ninguno (Plan ejecutado)']
  );
  const [lessons, setLessons] = useState<string>(initialTrade?.lessons || '');
  const [screenshotUrl, setScreenshotUrl] = useState<string>(
    initialTrade?.screenshotUrl || ''
  );
  const [notes, setNotes] = useState<string>(initialTrade?.notes || '');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState<boolean>(false);

  // Calculated state
  const { totalContracts, weightedAvgPrice } = calculateWeightedEntry(entries);
  const numInitialStop = parseFloat(initialStop) || 0;
  const numCurrentStop = parseFloat(currentStop) || undefined;
  const numTakeProfit = parseFloat(takeProfit) || undefined;
  const numExitPrice = parseFloat(exitPrice) || 0;
  const numCommissions = parseFloat(commissions) || 0;

  // Real-time calculations
  const grossPoints = calculateGrossPoints(
    direction,
    weightedAvgPrice,
    numExitPrice
  );
  const grossPnL = calculateGrossPnL(
    grossPoints,
    totalContracts,
    activeConfig.pointValue
  );
  const netPnL = calculateNetPnL(grossPnL, numCommissions);
  const { riskPoints, riskDollars, isValidRisk } = calculateRisk(
    direction,
    weightedAvgPrice,
    numInitialStop,
    totalContracts,
    activeConfig.pointValue
  );
  const rMultiple = calculateRMultiple(netPnL, riskDollars);
  const outcome = determineOutcome(netPnL);

  // Handlers for scale-in entries
  const handleAddEntry = () => {
    if (entries.length >= 6) return;
    const nextNum = entries.length + 1;
    const lastPrice = entries[entries.length - 1]?.price || weightedAvgPrice || 0;
    setEntries([
      ...entries,
      {
        id: `e-${Date.now()}-${nextNum}`,
        entryNumber: nextNum,
        contracts: 1,
        price: lastPrice,
        time: new Date().toTimeString().slice(0, 5),
        notes: '',
      },
    ]);
  };

  const handleRemoveEntry = (indexToRemove: number) => {
    if (entries.length <= 1) return;
    const updated = entries
      .filter((_, idx) => idx !== indexToRemove)
      .map((entry, idx) => ({ ...entry, entryNumber: idx + 1 }));
    setEntries(updated);
  };

  const handleUpdateEntry = (
    index: number,
    field: keyof TradeEntry,
    value: any
  ) => {
    const updated = [...entries];
    updated[index] = {
      ...updated[index],
      [field]: field === 'contracts' || field === 'price' ? Number(value) : value,
    };
    setEntries(updated);
  };

  // Auto-estimate commission based on total contracts
  const handleAutoEstimateCommission = () => {
    const est = totalContracts * (activeConfig.defaultCommission || 2.5);
    setCommissions(est.toFixed(2));
  };

  const toggleEmotion = (emo: string) => {
    setEmotions((prev) =>
      prev.includes(emo) ? prev.filter((e) => e !== emo) : [...prev, emo]
    );
  };

  const toggleMistake = (mst: string) => {
    if (mst === 'Ninguno (Plan ejecutado)') {
      setMistakes(['Ninguno (Plan ejecutado)']);
      return;
    }
    setMistakes((prev) => {
      const filtered = prev.filter((m) => m !== 'Ninguno (Plan ejecutado)');
      return filtered.includes(mst)
        ? filtered.filter((m) => m !== mst)
        : [...filtered, mst];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (totalContracts <= 0 || weightedAvgPrice <= 0) {
      alert('Por favor especifica al menos una entrada con contratos y precio válidos.');
      return;
    }

    const finalStrategy = customStrategy.trim() ? customStrategy.trim() : strategy;

    const savedTrade: Trade = {
      id: tradeId,
      date,
      time,
      instrument,
      direction,
      status,
      entries,
      totalContracts,
      weightedAvgPrice,
      initialStop: numInitialStop,
      currentStop: numCurrentStop,
      takeProfit: numTakeProfit,
      exitPrice: status === 'CERRADA' ? numExitPrice : undefined,
      exitDate: status === 'CERRADA' ? exitDate : undefined,
      exitTime: status === 'CERRADA' ? exitTime : undefined,
      commissions: numCommissions,
      grossPoints: status === 'CERRADA' ? grossPoints : 0,
      grossPnL: status === 'CERRADA' ? grossPnL : 0,
      netPnL: status === 'CERRADA' ? netPnL : 0,
      initialRiskPoints: riskPoints,
      initialRiskDollars: riskDollars,
      rMultiple: status === 'CERRADA' ? rMultiple : null,
      outcome: status === 'CERRADA' ? outcome : 'BREAKEVEN',
      session,
      strategy: finalStrategy,
      emotionsBefore: emotions,
      emotionsDuring: [],
      emotionsAfter: [],
      disciplineScore,
      mistakes,
      lessons,
      photos,
      screenshotUrl:
        photos?.entry1M?.url ||
        photos?.exit1M?.url ||
        photos?.contextHTF?.url ||
        screenshotUrl.trim() ||
        undefined,
      notes,
      createdAt: initialTrade?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveTrade(savedTrade);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
            {initialTrade ? 'Edición de Operación' : 'Nueva Operación'}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <span>Registro de Futuros</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
              ID: {tradeId}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Hasta 6 entradas por operación calculadas en un único precio promedio ponderado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Instrument & Direction Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          {/* Instrument Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Instrumento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInstrument('MNQ')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                  instrument === 'MNQ'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-500'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <span>MNQ (Nasdaq)</span>
                <span className="font-mono text-[11px] opacity-80">$2/pt</span>
              </button>
              <button
                type="button"
                onClick={() => setInstrument('MGC')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                  instrument === 'MGC'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <span>MGC (Oro)</span>
                <span className="font-mono text-[11px] opacity-80">$10/pt</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Valor configurado: <strong className="text-slate-800">${activeConfig.pointValue} USD</strong> por punto entero
            </p>
          </div>

          {/* Direction Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Dirección
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('LONG')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  direction === 'LONG'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>LONG (Compra)</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection('SHORT')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  direction === 'SHORT'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>SHORT (Venta)</span>
              </button>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hora Inicio
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                required
              />
            </div>
          </div>
        </div>

        {/* Step 2: Scale-In Entries (Up to 6 entries) */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Entradas de la Operación (Scale-Ins)</span>
                <span className="text-xs font-normal text-slate-500">
                  (Hasta 6 entradas bajo este ID)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada entrada adicional ajusta el precio promedio ponderado sin dividirse en operaciones separadas.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddEntry}
              disabled={entries.length >= 6}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                entries.length >= 6
                  ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Añadir Entrada ({entries.length}/6)</span>
            </button>
          </div>

          {/* Entries Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 font-semibold">
                  <th className="py-2.5 px-3 w-20">#</th>
                  <th className="py-2.5 px-3 w-32">Contratos</th>
                  <th className="py-2.5 px-3 w-40">Precio Entrada</th>
                  <th className="py-2.5 px-3 w-28">Hora</th>
                  <th className="py-2.5 px-3">Nota de Entrada (opcional)</th>
                  <th className="py-2.5 px-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      Entrada {entry.entryNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          value={entry.contracts}
                          onChange={(e) =>
                            handleUpdateEntry(index, 'contracts', e.target.value)
                          }
                          className="w-20 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                          required
                        />
                        <span className="text-slate-500 font-sans text-[11px]">
                          ct{entry.contracts > 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={entry.price}
                        onChange={(e) =>
                          handleUpdateEntry(index, 'price', e.target.value)
                        }
                        className="w-32 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 font-semibold"
                        required
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="time"
                        value={entry.time || ''}
                        onChange={(e) =>
                          handleUpdateEntry(index, 'time', e.target.value)
                        }
                        className="w-24 bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 font-sans"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        placeholder="Ej. Entrada en soporte / Retest..."
                        value={entry.notes || ''}
                        onChange={(e) =>
                          handleUpdateEntry(index, 'notes', e.target.value)
                        }
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(index)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Eliminar esta entrada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Live Weighted Average Banner */}
          <div className="p-3.5 bg-blue-50/70 rounded-lg border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <span className="text-slate-600">Total Posición Consolidada:</span>
                <div className="flex items-center gap-2 mt-0.5 font-mono">
                  <span className="font-bold text-slate-900 text-sm">
                    {totalContracts} contrato{totalContracts > 1 ? 's' : ''}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">Precio Promedio Ponderado:</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {weightedAvgPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Explanatory Formula text */}
            <div className="text-[11px] text-slate-600 font-mono bg-white px-2.5 py-1.5 rounded-md border border-blue-200 shadow-2xs">
              Fórmula: ∑(Contratos × Precio) / ∑(Contratos)
            </div>
          </div>
        </div>

        {/* Step 3: Risk Management & Exit Levels */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Niveles de Gestión de Riesgo y Salida
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stop Inicial */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stop Inicial (SL) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={
                  direction === 'LONG'
                    ? (weightedAvgPrice - 20).toFixed(2)
                    : (weightedAvgPrice + 20).toFixed(2)
                }
                value={initialStop}
                onChange={(e) => setInitialStop(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                {direction === 'LONG'
                  ? 'Debe ser menor al precio de entrada'
                  : 'Debe ser mayor al precio de entrada'}
              </span>
            </div>

            {/* Stop Vigente (Trailing) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stop Vigente (Trailing SL)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Opcional (si se movió)"
                value={currentStop}
                onChange={(e) => setCurrentStop(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Nivel de stop gestionado / breakeven
              </span>
            </div>

            {/* Take Profit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Take Profit Objetivo
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={
                  direction === 'LONG'
                    ? (weightedAvgPrice + 40).toFixed(2)
                    : (weightedAvgPrice - 40).toFixed(2)
                }
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Target técnico planeado
              </span>
            </div>

            {/* Precio de Salida */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio de Salida (Cierre) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio final ejecutado"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Precio real de cierre de la posición
              </span>
            </div>
          </div>

          {/* Commissions & Exit Date/Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Comisiones Totales (USD)
                </label>
                <button
                  type="button"
                  onClick={handleAutoEstimateCommission}
                  className="text-[11px] text-blue-600 hover:underline cursor-pointer font-medium"
                >
                  Auto (${(totalContracts * activeConfig.defaultCommission).toFixed(2)})
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                value={commissions}
                onChange={(e) => setCommissions(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Comisiones del broker / exchange
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha de Cierre
              </label>
              <input
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Cierre
              </label>
              <input
                type="time"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* LIVE METRICS AUDIT CARD */}
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              Auditoría en Tiempo Real de Cálculos
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Resultado:</span>
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  outcome === 'GANADORA'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : outcome === 'PERDIDA'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-slate-200 text-slate-800 border border-slate-300'
                }`}
              >
                {outcome}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">Puntos Brutos</span>
              <span
                className={`text-sm font-bold font-mono tabular-nums block mt-0.5 ${
                  grossPoints > 0
                    ? 'text-emerald-700'
                    : grossPoints < 0
                    ? 'text-rose-700'
                    : 'text-slate-700'
                }`}
              >
                {formatPoints(grossPoints)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">Resultado Bruto</span>
              <span
                className={`text-sm font-bold font-mono tabular-nums block mt-0.5 ${
                  grossPnL > 0
                    ? 'text-emerald-700'
                    : grossPnL < 0
                    ? 'text-rose-700'
                    : 'text-slate-700'
                }`}
              >
                {formatUSD(grossPnL)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">Comisiones</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-700 block mt-0.5">
                -${numCommissions.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-blue-300 shadow-2xs ring-1 ring-blue-100">
              <span className="text-[11px] text-slate-500 block">Resultado Neto</span>
              <span
                className={`text-base font-bold font-mono tabular-nums block mt-0.5 ${
                  netPnL > 0
                    ? 'text-emerald-700'
                    : netPnL < 0
                    ? 'text-rose-700'
                    : 'text-slate-700'
                }`}
              >
                {formatUSD(netPnL)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">Riesgo Inicial ($)</span>
              <span className="text-sm font-bold font-mono tabular-nums text-rose-700 block mt-0.5">
                ${riskDollars.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {riskPoints.toFixed(2)} pts
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">Múltiplo R</span>
              <span
                className={`text-base font-bold font-mono tabular-nums block mt-0.5 ${
                  rMultiple !== null && rMultiple > 0
                    ? 'text-blue-700'
                    : rMultiple !== null && rMultiple < 0
                    ? 'text-rose-700'
                    : 'text-slate-700'
                }`}
              >
                {formatR(rMultiple)}
              </span>
            </div>
          </div>

          {!isValidRisk && numInitialStop > 0 && (
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Atención: El Stop Inicial ({numInitialStop}) está configurado en el lado opuesto para una operación {direction}. Verifica que sea menor para Longs o mayor para Shorts.
              </span>
            </div>
          )}
        </div>

        {/* Step 4: Psychology, Discipline & Mistakes */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-slate-900">
            Bitácora Psicológica, Disciplina y Lecciones
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strategy */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estrategia / Setup
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 mb-2"
              >
                {STRATEGY_PRESETS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="O escribe una estrategia personalizada..."
                value={customStrategy}
                onChange={(e) => setCustomStrategy(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Session & Discipline Score */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sesión Operativa
                </label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {SESSION_PRESETS.map((ses) => (
                    <option key={ses} value={ses}>
                      {ses}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Puntuación de Disciplina ({disciplineScore}/5 estrellas)
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setDisciplineScore(star)}
                      className="p-1 rounded hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= disciplineScore
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-slate-500 ml-2">
                    {disciplineScore === 5
                      ? 'Plan seguido 100%'
                      : disciplineScore >= 4
                      ? 'Buena disciplina'
                      : disciplineScore >= 3
                      ? 'Desviaciones menores'
                      : 'Falla de disciplina grave'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Emotions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Estado Emocional (Selecciona las que experimentaste)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONS_PRESETS.map((emo) => {
                const isSelected = emotions.includes(emo);
                return (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => toggleEmotion(emo)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {emo}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mistakes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Errores Cometidos (Auditoría para mejora continua)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MISTAKES_PRESETS.map((mst) => {
                const isSelected = mistakes.includes(mst);
                const isNone = mst === 'Ninguno (Plan ejecutado)';
                return (
                  <button
                    key={mst}
                    type="button"
                    onClick={() => toggleMistake(mst)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                      isSelected
                        ? isNone
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {mst}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lessons Learned */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lección Principal Aprendida
            </label>
            <textarea
              rows={3}
              placeholder="¿Qué aprendiste hoy? ¿Qué repetirías o cambiarías la próxima vez?"
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Detalles Avanzados Collapsible */}
          <div className="pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAdvancedDetails((prev) => !prev)}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center justify-between w-full py-1.5 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Detalles avanzados (Notas de contexto y captura del gráfico)</span>
              </span>
              <span className="text-[11px] text-blue-600 font-medium">
                {showAdvancedDetails ? 'Ocultar' : 'Mostrar'}
              </span>
            </button>

            {showAdvancedDetails && (
              <div className="mt-3 space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notas Generales y Contexto del Mercado
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Noticias macroeconómicas, comportamiento del VIX, zonas de liquidez..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enlace a Captura del Gráfico (TradingView / Gyazo / Imgur)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Link className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="url"
                        placeholder="https://www.tradingview.com/x/... o enlace directo a imagen"
                        value={screenshotUrl}
                        onChange={(e) => setScreenshotUrl(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    {screenshotUrl && (
                      <a
                        href={screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Abrir
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 6: Auditoría Fotográfica de Gráficos (Operativa en 1M y Contexto) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                <span>Auditoría Visual de Gráficos (Operativa en 1M & Contexto Macro)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Adjunta las capturas de tu operativa en 1 minuto: antes de entrar, al cierre y contexto general. Todas son opcionales y omitibles.
              </p>
            </div>
          </div>

          <TradePhotoSlots
            tradeId={tradeId}
            instrument={instrument}
            userId={userId}
            photos={photos}
            onChangePhotos={(newPhotos) => setPhotos(newPhotos)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-bold text-white bg-[#0f1f38] hover:bg-[#1a365d] rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Operación en el Diario</span>
          </button>
        </div>
      </form>
    </div>
  );
};
