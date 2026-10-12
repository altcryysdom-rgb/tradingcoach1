import React, { useState, useMemo } from 'react';
import { Trade, Settings } from '../types/trade';
import { formatUSD, formatPoints, formatR } from '../utils/calculations';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  Layers,
  Award,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  PieChart,
  Activity,
  PlusCircle,
  Filter,
} from 'lucide-react';

interface DashboardProps {
  trades: Trade[];
  settings: Settings;
  privacyMode: boolean;
  onNewTrade: () => void;
  onSelectTrade: (trade: Trade) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  trades,
  settings,
  privacyMode,
  onNewTrade,
  onSelectTrade,
}) => {
  const [instrumentFilter, setInstrumentFilter] = useState<string>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Filter trades based on instrument and date
  const filteredTrades = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Calculate start of current week (Monday)
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayStr = monday.toISOString().split('T')[0];

    // Current month YYYY-MM
    const currentMonthPrefix = now.toISOString().slice(0, 7);

    return trades.filter((t) => {
      if (instrumentFilter !== 'ALL' && t.instrument !== instrumentFilter) {
        return false;
      }
      if (timeFilter === 'TODAY') {
        return t.date === todayStr;
      }
      if (timeFilter === 'WEEK') {
        return t.date >= mondayStr;
      }
      if (timeFilter === 'MONTH') {
        return t.date.startsWith(currentMonthPrefix);
      }
      return true;
    });
  }, [trades, instrumentFilter, timeFilter]);

  // Closed trades for performance metrics
  const closedTrades = useMemo(() => {
    return filteredTrades.filter((t) => t.status === 'CERRADA');
  }, [filteredTrades]);

  // Aggregate Key Performance Indicators (Treats each trade with up to 6 entries as 1 single operation)
  const metrics = useMemo(() => {
    const totalOps = closedTrades.length;
    if (totalOps === 0) {
      return {
        totalOps: 0,
        winners: 0,
        losers: 0,
        breakevens: 0,
        winRate: 0,
        grossPnL: 0,
        totalCommissions: 0,
        netPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        winLossRatio: 0,
        avgR: 0,
        tradesPerDay: 0,
        maxWin: 0,
        maxLoss: 0,
        totalContractsTraded: 0,
        avgDiscipline: 0,
      };
    }

    let winners = 0;
    let losers = 0;
    let breakevens = 0;
    let grossPnL = 0;
    let totalCommissions = 0;
    let netPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let sumR = 0;
    let countR = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let totalContractsTraded = 0;
    let sumDiscipline = 0;

    const uniqueDates = new Set<string>();

    closedTrades.forEach((t) => {
      grossPnL += t.grossPnL || 0;
      totalCommissions += t.commissions || 0;
      netPnL += t.netPnL || 0;
      totalContractsTraded += t.totalContracts || 1;
      sumDiscipline += t.disciplineScore || 5;

      if (t.date) uniqueDates.add(t.date);

      if (t.outcome === 'GANADORA' || t.netPnL > 0) {
        winners++;
        grossProfit += t.grossPnL;
        if (t.netPnL > maxWin) maxWin = t.netPnL;
      } else if (t.outcome === 'PERDIDA' || t.netPnL < 0) {
        losers++;
        grossLoss += Math.abs(t.grossPnL);
        if (t.netPnL < maxLoss) maxLoss = t.netPnL;
      } else {
        breakevens++;
      }

      if (t.rMultiple !== null && t.rMultiple !== undefined) {
        sumR += t.rMultiple;
        countR++;
      }
    });

    const winRate = (winners / totalOps) * 100;
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99.9 : 0) : grossProfit / grossLoss;
    const avgWin = winners > 0 ? grossProfit / winners : 0;
    const avgLoss = losers > 0 ? grossLoss / losers : 0;
    const winLossRatio = avgLoss === 0 ? (avgWin > 0 ? 99.9 : 0) : avgWin / avgLoss;
    const avgR = countR > 0 ? sumR / countR : 0;
    const daysCount = Math.max(1, uniqueDates.size);
    const tradesPerDay = totalOps / daysCount;
    const avgDiscipline = totalOps > 0 ? sumDiscipline / totalOps : 5;

    return {
      totalOps,
      winners,
      losers,
      breakevens,
      winRate,
      grossPnL,
      totalCommissions,
      netPnL,
      grossProfit,
      grossLoss,
      profitFactor,
      avgWin,
      avgLoss,
      winLossRatio,
      avgR,
      tradesPerDay,
      maxWin,
      maxLoss,
      totalContractsTraded,
      avgDiscipline,
    };
  }, [closedTrades]);

  // Equity Curve Cumulative Points
  const equityPoints = useMemo(() => {
    // Sort chronologically ascending
    const sorted = [...closedTrades].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.time.localeCompare(b.time);
    });

    let runningNet = 0;
    const points: Array<{ trade?: Trade; runningNet: number; label: string }> = [
      { runningNet: 0, label: 'Inicio' },
    ];

    sorted.forEach((t) => {
      runningNet += t.netPnL;
      points.push({
        trade: t,
        runningNet,
        label: `${t.date.slice(5)} ${t.instrument}`,
      });
    });

    return points;
  }, [closedTrades]);

  // Monthly and Weekly Aggregations
  const timeBreakdowns = useMemo(() => {
    const monthlyMap: Record<string, { net: number; ops: number; wins: number }> = {};
    const weeklyMap: Record<string, { net: number; ops: number; wins: number }> = {};

    closedTrades.forEach((t) => {
      const month = t.date.slice(0, 7); // YYYY-MM
      if (!monthlyMap[month]) {
        monthlyMap[month] = { net: 0, ops: 0, wins: 0 };
      }
      monthlyMap[month].net += t.netPnL;
      monthlyMap[month].ops += 1;
      if (t.netPnL > 0) monthlyMap[month].wins += 1;

      // Week calculation
      const d = new Date(t.date);
      const weekNumber = Math.ceil(
        ((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
      );
      const weekKey = `${d.getFullYear()}-S${weekNumber}`;
      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = { net: 0, ops: 0, wins: 0 };
      }
      weeklyMap[weekKey].net += t.netPnL;
      weeklyMap[weekKey].ops += 1;
      if (t.netPnL > 0) weeklyMap[weekKey].wins += 1;
    });

    const monthlyList = Object.entries(monthlyMap)
      .map(([period, data]) => ({
        period,
        net: data.net,
        ops: data.ops,
        winRate: (data.wins / data.ops) * 100,
      }))
      .sort((a, b) => b.period.localeCompare(a.period));

    const weeklyList = Object.entries(weeklyMap)
      .map(([period, data]) => ({
        period,
        net: data.net,
        ops: data.ops,
        winRate: (data.wins / data.ops) * 100,
      }))
      .sort((a, b) => b.period.localeCompare(a.period));

    return { monthlyList, weeklyList };
  }, [closedTrades]);

  // Instrument Breakdown (MNQ vs MGC)
  const instrumentBreakdown = useMemo(() => {
    const map: Record<string, { ops: number; net: number; wins: number; contracts: number }> = {
      MNQ: { ops: 0, net: 0, wins: 0, contracts: 0 },
      MGC: { ops: 0, net: 0, wins: 0, contracts: 0 },
    };

    closedTrades.forEach((t) => {
      const sym = t.instrument || 'MNQ';
      if (!map[sym]) {
        map[sym] = { ops: 0, net: 0, wins: 0, contracts: 0 };
      }
      map[sym].ops += 1;
      map[sym].net += t.netPnL;
      map[sym].contracts += t.totalContracts;
      if (t.netPnL > 0) map[sym].wins += 1;
    });

    return map;
  }, [closedTrades]);

  // Direction Breakdown (LONG vs SHORT)
  const directionBreakdown = useMemo(() => {
    const res = {
      LONG: { ops: 0, net: 0, wins: 0 },
      SHORT: { ops: 0, net: 0, wins: 0 },
    };

    closedTrades.forEach((t) => {
      const dir = t.direction;
      if (res[dir]) {
        res[dir].ops += 1;
        res[dir].net += t.netPnL;
        if (t.netPnL > 0) res[dir].wins += 1;
      }
    });

    return res;
  }, [closedTrades]);

  // SVG Chart Dimensions & Path Generation
  const svgWidth = 800;
  const svgHeight = 220;
  const padding = 36;

  const chartPathData = useMemo(() => {
    if (equityPoints.length <= 1) return null;

    const values = equityPoints.map((p) => p.runningNet);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = maxVal - minVal === 0 ? 100 : maxVal - minVal;

    const getX = (index: number) =>
      padding + (index / (equityPoints.length - 1)) * (svgWidth - padding * 2);
    const getY = (val: number) =>
      svgHeight -
      padding -
      ((val - minVal) / range) * (svgHeight - padding * 2);

    const zeroY = getY(0);

    const pointsStr = equityPoints
      .map((p, idx) => `${getX(idx).toFixed(1)},${getY(p.runningNet).toFixed(1)}`)
      .join(' L ');

    const linePath = `M ${pointsStr}`;
    const areaPath = `M ${getX(0)},${zeroY} L ${pointsStr} L ${getX(
      equityPoints.length - 1
    )},${zeroY} Z`;

    return {
      linePath,
      areaPath,
      zeroY,
      minVal,
      maxVal,
      pointsWithCoords: equityPoints.map((p, idx) => ({
        ...p,
        x: getX(idx),
        y: getY(p.runningNet),
      })),
    };
  }, [equityPoints]);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Top Banner & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Rendimiento y Métricas</span>
            <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              {metrics.totalOps} operaciones cerradas
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Las operaciones con múltiples entradas (scale-ins) se auditan como una sola unidad consolidada.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Instrument Filter */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setInstrumentFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                instrumentFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setInstrumentFilter('MNQ')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                instrumentFilter === 'MNQ'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MNQ ($2/pt)
            </button>
            <button
              onClick={() => setInstrumentFilter('MGC')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                instrumentFilter === 'MGC'
                  ? 'bg-white text-amber-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MGC ($10/pt)
            </button>
          </div>

          {/* Time Filter */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setTimeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                timeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setTimeFilter('TODAY')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                timeFilter === 'TODAY'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeFilter('WEEK')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                timeFilter === 'WEEK'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setTimeFilter('MONTH')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                timeFilter === 'MONTH'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Este Mes
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* PnL Neto */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">PnL Neto</span>
            <Activity className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <span
              className={`text-xl font-bold font-mono tracking-tight block ${
                metrics.netPnL > 0
                  ? 'text-emerald-700'
                  : metrics.netPnL < 0
                  ? 'text-rose-700'
                  : 'text-slate-700'
              }`}
            >
              {formatUSD(metrics.netPnL, privacyMode)}
            </span>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
              Bruto: {formatUSD(metrics.grossPnL, privacyMode)}
            </span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono tracking-tight text-slate-900 block">
              {metrics.winRate.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
              {metrics.winners}W · {metrics.losers}L · {metrics.breakevens}BE
            </span>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Profit Factor</span>
            <Award className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <span
              className={`text-xl font-bold font-mono tracking-tight block ${
                metrics.profitFactor >= 1.5
                  ? 'text-emerald-700'
                  : metrics.profitFactor >= 1.0
                  ? 'text-blue-700'
                  : 'text-rose-700'
              }`}
            >
              {metrics.profitFactor.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
              Ratio de ganancia bruta
            </span>
          </div>
        </div>

        {/* Promedio Ganancia / Pérdida */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Avg Win / Loss</span>
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-700 font-bold">
                {formatUSD(metrics.avgWin, privacyMode)}
              </span>
              <span className="text-rose-700 font-bold">
                -{formatUSD(metrics.avgLoss, privacyMode).replace('+$', '$')}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
              Ratio W/L: {metrics.winLossRatio.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Múltiplo R Promedio */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Múltiplo R Promedio</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div>
            <span
              className={`text-xl font-bold font-mono tracking-tight block ${
                metrics.avgR > 0
                  ? 'text-blue-700'
                  : metrics.avgR < 0
                  ? 'text-rose-700'
                  : 'text-slate-700'
              }`}
            >
              {formatR(metrics.avgR)}
            </span>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
              Retorno sobre riesgo inicial
            </span>
          </div>
        </div>

        {/* Operaciones / Día & Comisiones */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Ops / Día & Costo</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono tracking-tight text-slate-900 block">
              {metrics.tradesPerDay.toFixed(1)}{' '}
              <span className="text-xs font-normal text-slate-500">ops/d</span>
            </span>
            <span className="text-[11px] text-rose-600 font-mono mt-0.5 block">
              Comis: -${metrics.totalCommissions.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Equity Curve Visualizer */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Curva de Capital Acumulado (Equity Curve)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evolución cronológica del balance neto tras comisiones en USD
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
              <span>Balance Actual:</span>
              <strong className={metrics.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {formatUSD(metrics.netPnL, privacyMode)}
              </strong>
            </div>
          </div>
        </div>

        {chartPathData ? (
          <div className="w-full overflow-hidden bg-slate-50/50 rounded-lg p-2 border border-slate-100">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-48 select-none"
            >
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Zero baseline */}
              <line
                x1={padding}
                y1={chartPathData.zeroY}
                x2={svgWidth - padding}
                y2={chartPathData.zeroY}
                stroke="#cbd5e1"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding - 6}
                y={chartPathData.zeroY + 3}
                fill="#64748b"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="end"
              >
                $0
              </text>

              {/* Area & Line */}
              <path
                d={chartPathData.areaPath}
                fill="url(#equityGradient)"
              />
              <path
                d={chartPathData.linePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Trade Data Points */}
              {chartPathData.pointsWithCoords.map((pt, idx) => (
                <g key={idx} className="cursor-pointer group">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={idx === 0 ? 3 : 4}
                    fill={idx === 0 ? '#64748b' : pt.runningNet >= 0 ? '#10b981' : '#f43f5e'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-transform group-hover:scale-150"
                  />
                  {pt.trade && (
                    <title>
                      {pt.trade.date} ({pt.trade.instrument} {pt.trade.direction}): Net{' '}
                      {formatUSD(pt.trade.netPnL)} | Acumulado: {formatUSD(pt.runningNet)}
                    </title>
                  )}
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
            No hay suficientes operaciones registradas para trazar la curva de capital. Registra al menos una operación para comenzar.
          </div>
        )}
      </div>

      {/* Split Section: Instrument & Direction Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Instrument Performance: MNQ vs MGC */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rendimiento por Instrumento
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">MNQ ($2/pt) vs MGC ($10/pt)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* MNQ Box */}
            <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 font-mono">MNQ (Nasdaq)</span>
                <span className="text-[10px] text-slate-500 font-mono">2 USD/pt</span>
              </div>
              <span
                className={`text-lg font-bold font-mono mt-1 block ${
                  instrumentBreakdown['MNQ']?.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatUSD(instrumentBreakdown['MNQ']?.net || 0, privacyMode)}
              </span>
              <div className="text-[11px] text-slate-500 font-mono mt-1 space-y-0.5">
                <div>Operaciones: {instrumentBreakdown['MNQ']?.ops || 0}</div>
                <div>
                  Win Rate:{' '}
                  {instrumentBreakdown['MNQ']?.ops > 0
                    ? ((instrumentBreakdown['MNQ'].wins / instrumentBreakdown['MNQ'].ops) * 100).toFixed(0)
                    : 0}
                  %
                </div>
                <div>Contratos: {instrumentBreakdown['MNQ']?.contracts || 0} cts</div>
              </div>
            </div>

            {/* MGC Box */}
            <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 font-mono">MGC (Oro)</span>
                <span className="text-[10px] text-slate-500 font-mono">10 USD/pt</span>
              </div>
              <span
                className={`text-lg font-bold font-mono mt-1 block ${
                  instrumentBreakdown['MGC']?.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatUSD(instrumentBreakdown['MGC']?.net || 0, privacyMode)}
              </span>
              <div className="text-[11px] text-slate-500 font-mono mt-1 space-y-0.5">
                <div>Operaciones: {instrumentBreakdown['MGC']?.ops || 0}</div>
                <div>
                  Win Rate:{' '}
                  {instrumentBreakdown['MGC']?.ops > 0
                    ? ((instrumentBreakdown['MGC'].wins / instrumentBreakdown['MGC'].ops) * 100).toFixed(0)
                    : 0}
                  %
                </div>
                <div>Contratos: {instrumentBreakdown['MGC']?.contracts || 0} cts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Direction Performance: LONG vs SHORT */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rendimiento por Dirección
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">LONG vs SHORT</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  LONG
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {directionBreakdown.LONG.ops} ops
                </span>
              </div>
              <span
                className={`text-lg font-bold font-mono mt-1 block ${
                  directionBreakdown.LONG.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatUSD(directionBreakdown.LONG.net, privacyMode)}
              </span>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Win Rate:{' '}
                {directionBreakdown.LONG.ops > 0
                  ? ((directionBreakdown.LONG.wins / directionBreakdown.LONG.ops) * 100).toFixed(0)
                  : 0}
                %
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  SHORT
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {directionBreakdown.SHORT.ops} ops
                </span>
              </div>
              <span
                className={`text-lg font-bold font-mono mt-1 block ${
                  directionBreakdown.SHORT.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatUSD(directionBreakdown.SHORT.net, privacyMode)}
              </span>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Win Rate:{' '}
                {directionBreakdown.SHORT.ops > 0
                  ? ((directionBreakdown.SHORT.wins / directionBreakdown.SHORT.ops) * 100).toFixed(0)
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly & Monthly Performance Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Table */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
            Estadísticas Mensuales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono bg-slate-50">
                  <th className="py-2 px-2.5 rounded-l">Mes</th>
                  <th className="py-2 px-2.5 text-center">Ops</th>
                  <th className="py-2 px-2.5 text-center">Win Rate</th>
                  <th className="py-2 px-2.5 text-right rounded-r">PnL Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {timeBreakdowns.monthlyList.map((m) => (
                  <tr key={m.period} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-2.5 text-slate-900 font-medium">{m.period}</td>
                    <td className="py-2.5 px-2.5 text-center text-slate-600">{m.ops}</td>
                    <td className="py-2.5 px-2.5 text-center text-slate-600">
                      {m.winRate.toFixed(0)}%
                    </td>
                    <td
                      className={`py-2.5 px-2.5 text-right font-bold ${
                        m.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatUSD(m.net, privacyMode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly Table */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
            Estadísticas Semanales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono bg-slate-50">
                  <th className="py-2 px-2.5 rounded-l">Semana</th>
                  <th className="py-2 px-2.5 text-center">Ops</th>
                  <th className="py-2 px-2.5 text-center">Win Rate</th>
                  <th className="py-2 px-2.5 text-right rounded-r">PnL Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {timeBreakdowns.weeklyList.slice(0, 6).map((w) => (
                  <tr key={w.period} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-2.5 text-slate-900 font-medium">{w.period}</td>
                    <td className="py-2.5 px-2.5 text-center text-slate-600">{w.ops}</td>
                    <td className="py-2.5 px-2.5 text-center text-slate-600">
                      {w.winRate.toFixed(0)}%
                    </td>
                    <td
                      className={`py-2.5 px-2.5 text-right font-bold ${
                        w.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatUSD(w.net, privacyMode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
