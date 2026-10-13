import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '24mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Verify Firebase ID tokens before allowing access to Gemini-backed endpoints.
app.use('/api/coach', async (req, res, next) => {
  const authorization = req.header('authorization') || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch || !firebaseConfig.apiKey) {
    res.status(401).json({ error: 'Inicia sesión con Google para utilizar las funciones de IA.' });
    return;
  }

  try {
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: tokenMatch[1] }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!verifyResponse.ok) {
      res.status(401).json({ error: 'La sesión no es válida o ha expirado. Inicia sesión de nuevo.' });
      return;
    }
    const verified = await verifyResponse.json() as { users?: Array<{ localId?: string }> };
    if (!verified.users?.[0]?.localId) {
      res.status(401).json({ error: 'No se pudo verificar la sesión de Firebase.' });
      return;
    }
    (req as Request & { firebaseUid?: string }).firebaseUid = verified.users[0].localId;
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(503).json({ error: 'No se pudo verificar la sesión. Inténtalo de nuevo.' });
  }
});

// Per-IP rate limiting reduces accidental loops and abuse of the Gemini quota.
// Also enforce limits at the hosting/proxy layer in production.
const COACH_RATE_WINDOW_MS = 15 * 60 * 1000;
const COACH_RATE_LIMIT = 30;
const coachRequestCounts = new Map<string, { count: number; resetAt: number }>();
app.use('/api/coach', (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  let entry = coachRequestCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + COACH_RATE_WINDOW_MS };
  }
  entry.count += 1;
  coachRequestCounts.set(key, entry);
  if (coachRequestCounts.size > 5000) {
    for (const [ip, value] of coachRequestCounts) {
      if (value.resetAt <= now) coachRequestCounts.delete(ip);
    }
  }
  res.setHeader('RateLimit-Limit', String(COACH_RATE_LIMIT));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, COACH_RATE_LIMIT - entry.count)));
  if (entry.count > COACH_RATE_LIMIT) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Demasiadas solicitudes al Coach. Espera unos minutos e inténtalo de nuevo.' });
    return;
  }
  next();
});

// Initialize Google GenAI on the server with recommended User-Agent header
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];

async function generateWithFallback(contents: any, config: any) {
  let lastErr: any;
  for (const model of CANDIDATE_MODELS) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return resp;
    } catch (err: any) {
      console.warn(`Model ${model} returned error, trying candidate:`, err?.message || err);
      lastErr = err;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr;
}

interface ParsedImagePart {
  part: {
    inlineData: {
      mimeType: string;
      data: string;
    };
  };
  label: string;
  type: string;
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);

async function parseImageToInlinePart(img: any): Promise<ParsedImagePart | null> {
  if (!img || typeof img !== 'object') return null;
  try {
    let base64Data = '';
    let mimeType = 'image/jpeg';
    const label =
      img.label ||
      (img.type === 'ENTRY_1M'
        ? 'Gráfico 1M Antes de Entrar'
        : img.type === 'EXIT_1M'
        ? 'Gráfico 1M Después de Cerrar'
        : img.type === 'CONTEXT_HTF'
        ? 'Contexto Mayor (15M / 1H)'
        : 'Captura de gráfico');
    const type = img.type || 'GRAPH';

    // Direct base64 data provided
    if (typeof img.data === 'string' && img.data.trim()) {
      base64Data = img.data.trim();
      mimeType = img.mimeType || 'image/jpeg';
    } else {
      const rawUrl = img.dataUrl || img.url;
      if (!rawUrl || typeof rawUrl !== 'string') return null;

      if (rawUrl.startsWith('data:')) {
        const matches = rawUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (matches && matches[2]) {
          mimeType = matches[1];
          base64Data = matches[2].trim();
        } else {
          return null;
        }
      } else {
        let imageUrl: URL;
        try {
          imageUrl = new URL(rawUrl);
        } catch {
          return null;
        }
        // Only download from Firebase Storage hosts. Reject HTTP, credentials, redirects
        // and arbitrary URLs to prevent SSRF against internal services.
        if (
          imageUrl.protocol !== 'https:' ||
          !ALLOWED_IMAGE_HOSTS.has(imageUrl.hostname) ||
          imageUrl.username ||
          imageUrl.password
        ) return null;

        const fetchRes = await fetch(imageUrl, { redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!fetchRes.ok || !fetchRes.body) return null;
        const headerMime = (fetchRes.headers.get('content-type') || '').split(';')[0].toLowerCase();
        if (!ALLOWED_IMAGE_MIME_TYPES.has(headerMime)) return null;
        const contentLength = Number(fetchRes.headers.get('content-length') || 0);
        if (contentLength > MAX_IMAGE_BYTES) {
          await fetchRes.body.cancel();
          return null;
        }

        const reader = fetchRes.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          if (totalBytes > MAX_IMAGE_BYTES) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
        if (totalBytes === 0) return null;
        base64Data = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('base64');
        mimeType = headerMime;
      }
    }

    if (!base64Data) return null;
    base64Data = base64Data.replace(/\s/g, '');
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) return null;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) return null;
    const decodedBytes = Buffer.from(base64Data, 'base64');
    if (decodedBytes.length === 0 || decodedBytes.length > MAX_IMAGE_BYTES) return null;
    base64Data = decodedBytes.toString('base64');
    mimeType = mimeType.toLowerCase();

    return {
      part: {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      label,
      type,
    };
  } catch (err) {
    console.warn('Error al procesar parte de imagen para Gemini:', err);
    return null;
  }
}

