import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Trade, Settings, TradeOutcome, TradePhotoItem } from '../types/trade';
import {
  formatUSD,
  formatPoints,
  formatR,
} from '../utils/calculations';
import { exportTradesToCSV } from '../utils/storage';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Edit,
  Eye,
  TrendingUp,
  TrendingDown,
  X,
  ExternalLink,
  Star,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Calendar,
  Loader2,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { TradePhotoSlots } from './TradePhotoSlots';
import { TradePhotoViewerModal } from './TradePhotoViewerModal';

interface TradeHistoryProps {
  trades: Trade[];
  settings: Settings;
  privacyMode: boolean;
  user?: User | null;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (tradeId: string) => Promise<{ success: boolean; error?: string }> | any;
  onUpdateTrade?: (trade: Trade) => Promise<void> | void;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({
  trades,
  settings,
  privacyMode,
  user,
  onEditTrade,
  onDeleteTrade,
  onUpdateTrade,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [photosOnlyFilter, setPhotosOnlyFilter] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [quickViewPhotos, setQuickViewPhotos] = useState<{
    photos: TradePhotoItem[];
    tradeId: string;
    instrument: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleConfirmDelete = async () => {
    if (!tradeToDelete) return;
    setIsDeleting(true);
    const targetId = tradeToDelete.id;
    try {
      const result = await onDeleteTrade(targetId);
      if (result && result.success === false) {
        console.error('Error al eliminar operación en Firestore:', result.error);
        setFeedback({
          type: 'error',
          message: result.error || `No se pudo eliminar la operación ${targetId}.`,
        });
      } else {
        // Success
        setTradeToDelete(null);
        if (selectedTrade?.id === targetId) {
          setSelectedTrade(null);
        }
        setFeedback({
          type: 'success',
          message: `Operación ${targetId} eliminada exitosamente del diario y de la base de datos.`,
        });
        setTimeout(() => {
          setFeedback((prev) => (prev?.message.includes(targetId) ? null : prev));
        }, 5000);
      }
    } catch (err: any) {
      console.error('Error inesperado al eliminar operación:', err);
      setFeedback({
        type: 'error',
        message: err?.message || `Error inesperado al eliminar la operación ${targetId}.`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered and sorted trade list (newest first)
  const filteredTrades = useMemo(() => {
    return [...trades]
      .filter((t) => {
        if (instrumentFilter !== 'ALL' && t.instrument !== instrumentFilter) return false;
        if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
        if (outcomeFilter !== 'ALL' && t.outcome !== outcomeFilter) return false;

        if (photosOnlyFilter) {
          const hasPhotos = Boolean(
            t.photos?.entry1M || t.photos?.exit1M || t.photos?.contextHTF || t.screenshotUrl
          );
          if (!hasPhotos) return false;
        }

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchId = t.id.toLowerCase().includes(q);
          const matchStrategy = t.strategy?.toLowerCase().includes(q);
          const matchLessons = t.lessons?.toLowerCase().includes(q);
          const matchNotes = t.notes?.toLowerCase().includes(q);
          if (!matchId && !matchStrategy && !matchLessons && !matchNotes) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = `${a.date} ${a.time || '00:00'}`;
        const dateB = `${b.date} ${b.time || '00:00'}`;
        return dateB.localeCompare(dateA);
      });
  }, [trades, instrumentFilter, directionFilter, outcomeFilter, photosOnlyFilter, searchTerm]);

  const handleExportCSV = () => {
    exportTradesToCSV(filteredTrades, settings.csvDelimiter || ';');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Historial de Operaciones</span>
            <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              {filteredTrades.length} de {trades.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro completo auditable con desglose de hasta 6 entradas por ID.
          </p>
        </div>

        {/* Export & Search Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar estrategia, nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 w-48 sm:w-60 shadow-2xs"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-[#0f1f38] hover:bg-[#1a365d] text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Exportar archivo compatible con Microsoft Excel (UTF-8 BOM)"
          >
            <Download className="w-3.5 h-3.5 text-blue-300" />
            <span>Exportar CSV (Excel)</span>
          </button>
        </div>
      </div>

      {/* Alert / Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between shadow-2xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold font-sans">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 text-slate-500 cursor-pointer"
            title="Cerrar mensaje"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs / Selectors */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-xs">
        {/* Instrument */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-medium text-[11px] mr-1">Instrumento:</span>
          <button
            onClick={() => setInstrumentFilter('ALL')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              instrumentFilter === 'ALL'
                ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setInstrumentFilter('MNQ')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              instrumentFilter === 'MNQ'
                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            MNQ
          </button>
          <button
            onClick={() => setInstrumentFilter('MGC')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              instrumentFilter === 'MGC'
                ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            MGC
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

        {/* Direction */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-medium text-[11px] mr-1">Dirección:</span>
          <button
            onClick={() => setDirectionFilter('ALL')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              directionFilter === 'ALL'
                ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setDirectionFilter('LONG')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              directionFilter === 'LONG'
                ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            LONG
          </button>
          <button
            onClick={() => setDirectionFilter('SHORT')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              directionFilter === 'SHORT'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SHORT
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

        {/* Outcome */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-medium text-[11px] mr-1">Resultado:</span>
          <button
            onClick={() => setOutcomeFilter('ALL')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              outcomeFilter === 'ALL'
                ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setOutcomeFilter('GANADORA')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              outcomeFilter === 'GANADORA'
                ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ganadas
          </button>
          <button
            onClick={() => setOutcomeFilter('PERDIDA')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              outcomeFilter === 'PERDIDA'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Perdidas
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

        {/* Photos 1M filter */}
        <button
          onClick={() => setPhotosOnlyFilter((prev) => !prev)}
          className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 text-xs ${
            photosOnlyFilter
              ? 'bg-blue-100 text-blue-900 font-bold border border-blue-300 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
          title="Filtrar operaciones que tienen capturas de gráfico 1M o contexto"
        >
          <Camera className={`w-3.5 h-3.5 ${photosOnlyFilter ? 'text-blue-700' : 'text-slate-500'}`} />
          <span>Con fotos 1M</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold font-mono">
                <th className="py-3 px-3">Fecha / ID</th>
                <th className="py-3 px-3">Activo</th>
                <th className="py-3 px-3">Dirección</th>
                <th className="py-3 px-3">Posición (Contratos)</th>
                <th className="py-3 px-3 text-right">Precio Promedio</th>
                <th className="py-3 px-3 text-right">Precio Salida</th>
                <th className="py-3 px-3 text-right">Puntos</th>
                <th className="py-3 px-3 text-right">PnL Neto</th>
                <th className="py-3 px-3 text-center">Múltiplo R</th>
                <th className="py-3 px-3 text-center">Disciplina</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 font-sans">
                    No se encontraron operaciones registradas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Date / ID */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{t.date}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 font-sans">
                        <span>{t.time}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-400">{t.id.slice(0, 15)}</span>
                      </div>
                      {(() => {
                        const photoList: TradePhotoItem[] = [];
                        if (t.photos?.entry1M) photoList.push(t.photos.entry1M);
                        if (t.photos?.exit1M) photoList.push(t.photos.exit1M);
                        if (t.photos?.contextHTF) photoList.push(t.photos.contextHTF);
                        if (photoList.length === 0 && t.screenshotUrl) {
                          photoList.push({
                            id: 'legacy',
                            type: 'ENTRY_1M',
                            label: 'Captura del Gráfico',
                            url: t.screenshotUrl,
                            uploadedAt: t.createdAt,
                          });
                        }
                        if (photoList.length === 0) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickViewPhotos({
                                photos: photoList,
                                tradeId: t.id,
                                instrument: t.instrument,
                              });
                            }}
                            className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold transition-colors cursor-pointer"
                            title={`Ver ${photoList.length} captura(s) de gráfico en pantalla completa`}
                          >
                            <Camera className="w-3 h-3 text-blue-600" />
                            <span>1M ({photoList.length})</span>
                          </button>
                        );
                      })()}
                    </td>

                    {/* Instrument */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          t.instrument === 'MNQ'
                            ? 'text-blue-700 bg-blue-50 border border-blue-200'
                            : 'text-amber-700 bg-amber-50 border border-amber-200'
                        }`}
                      >
                        {t.instrument}
                      </span>
                    </td>

                    {/* Direction */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                          t.direction === 'LONG' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {t.direction === 'LONG' ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        {t.direction}
                      </span>
                    </td>

                    {/* Contracts & Scale-Ins */}
                    <td className="py-2.5 px-3">
                      <div className="text-slate-900 font-bold">
                        {t.totalContracts} ct{t.totalContracts > 1 ? 's' : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        <span>
                          {t.entries.length} entrada{t.entries.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>

                    {/* Weighted Avg Price */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                      {t.weightedAvgPrice.toFixed(2)}
                    </td>

                    {/* Exit Price */}
                    <td className="py-2.5 px-3 text-right text-slate-700">
                      {t.exitPrice ? t.exitPrice.toFixed(2) : '-'}
                    </td>

                    {/* Gross Points */}
                    <td
                      className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                        t.grossPoints > 0
                          ? 'text-emerald-700'
                          : t.grossPoints < 0
                          ? 'text-rose-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatPoints(t.grossPoints)}
                    </td>

                    {/* Net PnL */}
                    <td
                      className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                        t.netPnL > 0
                          ? 'text-emerald-700'
                          : t.netPnL < 0
                          ? 'text-rose-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {formatUSD(t.netPnL, privacyMode)}
                    </td>

                    {/* R Multiple */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          t.rMultiple !== null && t.rMultiple > 0
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : t.rMultiple !== null && t.rMultiple < 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'text-slate-500'
                        }`}
                      >
                        {formatR(t.rMultiple)}
                      </span>
                    </td>

                    {/* Discipline */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-slate-800 font-bold text-[11px]">
                          {t.disciplineScore || 5}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedTrade(t)}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Ver detalle completo de la operación"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditTrade(t)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Editar operación"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTradeToDelete(t)}
                          className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title={`Eliminar operación ${t.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl p-6 space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">
                    ID: {selectedTrade.id}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      selectedTrade.outcome === 'GANADORA'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : selectedTrade.outcome === 'PERDIDA'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {selectedTrade.outcome}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <span>{selectedTrade.instrument}</span>
                  <span
                    className={
                      selectedTrade.direction === 'LONG'
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }
                  >
                    {selectedTrade.direction}
                  </span>
                  <span className="text-slate-500 text-sm font-normal">
                    · {selectedTrade.totalContracts} contratos
                  </span>
                </h2>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-mono">
                  <span>{selectedTrade.date}</span>
                  <span>{selectedTrade.time}</span>
                  <span>·</span>
                  <span>{selectedTrade.session}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTrade(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scale-In Breakdown Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Desglose de Entradas Escalonadas ({selectedTrade.entries.length} entradas)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 font-semibold font-mono">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Contratos</th>
                      <th className="py-2.5 px-3">Precio</th>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {selectedTrade.entries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 text-slate-700 font-medium">Entrada {e.entryNumber}</td>
                        <td className="py-2 px-3 text-slate-900 font-bold">{e.contracts} ct{e.contracts > 1 ? 's' : ''}</td>
                        <td className="py-2 px-3 text-blue-700 font-bold">{e.price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-slate-500">{e.time || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 font-sans">{e.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-mono font-bold text-slate-800 border-t border-slate-200">
                      <td className="py-2.5 px-3">Promedio Ponderado:</td>
                      <td className="py-2.5 px-3 text-slate-900">{selectedTrade.totalContracts} cts</td>
                      <td className="py-2.5 px-3 text-blue-700">{selectedTrade.weightedAvgPrice.toFixed(2)}</td>
                      <td colSpan={2} className="py-2.5 px-3 text-[11px] text-slate-500 font-sans font-normal">
                        Fórmula: ∑(c_i × p_i) / {selectedTrade.totalContracts}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Financial Results Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Stop Inicial</span>
                <span className="text-sm font-bold font-mono text-rose-700 mt-0.5 block">
                  {selectedTrade.initialStop ? selectedTrade.initialStop.toFixed(2) : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">
                  Riesgo: ${selectedTrade.initialRiskDollars.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Precio Salida</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                  {selectedTrade.exitPrice ? selectedTrade.exitPrice.toFixed(2) : 'Abierta'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">
                  Puntos: {formatPoints(selectedTrade.grossPoints)}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Comisiones</span>
                <span className="text-sm font-bold font-mono text-slate-700 mt-0.5 block">
                  -${selectedTrade.commissions.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">
                  Bruto: {formatUSD(selectedTrade.grossPnL)}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200">
                <span className="text-[11px] text-slate-500 block">Resultado Neto</span>
                <span
                  className={`text-base font-bold font-mono mt-0.5 block ${
                    selectedTrade.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatUSD(selectedTrade.netPnL, privacyMode)}
                </span>
                <span className="text-[10px] text-blue-700 font-mono block">
                  Retorno: {formatR(selectedTrade.rMultiple)}
                </span>
              </div>
            </div>

            {/* Psychology & Journal Section */}
            <div className="space-y-3 pt-2 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-600 font-semibold block mb-1">
                  Estrategia:
                </span>
                <span className="text-slate-900 font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
                  {selectedTrade.strategy || 'No especificada'}
                </span>
              </div>

              {selectedTrade.emotionsBefore && selectedTrade.emotionsBefore.length > 0 && (
                <div>
                  <span className="text-slate-600 font-semibold block mb-1">
                    Emociones Experimentadas:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedTrade.emotionsBefore.map((emo) => (
                      <span
                        key={emo}
                        className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px]"
                      >
                        {emo}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTrade.mistakes && selectedTrade.mistakes.length > 0 && (
                <div>
                  <span className="text-slate-600 font-semibold block mb-1">
                    Auditoría de Errores:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedTrade.mistakes.map((mst) => (
                      <span
                        key={mst}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          mst === 'Ninguno (Plan ejecutado)'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border border-rose-200 text-rose-800'
                        }`}
                      >
                        {mst}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTrade.lessons && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-blue-700 font-semibold block mb-1">
                    Lección Aprendida:
                  </span>
                  <p className="text-slate-700 leading-relaxed font-sans">
                    {selectedTrade.lessons}
                  </p>
                </div>
              )}

              {selectedTrade.notes && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-600 font-semibold block mb-1">
                    Notas Generales:
                  </span>
                  <p className="text-slate-700 leading-relaxed font-sans">
                    {selectedTrade.notes}
                  </p>
                </div>
              )}
            </div>

            {/* 1M & HTF Chart Screenshots Gallery */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Capturas de Gráfico (Operativa en 1M & Contexto)</span>
                </h3>
              </div>

              <TradePhotoSlots
                tradeId={selectedTrade.id}
                instrument={selectedTrade.instrument}
                userId={user?.uid}
                photos={selectedTrade.photos || {}}
                onChangePhotos={(updatedPhotos) => {
                  const primaryPhotoUrl =
                    updatedPhotos.entry1M?.url ||
                    updatedPhotos.exit1M?.url ||
                    updatedPhotos.contextHTF?.url;
                  const cleanScreenshotUrl =
                    primaryPhotoUrl ||
                    (selectedTrade.screenshotUrl &&
                    !selectedTrade.screenshotUrl.startsWith('data:') &&
                    !selectedTrade.screenshotUrl.includes('firebasestorage')
                      ? selectedTrade.screenshotUrl
                      : '');

                  const updatedTrade: Trade = {
                    ...selectedTrade,
                    photos: updatedPhotos,
                    screenshotUrl: cleanScreenshotUrl,
                  };
                  setSelectedTrade(updatedTrade);
                  if (onUpdateTrade) {
                    onUpdateTrade(updatedTrade);
                  }
                }}
                onPersistChange={async (updatedPhotos) => {
                  const primaryPhotoUrl =
                    updatedPhotos.entry1M?.url ||
                    updatedPhotos.exit1M?.url ||
                    updatedPhotos.contextHTF?.url;
                  const cleanScreenshotUrl =
                    primaryPhotoUrl ||
                    (selectedTrade.screenshotUrl &&
                    !selectedTrade.screenshotUrl.startsWith('data:') &&
                    !selectedTrade.screenshotUrl.includes('firebasestorage')
                      ? selectedTrade.screenshotUrl
                      : '');

                  const updatedTrade: Trade = {
                    ...selectedTrade,
                    photos: updatedPhotos,
                    screenshotUrl: cleanScreenshotUrl,
                  };
                  setSelectedTrade(updatedTrade);
                  if (onUpdateTrade) {
                    await onUpdateTrade(updatedTrade);
                  }
                }}
              />

              {selectedTrade.screenshotUrl &&
                !selectedTrade.photos?.entry1M &&
                !selectedTrade.photos?.exit1M && (
                  <div className="pt-1">
                    <span className="text-slate-600 font-semibold text-xs block mb-1">
                      Enlace a gráfico externo:
                    </span>
                    <a
                      href={selectedTrade.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                    >
                      <span>Abrir captura en pestaña nueva</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const t = selectedTrade;
                    setSelectedTrade(null);
                    onEditTrade(t);
                  }}
                  className="px-4 py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar Operación</span>
                </button>

                <button
                  onClick={() => {
                    setTradeToDelete(selectedTrade);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 hover:text-rose-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Eliminar esta operación"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Eliminar</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedTrade(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal to Delete Trade */}
      {tradeToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4 text-slate-900">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  ¿Eliminar operación definitivamente?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esta acción eliminará de forma permanente esta operación tanto del diario local como de Firebase Firestore.
                </p>
              </div>
            </div>

            {/* Trade Details Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 font-mono">
                <span className="text-slate-500 text-[11px]">ID de Operación:</span>
                <span className="font-bold text-slate-900">{tradeToDelete.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Instrumento / Dirección:</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 font-mono">
                  <span>{tradeToDelete.instrument}</span>
                  <span aria-hidden="true">·</span>
                  <span className={tradeToDelete.direction === 'LONG' ? 'text-emerald-700' : 'text-rose-700'}>
                    {tradeToDelete.direction}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Fecha y Hora:</span>
                <span className="text-slate-800 font-mono">{tradeToDelete.date} {tradeToDelete.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Posición y Entradas:</span>
                <span className="text-slate-800 font-mono">
                  {tradeToDelete.totalContracts} cts ({tradeToDelete.entries?.length || 1} {tradeToDelete.entries?.length === 1 ? 'entrada' : 'entradas'})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Precio Promedio:</span>
                <span className="text-blue-700 font-bold font-mono">
                  {tradeToDelete.weightedAvgPrice?.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-mono">
                <span className="text-slate-500 text-[11px]">Resultado Neto:</span>
                <span className={`font-bold ${tradeToDelete.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatUSD(tradeToDelete.netPnL, privacyMode)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Sólo se eliminará este registro específico (ID: <strong className="text-slate-700">{tradeToDelete.id}</strong>). Todas tus demás operaciones y configuraciones se mantendrán intactas.
            </p>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setTradeToDelete(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando de Firestore...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Operación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Photo Viewer Modal (from table row button) */}
      {quickViewPhotos && (
        <TradePhotoViewerModal
          photos={quickViewPhotos.photos}
          initialIndex={0}
          tradeId={quickViewPhotos.tradeId}
          instrument={quickViewPhotos.instrument}
          onClose={() => setQuickViewPhotos(null)}
        />
      )}
    </div>
  );
};
