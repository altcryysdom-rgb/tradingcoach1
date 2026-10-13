import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { Trade, TradePhotoItem, TradePhotos } from '../types/trade';

export interface ImageProcessingResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
}

/**
 * Compresses an image client-side to ensure optimal resolution for 1-minute candlestick
 * charts while keeping size light and fast to upload (~120KB-280KB).
 */
export async function compressTradeImage(
  file: File,
  maxDimension = 1280,
  quality = 0.75
): Promise<ImageProcessingResult> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) {
    return Promise.reject(new Error('Formato no compatible. Selecciona una imagen JPG, PNG o WebP.'));
  }
  if (file.size <= 0 || file.size >= 15 * 1024 * 1024) {
    return Promise.reject(new Error('La imagen debe pesar menos de 15 MB antes de comprimirla.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido o corrupto.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el procesador gráfico (Canvas 2D).'));
          return;
        }

        // Draw image with smooth rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al comprimir la captura del gráfico.'));
              return;
            }
            resolve({
              blob,
              dataUrl,
              width,
              height,
              size: blob.size,
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Returns human-readable label for trade photo types
 */
export function getPhotoTypeLabel(type: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF'): string {
  switch (type) {
    case 'ENTRY_1M':
      return 'Gráfico 1M (Antes de entrar)';
    case 'EXIT_1M':
      return 'Gráfico 1M (Después de cerrar)';
    case 'CONTEXT_HTF':
      return 'Contexto Macro (15M / 1H)';
    default:
      return 'Captura del Gráfico';
  }
}

/**
 * Uploads a trade photo.
 * Tries Firebase Storage first (when user is authenticated and Storage is provisioned).
 * If Firebase Storage is unavailable or offline, safely persists via optimized dataUrl
 * in the Trade document so that user captures are NEVER lost.
 */
export async function uploadTradePhoto(params: {
  userId?: string;
  tradeId: string;
  photoType: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF';
  file: File;
  description?: string;
  onProgress?: (percent: number) => void;
}): Promise<TradePhotoItem> {
  const { userId, tradeId, photoType, file, description, onProgress } = params;

  // 1. Process and compress image client-side
  if (onProgress) onProgress(15);
  const processed = await compressTradeImage(file);
  if (onProgress) onProgress(35);

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const fileExt = 'jpg';
  const targetFileName = `${photoType.toLowerCase()}_${timestamp}.${fileExt}`;
  const storagePath = userId ? `users/${userId}/trades/${tradeId}/${targetFileName}` : undefined;

  let finalUrl = processed.dataUrl;

  // 2. If user is logged in, attempt Firebase Storage upload
  if (userId && storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, processed.blob, {
        contentType: 'image/jpeg',
        customMetadata: {
          tradeId,
          photoType,
          originalName: cleanFileName,
          userId,
        },
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round(
              35 + (snapshot.bytesTransferred / snapshot.totalBytes) * 60
            );
            if (onProgress) onProgress(Math.min(progress, 95));
          },
          (error) => {
            console.warn(
              'Firebase Storage upload encountered an issue, falling back to secure inline sync:',
              error
            );
            reject(error);
          },
          async () => {
            try {
              finalUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });
    } catch (storageErr) {
      console.warn(
        'Using resilient direct storage because Firebase Storage bucket is not reachable or pending activation:',
        storageErr
      );
      // Fallback is already finalUrl = processed.dataUrl!
    }
  }

  if (onProgress) onProgress(100);

  const photoItem: TradePhotoItem = {
    id: `photo-${photoType.toLowerCase()}-${timestamp}`,
    type: photoType,
    label: getPhotoTypeLabel(photoType),
    url: finalUrl,
    storagePath,
    fileName: cleanFileName,
    fileSize: processed.size,
    description: description || '',
    uploadedAt: new Date().toISOString(),
  };

  return photoItem;
}

/**
 * Deletes a trade photo from Firebase Storage if it was hosted there.
 */
export async function deleteTradePhoto(
  userId: string | undefined,
  photoItem: TradePhotoItem
): Promise<void> {
  if (userId && photoItem.storagePath) {
    try {
      const storageRef = ref(storage, photoItem.storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      // If object doesn't exist or storage is offline, gracefully ignore
      console.warn('Could not remove file from Firebase Storage bucket (may be local):', err);
    }
  }
}

/**
 * Updates a trade with a new photo item in its `photos` property.
 * Maintains all existing calculations, entries, scale-ins and notes intact.
 */
export function attachPhotoToTrade(
  trade: Trade,
  photoType: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF',
  photoItem: TradePhotoItem
): Trade {
  const currentPhotos: TradePhotos = { ...(trade.photos || {}) };

  if (photoType === 'ENTRY_1M') {
    currentPhotos.entry1M = photoItem;
  } else if (photoType === 'EXIT_1M') {
    currentPhotos.exit1M = photoItem;
  } else if (photoType === 'CONTEXT_HTF') {
    currentPhotos.contextHTF = photoItem;
  }

  return {
    ...trade,
    photos: currentPhotos,
    // Keep screenshotUrl synced to the 1M entry photo or any primary photo for backwards compatibility
    screenshotUrl: currentPhotos.entry1M?.url || currentPhotos.exit1M?.url || trade.screenshotUrl,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Removes a photo from a trade's `photos` property.
 */
export function removePhotoFromTrade(
  trade: Trade,
  photoType: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF'
): Trade {
  const currentPhotos: TradePhotos = { ...(trade.photos || {}) };

  if (photoType === 'ENTRY_1M') {
    delete currentPhotos.entry1M;
  } else if (photoType === 'EXIT_1M') {
    delete currentPhotos.exit1M;
  } else if (photoType === 'CONTEXT_HTF') {
    delete currentPhotos.contextHTF;
  }

  return {
    ...trade,
    photos: currentPhotos,
    screenshotUrl: currentPhotos.entry1M?.url || currentPhotos.exit1M?.url || '',
    updatedAt: new Date().toISOString(),
  };
}