/**
 * Endpoint: POST /api/coach/chat
 * Handles conversational trade logging, queries, psychology reflections, and coaching advice.
 */
app.post('/api/coach/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      message,
      history = [],
      trades = [],
      settings = {},
      currentDate = new Date().toISOString().split('T')[0],
      currentTime = new Date().toTimeString().slice(0, 5),
      images = [],
      tradeContext = null,
    } = req.body;

    const messageText = typeof message === 'string' ? message.trim() : '';
    if (!messageText && (!Array.isArray(images) || images.length === 0)) {
      res.status(400).json({ error: 'Escribe un mensaje o adjunta al menos una imagen.' });
      return;
    }
    if (!Array.isArray(images) || images.length > 4) {
      res.status(400).json({ error: 'Puedes enviar hasta 4 imágenes por mensaje.' });
      return;
    }
    if (!Array.isArray(trades) || !Array.isArray(history)) {
      res.status(400).json({ error: 'El formato del contexto enviado no es válido.' });
      return;
    }

    if (!apiKey) {
      res.status(500).json({
        error:
          'La clave GEMINI_API_KEY no está configurada en las variables de entorno del servidor.',
      });
      return;
    }

    // Process attached images if provided
    const validImageParts: ParsedImagePart[] = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const rawImg of images) {
        const parsed = await parseImageToInlinePart(rawImg);
        if (parsed) {
          validImageParts.push(parsed);
        }
      }
    }

    // Format trades context for Gemini
    const tradesContext = trades.slice(0, 50).map((t: any) => ({
      id: t.id,
      date: t.date,
      time: t.time,
      instrument: t.instrument,
      direction: t.direction,
      status: t.status,
      outcome: t.outcome,
      totalContracts: t.totalContracts,
      entriesCount: t.entries?.length || 1,
      entries: t.entries?.map((e: any) => ({
        entryNumber: e.entryNumber,
        contracts: e.contracts,
        price: e.price,
      })),
      weightedAvgPrice: t.weightedAvgPrice,
      initialStop: t.initialStop,
      currentStop: t.currentStop,
      takeProfit: t.takeProfit,
      exitPrice: t.exitPrice,
      grossPoints: t.grossPoints,
      grossPnL: t.grossPnL,
      commissions: t.commissions,
      netPnL: t.netPnL,
      rMultiple: t.rMultiple,
      strategy: t.strategy,
      emotionsBefore: t.emotionsBefore,
      disciplineScore: t.disciplineScore,
      mistakes: t.mistakes,
      lessons: t.lessons,
      hasPhotos: !!(t.photos?.entry1M || t.photos?.exit1M || t.photos?.contextHTF),
    }));

    const systemInstruction = `Eres "Trading Coach", un mentor y asistente experto de inteligencia artificial conectado directamente al diario de trading de futuros de MNQ (Micro Nasdaq-100, $2/punto) y MGC (Micro Gold, $10/punto).

OBJETIVO PRINCIPAL:
Permitir al usuario registrar sus operaciones de trading, reflexiones y analizar técnica y psicológicamente su operativa de forma conversacional y visual.

CAPACIDADES MULTIMODALES Y ANÁLISIS DE CAPTURAS:
1. SOLO analiza visualmente las capturas realmente adjuntas a esta solicitud. Si no recibes imágenes, no afirmes haberlas visto ni inventes detalles visuales.
2. ANÁLISIS BASADO EXCLUSIVAMENTE EN LO VISIBLE:
   - Examina la estructura del precio (velas, impulsos, retrocesos, niveles de soporte/resistencia, altos y bajos).
   - Comprueba el gatillo de entrada y la salida en relación a la acción del precio.
   - NUNCA inventes indicadores técnicos (como medias móviles, RSI, MACD, etc.) a menos que estén claramente dibujados en la captura recibida.
   - Si la escala de precios o alguna vela no es legible debido a la resolución o recorte, indícalo con transparencia: "No es posible leer con precisión el precio exacto en la escala lateral de la captura".
   - Si se adjuntan fotos de una operación, compara lo que ves en las velas con los datos numéricos registrados del trade (instrumento, dirección, precio medio, stop, salida).
3. CUANDO NO SE ADJUNTA IMAGEN: Si el usuario te pide analizar una captura o foto pero NO hay ninguna imagen adjunta en la solicitud, NO digas que la analizaste ni que no tienes capacidad para procesar imágenes; simplemente indícale con amabilidad que para verla debe seleccionarla o adjuntarla mediante el selector de fotos del trade o el botón de adjuntar.

REGLAS DE LA ENTREVISTA PASO A PASO:
1. ADAPTACIÓN TOTAL: Reconoce y extrae TODOS los datos que el usuario ya haya mencionado (instrumento, dirección, contratos, precios de entrada, salidas, stops, emociones, etc.). NUNCA preguntes por datos que el usuario ya te proporcionó en el mensaje o en la conversación previa.
2. UNA PREGUNTA A LA VEZ: Si falta información esencial (por ejemplo, falta el precio de salida o el instrumento o los contratos), haz UNA sola pregunta concisa y directa a la vez.
3. PRIORIDAD DE CAMPOS:
   - 1° Instrumento (MNQ o MGC) y Dirección (LONG o SHORT).
   - 2° Entradas (contratos y precio de cada entrada, hasta 6 entradas por operación bajo un único ID).
   - 3° Precio de salida y comisiones.
   - 4° Stop inicial (para calcular el riesgo inicial en USD y el múltiplo R).
4. VARIOS TRADES EN UN SOLO MENSAJE: Si el usuario describe 2 o más operaciones juntas, identifícalos por separado y estructúralos en la lista de trades.
5. DATOS NO IMPRESCINDIBLES: Si el usuario no tiene o no recuerda el Stop Inicial o la comisión exacta, permite dejarlo como pendiente (Stop: 0, comisiones estimadas estándar: $1.24 MNQ, $1.50 MGC). NUNCA inventes precios de entrada ni salidas.
6. ENTREVISTA PSICOLÓGICA CORTA Y PERSONALIZADA: Valida emociones y pregunta aprendizajes.
7. RESUMEN Y CONFIRMACIÓN: Cuando la información esté lista para registrarse, genera el bloque de acción correspondiente.

Fecha actual del sistema: ${currentDate} ${currentTime}.

Debes responder SIEMPRE en formato JSON válido con la siguiente estructura:
{
  "reply": "Tu mensaje conversacional explicativo al usuario (en Markdown amigable, empático y directo)",
  "action": {
    "type": "INTERVIEW_QUESTION" | "PROPOSE_NEW_TRADE" | "PROPOSE_MULTIPLE_TRADES" | "UPDATE_TRADE_REFLECTION" | "ANSWER_QUERY",
    "question": "La pregunta concisa a realizar si type es INTERVIEW_QUESTION",
    "tradeDraft": { ...datos si se propone 1 trade... },
    "tradeDrafts": [ ...lista de trades si el usuario describió 2 o más trades... ],
    "reflectionUpdate": { "tradeId": "...", "lessons": "...", "emotions": [...], "mistakes": [...], "disciplineScore": 5 }
  }
}

Estructura de tradeDraft (para 1 o varios trades):
{
  "instrument": "MNQ" | "MGC",
  "direction": "LONG" | "SHORT",
  "date": "${currentDate}",
  "time": "${currentTime}",
  "entries": [
    { "entryNumber": 1, "contracts": 2, "price": 20450 },
    { "entryNumber": 2, "contracts": 1, "price": 20460 }
  ],
  "initialStop": 20430,
  "takeProfit": 20490,
  "exitPrice": 20480,
  "commissions": 4.0,
  "strategy": "Ruptura / Pullback",
  "emotionsBefore": ["Ansiedad"],
  "disciplineScore": 4,
  "mistakes": ["Entrada prematura / sin confirmación"],
  "lessons": "Esperar confirmación de volumen en velas de 5 min."
}`;

    // Format contents for Gemini
    const formattedContents: any[] = [];

    // Context as first turn
    formattedContents.push({
      role: 'user',
      parts: [
        {
          text: `Contexto del diario de trading (Últimas operaciones guardadas):
${JSON.stringify(tradesContext, null, 2)}

Configuración de instrumentos:
MNQ = $${settings.instruments?.MNQ?.pointValue || 2}/pt, MGC = $${settings.instruments?.MGC?.pointValue || 10}/pt.`,
        },
      ],
    });

    formattedContents.push({
      role: 'model',
      parts: [
        {
          text: JSON.stringify({
            reply: 'Entendido. Estoy listo para ayudarte con tu diario y tus gráficos.',
            action: { type: 'ANSWER_QUERY' },
          }),
        },
      ],
    });

    // Append prior conversational history
    if (Array.isArray(history)) {
      history.slice(-8).forEach((h: any) => {
        if (h.role && h.text) {
          formattedContents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }],
          });
        }
      });
    }

    // Construct user message parts (with images if present)
    const currentUserParts: any[] = [];

    if (validImageParts.length > 0) {
      currentUserParts.push({
        text: `[ADJUNTO MULTIMODAL: Se incluyen ${validImageParts.length} captura(s) de gráfico reales para que las examines visualmente junto con la consulta.]`,
      });

      for (let i = 0; i < validImageParts.length; i++) {
        const item = validImageParts[i];
        currentUserParts.push({
          text: `\n[Imagen ${i + 1}: ${item.label} (${item.type})]`,
        });
        currentUserParts.push(item.part);
      }
    }

    if (tradeContext) {
      currentUserParts.push({
        text: `\n[Datos registrados de la operación analizada]:\n${JSON.stringify(tradeContext, null, 2)}\n`,
      });
    }

    if (messageText) currentUserParts.push({ text: messageText });

    formattedContents.push({
      role: 'user',
      parts: currentUserParts,
    });

    const response = await generateWithFallback(formattedContents, {
      systemInstruction,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    const rawText = response.text || '{}';
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn('Failed to parse Gemini JSON, falling back:', rawText);
      parsedData = {
        reply: rawText,
        action: { type: 'ANSWER_QUERY' },
      };
    }

    // Attach metadata about analyzed images
    if (validImageParts.length > 0) {
      parsedData.analyzedPhotos = validImageParts.map((p) => ({
        label: p.label,
        type: p.type,
      }));
    }

    res.json(parsedData);
  } catch (error: any) {
    console.error('Error in /api/coach/chat:', error);
    res.status(500).json({
      error: error.message || 'Error al comunicarse con Gemini.',
      reply: 'Disculpa, ocurrió un error temporal al procesar tu solicitud con el Trading Coach. Por favor intenta de nuevo.',
    });
  }
});

