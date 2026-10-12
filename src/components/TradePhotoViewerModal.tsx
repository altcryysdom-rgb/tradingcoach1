import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ExternalLink, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { TradePhotoItem } from '../types/trade';

interface TradePhotoViewerModalProps {
  photos: TradePhotoItem[];
  initialIndex?: number;
  tradeId: string;
  instrument: string;
  onClose: () => void;
}

export const TradePhotoViewerModal: React.FC<TradePhotoViewerModalProps> = ({
  photos,
  initialIndex = 0,
  tradeId,
  instrument,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!photos || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex] || photos[0];

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setZoomLevel(1);
      setRotation(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setZoomLevel(1);
      setRotation(0);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-between p-3 sm:p-6 transition-all"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="w-full max-w-5xl bg-white/95 backdrop-blur-md rounded-xl px-4 py-3 border border-slate-200/80 shadow-lg flex items-center justify-between text-slate-900 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0f1f38] text-white flex items-center justify-center shadow-xs">
            <Camera className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                {currentPhoto.label}
              </span>
              <span className="text-xs font-bold text-slate-800 font-mono">{instrument}</span>
              <span className="text-xs text-slate-500 font-mono">({tradeId})</span>
            </div>
            {currentPhoto.description && (
              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                {currentPhoto.description}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reducir zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-semibold text-slate-600 px-1">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Rotar 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
            title="Reiniciar vista"
          >
            Restablecer
          </button>

          <a
            href={currentPhoto.url}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
            title="Abrir imagen original en nueva pestaña"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ml-2"
            title="Cerrar visor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 w-full flex items-center justify-center overflow-auto p-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {photos.length > 1 && currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
            title="Foto anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200">
          <img
            src={currentPhoto.url}
            alt={currentPhoto.label}
            style={{
              transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            className="max-h-[75vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-transform duration-150 cursor-grab active:cursor-grabbing border border-slate-700/30"
          />
        </div>

        {photos.length > 1 && currentIndex < photos.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
            title="Siguiente foto"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Bar (if multiple photos) */}
      <div
        className="w-full max-w-xl bg-white/95 backdrop-blur-md rounded-xl p-2.5 border border-slate-200/80 shadow-lg flex items-center justify-center gap-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {photos.map((p, idx) => (
          <button
            key={p.id || idx}
            onClick={() => {
              setCurrentIndex(idx);
              setZoomLevel(1);
              setRotation(0);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              idx === currentIndex
                ? 'bg-[#0f1f38] text-white border-[#0f1f38] shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <img src={p.url} alt={p.label} className="w-6 h-6 object-cover rounded" />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
