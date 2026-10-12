import React, { useState } from 'react';
import {
  runFormulaVerificationTests,
  VerificationCase,
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
  CheckCircle2,
  XCircle,
  Calculator,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  Info,
  RefreshCw,
} from 'lucide-react';

export const FormulaVerifier: React.FC = () => {
  const [testCases, setTestCases] = useState<VerificationCase[]>(() =>
    runFormulaVerificationTests()
  );

  // Interactive Live Simulator state
  const [simDirection, setSimDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [simInstrument, setSimInstrument] = useState<'MNQ' | 'MGC'>('MNQ');
  const [simPointValue, setSimPointValue] = useState<number>(2.0); // 2 for MNQ, 10 for MGC
  const [simEntries, setSimEntries] = useState<
    { contracts: number; price: number }[]
  >([
    { contracts: 1, price: 20400 },
    { contracts: 2, price: 20410 },
    { contracts: 1, price: 20420 },
  ]);
  const [simStop, setSimStop] = useState<number>(20380);
  const [simExit, setSimExit] = useState<number>(20460);
  const [simCommissions, setSimCommissions] = useState<number>(8.0);

  const handleRunVerification = () => {
    setTestCases(runFormulaVerificationTests());
  };

  const handleSelectInstrument = (inst: 'MNQ' | 'MGC') => {
    setSimInstrument(inst);
    if (inst === 'MNQ') {
      setSimPointValue(2.0);
      setSimEntries([
        { contracts: 1, price: 20400 },
        { contracts: 2, price: 20410 },
        { contracts: 1, price: 20420 },
      ]);
      setSimStop(20380);
      setSimExit(20460);
      setSimCommissions(8.0);
    } else {
      setSimPointValue(10.0);
      setSimEntries([
        { contracts: 1, price: 2650.0 },
        { contracts: 1, price: 2652.0 },
      ]);
      setSimStop(2644.0);
      setSimExit(2660.0);
      setSimCommissions(6.0);
    }
  };

  // Interactive Simulator calculations
  const simWeighted = calculateWeightedEntry(
    simEntries.map((e, idx) => ({
      id: `sim-${idx}`,
      entryNumber: idx + 1,
      contracts: e.contracts,
      price: e.price,
    }))
  );
  const simGrossPoints = calculateGrossPoints(
    simDirection,
    simWeighted.weightedAvgPrice,
    simExit
  );
  const simGrossPnL = calculateGrossPnL(
    simGrossPoints,
    simWeighted.totalContracts,
    simPointValue
  );
  const simNetPnL = calculateNetPnL(simGrossPnL, simCommissions);
  const simRisk = calculateRisk(
    simDirection,
    simWeighted.weightedAvgPrice,
    simStop,
    simWeighted.totalContracts,
    simPointValue
  );
  const simR = calculateRMultiple(simNetPnL, simRisk.riskDollars);
  const simOutcome = determineOutcome(simNetPnL);

  const passedCount = testCases.filter((tc) => tc.passed).length;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      {/* Title & Verification Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Auditoría Matemática Rigurosa
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Verificación de Fórmulas Financieras
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Prueba de operaciones LONG, SHORT, entradas escalonadas (scale-ins), comisiones, pérdidas y múltiplos R. Las entradas adicionales no se contabilizan como operaciones independientes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {passedCount}/{testCases.length} Casos Verificados
            </span>
          </div>

          <button
            onClick={handleRunVerification}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Re-ejecutar Pruebas</span>
          </button>
        </div>
      </div>

      {/* Verification Cases Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <span>1. Casos de Prueba Verificados Automáticamente</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testCases.map((tc) => (
            <div
              key={tc.id}
              className={`p-4 rounded-xl border bg-white shadow-2xs transition-all ${
                tc.passed
                  ? 'border-slate-200 border-l-4 border-l-emerald-600'
                  : 'border-slate-200 border-l-4 border-l-rose-600'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                        tc.tradeData.instrument === 'MNQ'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {tc.tradeData.instrument} (${tc.tradeData.pointValue}/pt)
                    </span>
                    <span
                      className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                        tc.tradeData.direction === 'LONG'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-rose-700 bg-rose-50 border border-rose-200'
                      }`}
                    >
                      {tc.tradeData.direction}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 mt-2 font-sans">
                    {tc.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  {tc.passed ? (
                    <span className="flex items-center gap-1 text-emerald-700 text-xs font-bold font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>OK</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-700 text-xs font-bold font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>FALLÓ</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-500 mt-2.5 font-sans leading-relaxed">
                {tc.description}
              </p>

              {/* Arithmetic Derivation Comparison */}
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Contratos Totales:</span>
                  <span className="text-slate-900 font-bold">
                    {tc.actual?.totalContracts} cts{' '}
                    <span className="text-slate-500 font-sans text-[10px] font-normal">
                      (1 única operación)
                    </span>
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Precio Promedio Ponderado:</span>
                  <span className="text-blue-700 font-bold">
                    {tc.actual?.weightedAvgPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Puntos Obtenidos:</span>
                  <span
                    className={`font-bold ${
                      (tc.actual?.grossPoints || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatPoints(tc.actual?.grossPoints || 0)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Resultado Bruto:</span>
                  <span className="text-slate-800 font-semibold">
                    {formatUSD(tc.actual?.grossPnL || 0)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Comisiones Descontadas:</span>
                  <span className="text-rose-700">
                    -${tc.tradeData.commissions.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-700 font-bold pt-1.5 border-t border-slate-200">
                  <span>Resultado Neto (Final):</span>
                  <span
                    className={
                      (tc.actual?.netPnL || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }
                  >
                    {formatUSD(tc.actual?.netPnL || 0)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Riesgo Inicial $:</span>
                  <span className="text-slate-800">
                    ${tc.actual?.riskDollars.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-700 font-bold">
                  <span>Múltiplo R:</span>
                  <span className="text-blue-700 font-mono">{formatR(tc.actual?.rMultiple ?? null)}</span>
                </div>
              </div>

              {/* Test Log Notes */}
              <div className="mt-2.5 text-[11px] text-slate-500 font-mono space-y-0.5">
                {tc.notes.map((note, i) => (
                  <div key={i}>{note}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Interactive Calculation Sandbox Simulator */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span>2. Simulador Interactivo de Fórmulas en Vivo</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Modifica los valores abajo para comprobar cualquier combinación de contratos, precios, salidas y stops.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectInstrument('MNQ')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                simInstrument === 'MNQ'
                  ? 'bg-blue-50 border-blue-600 text-blue-800'
                  : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
              }`}
            >
              Cargar MNQ ($2/pt)
            </button>
            <button
              onClick={() => handleSelectInstrument('MGC')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                simInstrument === 'MGC'
                  ? 'bg-amber-50 border-amber-600 text-amber-800'
                  : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
              }`}
            >
              Cargar MGC ($10/pt)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Dirección</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSimDirection('LONG')}
                    className={`py-1.5 rounded-lg border font-bold cursor-pointer transition-colors ${
                      simDirection === 'LONG'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    LONG
                  </button>
                  <button
                    onClick={() => setSimDirection('SHORT')}
                    className={`py-1.5 rounded-lg border font-bold cursor-pointer transition-colors ${
                      simDirection === 'SHORT'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    SHORT
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Valor por Punto (USD)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={simPointValue}
                  onChange={(e) => setSimPointValue(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Entries Table */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-700 font-semibold">
                  Entradas ({simEntries.length} entradas escalonadas)
                </label>
                {simEntries.length < 6 && (
                  <button
                    onClick={() =>
                      setSimEntries([
                        ...simEntries,
                        {
                          contracts: 1,
                          price: simEntries[simEntries.length - 1]?.price || 20400,
                        },
                      ])
                    }
                    className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    + Añadir entrada
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {simEntries.map((ent, idx) => (
                  <div key={idx} className="flex items-center gap-2 font-mono">
                    <span className="w-16 text-slate-500 font-medium">Entrada {idx + 1}:</span>
                    <input
                      type="number"
                      min="1"
                      value={ent.contracts}
                      onChange={(e) => {
                        const updated = [...simEntries];
                        updated[idx].contracts = Number(e.target.value);
                        setSimEntries(updated);
                      }}
                      className="w-20 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                    />
                    <span className="text-slate-400 font-sans">cts @</span>
                    <input
                      type="number"
                      step="0.1"
                      value={ent.price}
                      onChange={(e) => {
                        const updated = [...simEntries];
                        updated[idx].price = Number(e.target.value);
                        setSimEntries(updated);
                      }}
                      className="w-28 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-bold"
                    />
                    {simEntries.length > 1 && (
                      <button
                        onClick={() =>
                          setSimEntries(simEntries.filter((_, i) => i !== idx))
                        }
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer font-bold"
                        title="Eliminar entrada"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stop, Exit, Comm */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Stop Inicial
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={simStop}
                  onChange={(e) => setSimStop(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-rose-700 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Precio Salida
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={simExit}
                  onChange={(e) => setSimExit(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Comisiones ($)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={simCommissions}
                  onChange={(e) => setSimCommissions(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Mathematical Derivation Output Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-3">
            <div className="text-slate-700 font-sans font-bold uppercase tracking-wider text-[11px] pb-2 border-b border-slate-200 flex items-center justify-between">
              <span>Derivación Paso a Paso</span>
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                  simOutcome === 'GANADORA'
                    ? 'text-emerald-700 bg-emerald-100 border border-emerald-200'
                    : 'text-rose-700 bg-rose-100 border border-rose-200'
                }`}
              >
                {simOutcome}
              </span>
            </div>

            <div className="space-y-2 leading-relaxed text-slate-700">
              <div>
                <span className="text-slate-500">1. Total Contratos:</span>{' '}
                <strong className="text-slate-900">{simWeighted.totalContracts} contratos</strong>
              </div>

              <div>
                <span className="text-slate-500">2. Precio Promedio Ponderado:</span>
                <div className="text-blue-700 font-bold mt-0.5">
                  {simWeighted.weightedAvgPrice.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-400">
                  ∑(c_i × p_i) / {simWeighted.totalContracts}
                </div>
              </div>

              <div>
                <span className="text-slate-500">3. Puntos Brutos:</span>{' '}
                <strong
                  className={simGrossPoints >= 0 ? 'text-emerald-700' : 'text-rose-700'}
                >
                  {formatPoints(simGrossPoints)}
                </strong>
                <div className="text-[10px] text-slate-400">
                  {simDirection === 'LONG'
                    ? `Salida (${simExit}) - Entrada (${simWeighted.weightedAvgPrice.toFixed(2)})`
                    : `Entrada (${simWeighted.weightedAvgPrice.toFixed(2)}) - Salida (${simExit})`}
                </div>
              </div>

              <div>
                <span className="text-slate-500">4. PnL Bruto:</span>{' '}
                <strong
                  className={simGrossPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}
                >
                  {formatUSD(simGrossPnL)}
                </strong>
                <div className="text-[10px] text-slate-400">
                  {simGrossPoints.toFixed(2)} pts × {simWeighted.totalContracts} cts × ${simPointValue}/pt
                </div>
              </div>

              <div>
                <span className="text-slate-500">5. PnL Neto tras comisiones:</span>{' '}
                <strong
                  className={`text-sm ${
                    simNetPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatUSD(simNetPnL)}
                </strong>
                <div className="text-[10px] text-slate-400">
                  {formatUSD(simGrossPnL)} - ${simCommissions.toFixed(2)} comisiones
                </div>
              </div>

              <div>
                <span className="text-slate-500">6. Riesgo Inicial $:</span>{' '}
                <strong className="text-rose-700">${simRisk.riskDollars.toFixed(2)}</strong>
                <div className="text-[10px] text-slate-400">
                  {simRisk.riskPoints.toFixed(2)} pts de distancia × {simWeighted.totalContracts} cts × ${simPointValue}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-600">7. Múltiplo R:</span>{' '}
                <strong
                  className={`text-base font-extrabold ${
                    simR !== null && simR >= 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}
                >
                  {formatR(simR)}
                </strong>
                <div className="text-[10px] text-slate-400">
                  PnL Neto ({formatUSD(simNetPnL)}) / Riesgo (${simRisk.riskDollars.toFixed(2)})
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