/**
 * Endpoint: POST /api/coach/analyze-trade-images
 * Dedicated technical & visual audit of a trade using attached 1M/HTF screenshots and recorded trade data.
 */
app.post('/api/coach/analyze-trade-images', async (req: Request, res: Response): Promise<void> => {
  try {
    const { trade, selectedPhotos = [], customPrompt = '' } = req.body;

    if (!trade || typeof trade !== 'object') {
      res.status(400).json({ error: 'Se requiere la operación de trading para analizar.' });
      return;
    }
    if (!Array.isArray(selectedPhotos) || selectedPhotos.length > 4) {
      res.status(400).json({ error: 'Selecciona hasta 4 capturas válidas para la auditoría.' });
      return;
    }

    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' });
      return;
    }

    // Determine photos to process
    const photosToProcess: any[] = [];
    if (Array.isArray(selectedPhotos) && selectedPhotos.length > 0) {
      photosToProcess.push(...selectedPhotos);
    } else if (trade.photos) {
      if (trade.photos.entry1M) photosToProcess.push(trade.photos.entry1M);
      if (trade.photos.exit1M) photosToProcess.push(trade.photos.exit1M);
      if (trade.photos.contextHTF) photosToProcess.push(trade.photos.contextHTF);
    }

    const validImageParts: ParsedImagePart[] = [];
    for (const rawImg of photosToProcess) {
      const parsed = await parseImageToInlinePart(rawImg);
      if (parsed) {
        validImageParts.push(parsed);
      }
    }

    if (validImageParts.length === 0) {
      res.status(400).json({
        error:
          'No se encontraron capturas de imagen válidas en la operación para analizar. Asegúrate de adjuntar la captura de 1M (antes de entrar o después de cerrar) o contexto mayor.',
      });
      return;
    }

    const systemInstruction = `Eres un Mentor y Auditor Senior de Trading de Futuros para MNQ (Micro Nasdaq) y MGC (Micro Oro), especializado en operativa de scalping/day-trading en temporalidad de 1 minuto (1M).

Tu tarea es auditar visualmente las capturas de pantalla adjuntas comparándolas rigurosamente con los datos financieros y cuantitativos registrados por el trader.

DIRECTRICES ESTRICTAS:
1. ANÁLISIS BASADO EN EVIDENCIA VISUAL:
   - Describe exactamente lo que se ve en el gráfico de 1M (tipo de velas, ruptura, consolidación, rechazo, pullback).
   - Examina el punto exacto de entrada previsto o ejecutado y el stop loss si están marcados.
   - Evalúa si el trader entró con paciencia en el cierre de la vela de confirmación o persiguió el precio por impulso.
2. CONGRUENCIA FINANCIERA:
   - Compara las velas con el precio de entrada ponderado (${trade.weightedAvgPrice}), stop inicial (${trade.initialStop || 'Pendiente'}), salida (${trade.exitPrice}) y PnL neto ($${trade.netPnL}).
3. PROHIBICIÓN DE ALUCINACIONES:
   - NUNCA inventes indicadores técnicos (no nombres RSI, MACD ni medias móviles específicas si no están trazadas en el gráfico).
   - Si no puedes leer el eje de precios debido al zoom o resolución, menciónalo claramente.
4. ESTADO DE LAS FOTOGRAFÍAS REQUERIDAS:
   - Verifica cuáles de las 3 capturas estándar están presentes y cuáles faltan:
     * 1. Gráfico 1M antes de entrar (¿presente o ausente?)
     * 2. Gráfico 1M después de cerrar (¿presente o ausente?)
     * 3. Contexto mayor 15M o 1H (¿presente o ausente?)
   - Si falta alguna, explica qué dato clave se perdió por no tenerla (ej: sin contexto mayor, no se puede verificar si la operación iba a favor o en contra de la tendencia principal).

ESTRUCTURA DE RESPUESTA REQUERIDA (en Markdown estructurado):
### 1. Verificación de Capturas Recibidas
(Lista clara de qué fotos se procesaron visualmente y cuáles faltaron)

### 2. Auditoría Técnica de la Entrada (Gráfico 1M)
(Análisis de la estructura previa, confirmación y timing de entrada)

### 3. Auditoría de la Gestión y Salida (Gráfico 1M)
(Comportamiento tras la entrada, respeto del stop y ejecución de la salida)

### 4. Análisis de Contexto Mayor (15M / 1H)
(Si se adjuntó, evaluar estructura de temporalidad mayor; si no, indicar por qué habría sido valioso)

### 5. Congruencia con Datos Registrados del Diario
(Validación cruzada entre gráfico y métricas: contratos, dirección ${trade.direction}, PnL neto de $${trade.netPnL})

### 6. Calificación de Ejecución y Lección Concreta
- **Puntuación de Ejecución:** [X/10]
- **Lección Clave Recomendada para el Diario:** [Texto breve y concreto que el usuario pueda incorporar a su diario]`;

    const promptText = `Por favor realiza la auditoría técnica y visual de esta operación con las ${validImageParts.length} captura(s) de gráfico adjunta(s).
${customPrompt ? `\nPregunta específica del trader: "${customPrompt}"\n` : ''}

DATOS DE LA OPERACIÓN:
- ID: ${trade.id}
- Instrumento: ${trade.instrument}
- Dirección: ${trade.direction}
- Fecha/Hora: ${trade.date} ${trade.time}
- Contratos: ${trade.totalContracts}
- Entradas registradas: ${JSON.stringify(trade.entries || [])}
- Precio Ponderado Entrada: ${trade.weightedAvgPrice}
- Stop Inicial: ${trade.initialStop || 'Pendiente'}
- Precio Salida: ${trade.exitPrice}
- PnL Bruto: $${trade.grossPnL} | PnL Neto: $${trade.netPnL}
- Múltiplo R: ${trade.rMultiple || 'N/A'}
- Estrategia: ${trade.strategy || 'No especificada'}
- Emociones: ${JSON.stringify(trade.emotionsBefore || [])}
- Errores declarados: ${JSON.stringify(trade.mistakes || [])}
- Lección registrada: ${trade.lessons || 'Ninguna'}`;

    const userParts: any[] = [{ text: promptText }];

    for (let i = 0; i < validImageParts.length; i++) {
      const img = validImageParts[i];
      userParts.push({
        text: `\n--- Captura ${i + 1}: ${img.label} (${img.type}) ---\n`,
      });
      userParts.push(img.part);
    }

    const response = await generateWithFallback(
      [{ role: 'user', parts: userParts }],
      {
        systemInstruction,
        temperature: 0.25,
      }
    );

    res.json({
      success: true,
      tradeId: trade.id,
      analysis: response.text,
      analyzedPhotosCount: validImageParts.length,
      analyzedPhotos: validImageParts.map((p) => ({
        label: p.label,
        type: p.type,
      })),
    });
  } catch (error: any) {
    console.error('Error in /api/coach/analyze-trade-images:', error);
    res.status(500).json({
      error: error.message || 'Error al procesar el análisis de imágenes con Gemini.',
    });
  }
});

