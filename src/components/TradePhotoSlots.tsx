import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  Maximize2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  TrendingUp,
  BarChart2,
  Image as ImageIcon,
} from 'lucide-react';
import { TradePhotoItem, TradePhotos } from '../types/trade';
import { uploadTradePhoto, deleteTradePhoto } from '../services/imageStorage';
import { TradePhotoViewerModal } from './TradePhotoViewerModal';

interface TradePhotoSlotsProps {
  tradeId: string;
  instrument: string;
  userId?: string;
  photos: TradePhotos;
  onChangePhotos: (updatedPhotos: TradePhotos) => void;
  // If provided, calls directly to persist on the trade (e.g. from TradeHistory details)
  onPersistChange?: (updatedPhotos: TradePhotos) => Promise<void>;
  readOnly?: boolean;
}

interface SlotState {
  uploading: boolean;
  progress: number;
  error: string | null;
}

export const TradePhotoSlots: React.FC<TradePhotoSlotsProps> = ({
  tradeId,
  instrument,
  userId,
  photos,
  onChangePhotos,
  onPersistChange,
  readOnly = false,
}) => {
  const [slotStates, setSlotStates] = useState<
    Record<'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF', SlotState>
  >({
    ENTRY_1M: { uploading: false, progress: 0, error: null },
    EXIT_1M: { uploading: false, progress: 0, error: null },
    CONTEXT_HTF: { uploading: false, progress: 0, error: null },
  });

  const [activeViewer, setActiveViewer] = useState<{
    photosList: TradePhotoItem[];
    index: number;
  } | null>(null);

  const [photoToDelete, setPhotoToDelete] = useState<{
    type: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF';
    item: TradePhotoItem;
  } | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRefs = {
    ENTRY_1M: useRef<HTMLInputElement>(null),
    EXIT_1M: useRef<HTMLInputElement>(null),
    CONTEXT_HTF: useRef<HTMLInputElement>(null),
  };

  const handleFileUpload = async (
    type: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF',
    file: File
  ) => {
    if (!file.type.startsWith('image/')) {
      setSlotStates((prev) => ({
        ...prev,
        [type]: { uploading: false, progress: 0, error: 'Por favor selecciona un archivo de imagen (PNG, JPG, WebP).' },
      }));
      return;
    }

    setSlotStates((prev) => ({
      ...prev,
      [type]: { uploading: true, progress: 10, error: null },
    }));

    try {
      const uploadedItem = await uploadTradePhoto({
        userId,
        tradeId,
        photoType: type,
        file,
        onProgress: (percent) => {
          setSlotStates((prev) => ({
            ...prev,
            [type]: { ...prev[type], progress: percent },
          }));
        },
      });

      const updatedPhotos: TradePhotos = {
        ...photos,
        ...(type === 'ENTRY_1M' ? { entry1M: uploadedItem } : {}),
        ...(type === 'EXIT_1M' ? { exit1M: uploadedItem } : {}),
        ...(type === 'CONTEXT_HTF' ? { contextHTF: uploadedItem } : {}),
      };

      onChangePhotos(updatedPhotos);
      if (onPersistChange) {
        await onPersistChange(updatedPhotos);
      }

      setSlotStates((prev) => ({
        ...prev,
        [type]: { uploading: false, progress: 100, error: null },
      }));
    } catch (err: any) {
      console.error('Error al subir imagen de la operación:', err);
      setSlotStates((prev) => ({
        ...prev,
        [type]: {
          uploading: false,
          progress: 0,
          error: err?.message || 'Error al procesar o guardar la captura. Inténtalo de nuevo.',
        },
      }));
    }
  };

  const confirmDeletePhoto = async () => {
    if (!photoToDelete) return;
    setIsDeleting(true);

    try {
      await deleteTradePhoto(userId, photoToDelete.item);

      const updatedPhotos: TradePhotos = { ...photos };
      if (photoToDelete.type === 'ENTRY_1M') delete updatedPhotos.entry1M;
      if (photoToDelete.type === 'EXIT_1M') delete updatedPhotos.exit1M;
      if (photoToDelete.type === 'CONTEXT_HTF') delete updatedPhotos.contextHTF;

      onChangePhotos(updatedPhotos);
      if (onPersistChange) {
        await onPersistChange(updatedPhotos);
      }
      setPhotoToDelete(null);
    } catch (err) {
      console.error('Error al eliminar captura:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const openViewerFor = (photoItem: TradePhotoItem) => {
    const list: TradePhotoItem[] = [];
    if (photos.entry1M) list.push(photos.entry1M);
    if (photos.exit1M) list.push(photos.exit1M);
    if (photos.contextHTF) list.push(photos.contextHTF);
    const idx = list.findIndex((p) => p.id === photoItem.id);
    setActiveViewer({
      photosList: list,
      index: Math.max(0, idx),
    });
  };

  const slotsConfig: {
    type: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF';
    title: string;
    badge: string;
    icon: React.ReactNode;
    subtitle: string;
    photo?: TradePhotoItem;
    purpose: string;
  }[] = [
    {
      type: 'ENTRY_1M',
      title: '1. Foto Antes de Entrar (Gráfico 1M)',
      badge: 'Temporalidad 1M · Entrada',
      icon: <Clock className="w-4 h-4 text-blue-600" />,
      subtitle: 'Captura del gráfico de 1 minuto antes de ejecutar la orden.',
      purpose: 'Muestra la entrada prevista, confirmación técnica, stop loss y objetivo programado.',
      photo: photos?.entry1M,
    },
    {
      type: 'EXIT_1M',
      title: '2. Foto Después de Cerrar (Gráfico 1M)',
      badge: 'Temporalidad 1M · Salida',
      icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
      subtitle: 'Captura de 1 minuto tras cerrar o salir de la posición.',
      purpose: 'Permite auditar la ejecución real, el precio de salida y el movimiento del precio.',
      photo: photos?.exit1M,
    },
    {
      type: 'CONTEXT_HTF',
      title: '3. Foto del Contexto del Mercado (15M / 1H)',
      badge: 'Temporalidad Mayor · Contexto',
      icon: <BarChart2 className="w-4 h-4 text-indigo-600" />,
      subtitle: 'Captura opcional de temporalidad mayor (15M o 1H) previa al trade.',
      purpose: 'Analiza la tendencia general, estructura de mercado y zonas clave de liquidez.',
      photo: photos?.contextHTF,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Informative Guidance Banner */}
      <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
        <Camera className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-blue-900 block">
            Auditoría Fotográfica de Scalping / Intradía en 1 Minuto (1M)
          </span>
          <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">
            Adjunta tus capturas para cada fase de la operación. Todas las imágenes son{' '}
            <strong className="text-slate-800">opcionales y omitibles</strong> si no las tienes en el momento.
            Se asocian directamente al ID único de esta operación{' '}
            <span className="font-mono font-semibold text-blue-800">({tradeId})</span>.
          </p>
        </div>
      </div>

      {/* Grid of 3 Photo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {slotsConfig.map((slot) => {
          const state = slotStates[slot.type];
          const hasPhoto = Boolean(slot.photo);

          return (
            <div
              key={slot.type}
              className={`border rounded-xl p-3.5 flex flex-col justify-between transition-all bg-white shadow-2xs ${
                hasPhoto
                  ? 'border-blue-200 bg-white ring-1 ring-blue-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Header of Slot */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                    {slot.badge}
                  </span>
                  {hasPhoto && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Cargada</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  {slot.icon}
                  <h4 className="text-xs font-bold text-slate-900">{slot.title}</h4>
                </div>

                <p className="text-[11px] text-slate-500 mb-2.5 leading-snug">
                  {slot.purpose}
                </p>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRefs[slot.type]}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(slot.type, file);
                    // Reset input so re-selecting same file works
                    e.target.value = '';
                  }}
                />

                {/* Slot Body: Photo Attached OR Upload Button */}
                {hasPhoto && slot.photo ? (
                  <div className="space-y-2 mt-2">
                    <div
                      className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group cursor-pointer aspect-video flex items-center justify-center shadow-2xs"
                      onClick={() => openViewerFor(slot.photo!)}
                    >
                      <img
                        src={slot.photo.url}
                        alt={slot.photo.label}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                        <span className="flex items-center gap-1 text-xs font-semibold bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-md">
                          <Maximize2 className="w-3.5 h-3.5" />
                          Ampliar gráfico 1M
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{slot.photo.fileName || 'captura.jpg'}</span>
                      {slot.photo.fileSize && (
                        <span>{Math.round(slot.photo.fileSize / 1024)} KB</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    {state.uploading ? (
                      <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200 flex flex-col items-center justify-center text-center space-y-2">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <span className="text-xs font-semibold text-blue-900">
                          {state.progress < 40 ? 'Procesando y optimizando...' : 'Guardando captura...'}
                        </span>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${state.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {state.progress}% completado
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => fileInputRefs[slot.type].current?.click()}
                        className="w-full py-4 px-3 border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-lg text-slate-600 hover:text-blue-700 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                          <Upload className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <span className="text-xs font-semibold">Adjuntar captura</span>
                        <span className="text-[10px] text-slate-400">PNG, JPG o WebP</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Error Banner if upload fails */}
                {state.error && (
                  <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{state.error}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons at bottom of slot */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                {hasPhoto && !readOnly ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openViewerFor(slot.photo!)}
                      className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Ver completa</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRefs[slot.type].current?.click()}
                        className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                        title="Cambiar imagen"
                      >
                        Reemplazar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoToDelete({ type: slot.type, item: slot.photo! })}
                        className="text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 cursor-pointer"
                        title="Eliminar captura"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </>
                ) : hasPhoto && readOnly ? (
                  <button
                    type="button"
                    onClick={() => openViewerFor(slot.photo!)}
                    className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer w-full justify-center"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Ver captura ampliada</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">
                    Opcional · Puedes omitirla si no tienes la foto
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal to Delete Photo */}
      {photoToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={() => !isDeleting && setPhotoToDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              ¿Eliminar captura del gráfico?
            </h3>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Vas a eliminar la captura de:{' '}
              <strong className="text-slate-800">{photoToDelete.item.label}</strong> vinculada a
              la operación <span className="font-mono font-semibold text-blue-700">{tradeId}</span>.
            </p>

            <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
              Nota: Todos los cálculos, contratos y entradas escalonadas permanecerán intactos. Solo se borrará la imagen seleccionada.
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPhotoToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeletePhoto}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {activeViewer && (
        <TradePhotoViewerModal
          photos={activeViewer.photosList}
          initialIndex={activeViewer.index}
          tradeId={tradeId}
          instrument={instrument}
          onClose={() => setActiveViewer(null)}
        />
      )}
    </div>
  );
};