/**
 * Endpoint: POST /api/coach/weekly-report
 * Generates an in-depth weekly trading report grounded on the trades of the specified week.
 */
app.post('/api/coach/weekly-report', async (req: Request, res: Response): Promise<void> => {
  try {
    const { weekTrades = [], weekLabel = 'Esta Semana' } = req.body;
    if (!Array.isArray(weekTrades) || weekTrades.length > 100) {
      res.status(400).json({ error: 'El informe acepta hasta 100 operaciones por solicitud.' });
      return;
    }

    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY no configurada.' });
      return;
    }

    const prompt = `Genera un Informe Semanal Ejecutivo de Trading para el usuario correspondiente a: ${weekLabel}.
Datos reales de las operaciones ejecutadas esta semana:
${JSON.stringify(weekTrades, null, 2)}

El informe debe estructurarse con claridad profesional:
1. Resumen Ejecutivo (Total operaciones, Win Rate %, PnL Neto total, Múltiplo R promedio).
2. Desglose por Activo (MNQ vs MGC).
3. Evaluación de Psicología y Disciplina (Puntuación promedio de disciplina, emociones predominantes).
4. Auditoría de Errores Recurrentes (Cuáles errores se repitieron y cuánto costaron en PnL).
5. 3 Recomendaciones Concretas y Accionables para la próxima semana.

Si no hubo operaciones registradas en esta semana, indícalo claramente con consejos de preparación mental y backtesting.`;

    const response = await generateWithFallback(prompt, {
      systemInstruction:
        'Eres un Coach Senior de Trading de Futuros especializado en psicología del trading y prop firms. Sé directo, constructivo y estrictamente analítico basado en los datos reales.',
      temperature: 0.3,
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error('Error in /api/coach/weekly-report:', error);
    res.status(500).json({
      error: error.message || 'Error al generar el informe semanal.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Trading Journal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
