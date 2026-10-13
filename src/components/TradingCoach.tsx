import React, { useState, useEffect, useRef } from 'react';
import { Trade, Settings, TradeEntry } from '../types/trade';
import { auth, signInWithGoogle } from '../services/firebase';
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
  Bot,
  User,
  Send,
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Edit,
  Save,
  FileText,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Layers,
  Star,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart2,
  BookOpen,
  ArrowRight,
  PlusCircle,
  X,
  Camera,
  Image as ImageIcon,
  Paperclip,
  ZoomIn,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  images?: Array<{
    url?: string;
    dataUrl?: string;
    label: string;
    type?: string;
    name?: string;
  }>;
  analyzedPhotos?: Array<{
    label: string;
    type: string;
  }>;
  action?: {
    type: 'INTERVIEW_QUESTION' | 'PROPOSE_NEW_TRADE' | 'PROPOSE_MULTIPLE_TRADES' | 'UPDATE_TRADE_REFLECTION' | 'ANSWER_QUERY';
    question?: string;
    tradeDraft?: any;
    tradeDrafts?: any[];
    reflectionUpdate?: any;
  };
  tradeSaved?: boolean;
}

interface TradingCoachProps {
  trades: Trade[];
  settings: Settings;
  privacyMode: boolean;
  initialTradeIdForAudit?: string | null;
  onSaveTrade: (trade: Trade) => void;
  onUpdateTrade: (trade: Trade) => void;
  onOpenTradeFormWithDraft: (draft: Partial<Trade>) => void;
  onNavigateToDashboard: () => void;
}

async function getCoachHeaders(): Promise<Record<string, string>> {
  let currentUser = auth.currentUser;
  if (!currentUser) currentUser = await signInWithGoogle();
  if (!currentUser) {
    throw new Error('Inicia sesión con Google para utilizar el Trading Coach y la auditoría visual.');
  }
  const idToken = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

export const TradingCoach: React.FC<TradingCoachProps> = ({
  trades,
  settings,
  privacyMode,
  initialTradeIdForAudit,
  onSaveTrade,
  onUpdateTrade,
  onOpenTradeFormWithDraft,
  onNavigateToDashboard,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      role: 'model',
      text: `Hola, soy tu **Trading Coach** con Gemini AI.\n\nPuedo analizar capturas cuando las adjuntas y el servicio de Gemini está disponible; si no se adjunta una imagen, no afirmaré haberla visto.\n\nPuedes escribir lo que hiciste hoy, adjuntar una captura con el botón de clip o abrir la auditoría independiente de una operación.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [weeklyReportModal, setWeeklyReportModal] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [expandedAdvanced, setExpandedAdvanced] = useState<Record<string, boolean>>({});

  // Multimodal Vision Audit State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedTradeIdForAudit, setSelectedTradeIdForAudit] = useState<string>(() => {
    if (initialTradeIdForAudit && trades.some((t) => t.id === initialTradeIdForAudit)) {
      return initialTradeIdForAudit;
    }
    return trades[0]?.id || '';
  });
  const [selectedPhotoSlots, setSelectedPhotoSlots] = useState<{
    entry1M: boolean;
    exit1M: boolean;
    contextHTF: boolean;
  }>({
    entry1M: true,
    exit1M: true,
    contextHTF: true,
  });
  const [customAuditInquiry, setCustomAuditInquiry] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [pendingChatImages, setPendingChatImages] = useState<
    Array<{ dataUrl: string; label: string; type: string; name?: string }>
  >([]);
  const [previewModalPhoto, setPreviewModalPhoto] = useState<{ url: string; label: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial trade if changed from outside
  useEffect(() => {
    if (initialTradeIdForAudit && trades.some((t) => t.id === initialTradeIdForAudit)) {
      setSelectedTradeIdForAudit(initialTradeIdForAudit);
      setAuditModalOpen(true);
    }
  }, [initialTradeIdForAudit, trades]);

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'es-ES';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, pendingChatImages]);

  const toggleSpeechRecognition = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert(
        'El reconocimiento de voz por navegador no está habilitado o no tiene permisos de micrófono. Puedes escribir tu mensaje en el campo de texto.'
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Error starting speech recognition:', err);
      }
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPendingChatImages((prev) => [
          ...prev,
          {
            dataUrl: reader.result as string,
            label: file.name.replace(/\.[^/.]+$/, ''),
            type: 'CAPTURA_GRAFICO',
            name: file.name,
          },
        ]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePendingImage = (index: number) => {
    setPendingChatImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (
    textToSend?: string,
    attachedImages?: Array<{ dataUrl: string; label: string; type: string; name?: string }>,
    customTradeContext?: any
  ) => {
    const message = (textToSend !== undefined ? textToSend : inputText).trim();
    const imgs = attachedImages || pendingChatImages;
    if ((!message && imgs.length === 0) || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: message || 'Adjunto estas capturas de trading para que las examines visualmente.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      images: imgs.length > 0 ? imgs : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setPendingChatImages([]);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: await getCoachHeaders(),
        body: JSON.stringify({
          message: message || 'Por favor analiza estas capturas de trading.',
          history: historyPayload,
          trades,
          settings,
          images: imgs,
          tradeContext: customTradeContext || null,
          currentDate: new Date().toISOString().split('T')[0],
          currentTime: new Date().toTimeString().slice(0, 5),
        }),
      });

      const data = await response.json();

      const modelMsg: ChatMessage = {
        id: `coach-${Date.now()}`,
        role: 'model',
        text: data.reply || 'He procesado tu solicitud.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: data.action,
        analyzedPhotos: data.analyzedPhotos,
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      console.error('Error contacting Trading Coach:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: 'Hubo un error de conexión con el Trading Coach. Por favor intenta de nuevo.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteTradeAudit = async () => {
    const targetTrade = trades.find((t) => t.id === selectedTradeIdForAudit);
    if (!targetTrade) {
      alert('Por favor selecciona una operación existente.');
      return;
    }

    const selectedPhotosList: Array<{ type: string; label: string; url: string; dataUrl: string }> = [];
    if (selectedPhotoSlots.entry1M && targetTrade.photos?.entry1M) {
      selectedPhotosList.push({
        type: 'ENTRY_1M',
        label: 'Gráfico 1M Entrada',
        url: targetTrade.photos.entry1M.url,
        dataUrl: targetTrade.photos.entry1M.url,
      });
    }
    if (selectedPhotoSlots.exit1M && targetTrade.photos?.exit1M) {
      selectedPhotosList.push({
        type: 'EXIT_1M',
        label: 'Gráfico 1M Salida',
        url: targetTrade.photos.exit1M.url,
        dataUrl: targetTrade.photos.exit1M.url,
      });
    }
    if (selectedPhotoSlots.contextHTF && targetTrade.photos?.contextHTF) {
      selectedPhotosList.push({
        type: 'CONTEXT_HTF',
        label: 'Contexto Mayor (15M / 1H)',
        url: targetTrade.photos.contextHTF.url,
        dataUrl: targetTrade.photos.contextHTF.url,
      });
    }

    if (selectedPhotosList.length === 0) {
      alert(
        'Esta operación no tiene fotos seleccionadas para auditar. Asegúrate de marcar al menos una captura disponible en las casillas o adjúntala a la operación.'
      );
      return;
    }

    setIsAuditing(true);
    setAuditModalOpen(false);

    const promptText = customAuditInquiry.trim()
      ? `Coach, audita técnicamente mi operación ${targetTrade.id} (${targetTrade.instrument} ${targetTrade.direction}). ${customAuditInquiry}`
      : `Coach, audita técnicamente mi operación ${targetTrade.id} (${targetTrade.instrument} ${targetTrade.direction}) examinando mis capturas de 1M y contexto.`;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      images: selectedPhotosList,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/coach/analyze-trade-images', {
        method: 'POST',
        headers: await getCoachHeaders(),
        body: JSON.stringify({
          trade: targetTrade,
          selectedPhotos: selectedPhotosList,
          customPrompt: customAuditInquiry,
        }),
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const modelMsg: ChatMessage = {
        id: `coach-${Date.now()}`,
        role: 'model',
        text: data.analysis,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        analyzedPhotos: data.analyzedPhotos,
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      console.error('Error auditing trade images:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: `Error al procesar el análisis de imágenes: ${err.message || 'Intenta de nuevo.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAuditing(false);
      setIsLoading(false);
    }
  };

  // Convert proposed draft into complete valid Trade entity
  const buildCompleteTrade = (draft: any): Trade => {
    const inst = draft.instrument === 'MGC' ? 'MGC' : 'MNQ';
    const pointValue = settings.instruments[inst]?.pointValue || (inst === 'MGC' ? 10 : 2);
    const direction = draft.direction === 'SHORT' ? 'SHORT' : 'LONG';

    const rawEntries: TradeEntry[] =
      Array.isArray(draft.entries) && draft.entries.length > 0
        ? draft.entries.map((e: any, idx: number) => ({
            id: `ent-${Date.now()}-${idx + 1}`,
            entryNumber: idx + 1,
            contracts: Number(e.contracts) || 1,
            price: Number(e.price) || 0,
            time: draft.time || new Date().toTimeString().slice(0, 5),
            notes: e.notes || '',
          }))
        : [
            {
              id: `ent-${Date.now()}-1`,
              entryNumber: 1,
              contracts: 1,
              price: Number(draft.price) || 0,
              time: draft.time || new Date().toTimeString().slice(0, 5),
              notes: '',
            },
          ];

    const { totalContracts, weightedAvgPrice } = calculateWeightedEntry(rawEntries);
    const exitPrice = Number(draft.exitPrice) || weightedAvgPrice;
    const commissions =
      draft.commissions !== undefined
        ? Number(draft.commissions)
        : totalContracts * (inst === 'MGC' ? 1.5 : 1.24);
    const initialStop = Number(draft.initialStop) || 0;

    const grossPoints = calculateGrossPoints(direction, weightedAvgPrice, exitPrice);
    const grossPnL = calculateGrossPnL(grossPoints, totalContracts, pointValue);
    const netPnL = calculateNetPnL(grossPnL, commissions);
    const { riskPoints, riskDollars } = calculateRisk(
      direction,
      weightedAvgPrice,
      initialStop,
      totalContracts,
      pointValue
    );
    const rMultiple = calculateRMultiple(netPnL, riskDollars);
    const outcome = determineOutcome(netPnL);

    return {
      id: `TRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
        100 + Math.random() * 900
      )}`,
      date: draft.date || new Date().toISOString().split('T')[0],
      time: draft.time || new Date().toTimeString().slice(0, 5),
      instrument: inst,
      direction,
      status: 'CERRADA',
      entries: rawEntries,
      totalContracts,
      weightedAvgPrice,
      initialStop,
      currentStop: draft.currentStop ? Number(draft.currentStop) : undefined,
      takeProfit: draft.takeProfit ? Number(draft.takeProfit) : undefined,
      exitPrice,
      exitDate: draft.date || new Date().toISOString().split('T')[0],
      exitTime: draft.exitTime || draft.time || new Date().toTimeString().slice(0, 5),
      commissions,
      grossPoints,
      grossPnL,
      netPnL,
      initialRiskPoints: riskPoints,
      initialRiskDollars: riskDollars,
      rMultiple,
      outcome,
      session: draft.session || 'Nueva York Apertura',
      strategy: draft.strategy || 'Registro Conversacional con Coach',
      emotionsBefore: Array.isArray(draft.emotionsBefore)
        ? draft.emotionsBefore
        : draft.emotionsBefore
        ? [draft.emotionsBefore]
        : ['Calma'],
      emotionsDuring: [],
      emotionsAfter: [],
      disciplineScore: Number(draft.disciplineScore) || 5,
      mistakes: Array.isArray(draft.mistakes)
        ? draft.mistakes
        : draft.mistakes
        ? [draft.mistakes]
        : ['Ninguno (Plan ejecutado)'],
      lessons: draft.lessons || '',
      screenshotUrl: draft.screenshotUrl || undefined,
      notes: draft.notes || 'Operación registrada mediante Trading Coach con IA.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleConfirmSingleDraft = (draft: any, messageId: string) => {
    const newTrade = buildCompleteTrade(draft);
    onSaveTrade(newTrade);

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, tradeSaved: true } : m))
    );
  };

  const handleConfirmMultipleDrafts = (drafts: any[], messageId: string) => {
    drafts.forEach((draft) => {
      const newTrade = buildCompleteTrade(draft);
      onSaveTrade(newTrade);
    });

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, tradeSaved: true } : m))
    );
  };

  const handleConfirmReflectionUpdate = (reflectionUpdate: any) => {
    const targetTrade = trades.find((t) => t.id === reflectionUpdate.tradeId);
    if (!targetTrade) {
      alert(`No se encontró la operación con ID ${reflectionUpdate.tradeId}.`);
      return;
    }

    const updatedTrade: Trade = {
      ...targetTrade,
      lessons: reflectionUpdate.lessons || targetTrade.lessons,
      mistakes: reflectionUpdate.mistakes || targetTrade.mistakes,
      emotionsBefore: reflectionUpdate.emotions || targetTrade.emotionsBefore,
      disciplineScore:
        reflectionUpdate.disciplineScore !== undefined
          ? reflectionUpdate.disciplineScore
          : targetTrade.disciplineScore,
      updatedAt: new Date().toISOString(),
    };

    onUpdateTrade(updatedTrade);
    alert(`Reflexión actualizada con éxito en la operación ${targetTrade.id}.`);
  };

  const handleStartTodayRegistration = () => {
    setIsInterviewActive(true);
    handleSendMessage(
      'Hola Coach, quiero registrar mis trades de hoy. Inicia la entrevista breve haciéndome una pregunta a la vez.'
    );
  };

  const handleFinishRegistration = () => {
    setIsInterviewActive(false);
    handleSendMessage('Eso es todo por hoy, finalicemos el registro.');
  };

  const handleGenerateWeeklyReport = async () => {
    setLoadingReport(true);
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const mondayStr = monday.toISOString().split('T')[0];

      const weekTrades = trades.filter((t) => t.date >= mondayStr);

      const response = await fetch('/api/coach/weekly-report', {
        method: 'POST',
        headers: await getCoachHeaders(),
        body: JSON.stringify({
          weekTrades,
          weekLabel: `Semana del ${mondayStr} al ${now.toISOString().split('T')[0]}`,
        }),
      });

      const data = await response.json();
      setWeeklyReportModal(data.report || 'No se pudo generar el informe.');
    } catch (err) {
      console.error('Error generating weekly report:', err);
      alert('Error al generar el informe semanal.');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (!weeklyReportModal) return;
    navigator.clipboard.writeText(weeklyReportModal);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const toggleAdvanced = (cardId: string) => {
    setExpandedAdvanced((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  return (
    <div className="max-w-5xl mx-auto py-5 px-4 space-y-4 flex flex-col h-[calc(100vh-8rem)]">
      {/* 1. FOUR MAIN ACTION CARDS (PANTALLA PRINCIPAL) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {/* Opción 1: Registrar mis trades de hoy */}
        <button
          onClick={handleStartTodayRegistration}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group shadow-xs ${
            isInterviewActive
              ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-400'
              : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-700 uppercase">
              {isInterviewActive ? 'Entrevista Activa' : 'Paso a Paso'}
            </span>
          </div>
          <div className="mt-2">
            <h2 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
              1. Registrar mis trades
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-sans">
              Entrevista 1 a 1 por texto o voz para registrar entradas y psicología.
            </p>
          </div>
        </button>

        {/* Opción 2: Revisar mis resultados y mi psicología */}
        <button
          onClick={onNavigateToDashboard}
          className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition-all cursor-pointer flex flex-col justify-between group shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              {trades.length} trades
            </span>
          </div>
          <div className="mt-2">
            <h2 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
              2. Revisar resultados
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-sans">
              Dashboard, win rate, curva de capital y psicología.
            </p>
          </div>
        </button>

        {/* Opción 3: Consultar mis informes */}
        <button
          onClick={handleGenerateWeeklyReport}
          disabled={loadingReport}
          className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-400 text-left transition-all cursor-pointer flex flex-col justify-between group disabled:opacity-60 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-700">
              Informe
            </span>
          </div>
          <div className="mt-2">
            <h2 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
              3. Informe semanal
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-sans">
              {loadingReport ? 'Generando análisis...' : 'Auditoría ejecutiva y errores recurrentes.'}
            </p>
          </div>
        </button>

        {/* Opción 4: Auditar capturas de gráficos con IA (Visión Multimodal) */}
        <button
          onClick={() => setAuditModalOpen(true)}
          className="p-3.5 rounded-xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40 hover:to-indigo-50 hover:border-indigo-400 text-left transition-all cursor-pointer flex flex-col justify-between group shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>Visión 1M</span>
            </span>
          </div>
          <div className="mt-2">
            <h2 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
              4. Auditar capturas con IA
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-sans">
              Auditoría multimodal de tus gráficos 1M (entrada/salida) y contexto.
            </p>
          </div>
        </button>
      </div>

      {/* Active Interview Banner */}
      {isInterviewActive && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 text-blue-900 font-medium">
            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
            <span>Entrevista de registro activa: Responde cada pregunta a tu propio ritmo.</span>
          </div>
          <button
            onClick={handleFinishRegistration}
            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-300 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
          >
            Finalizar Registro
          </button>
        </div>
      )}

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 rounded-xl">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-blue-700 shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                msg.role === 'user'
                  ? 'bg-[#0f1f38] text-white rounded-br-xs'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
              }`}
            >
              {/* Multimodal Attached Images Preview */}
              {msg.images && msg.images.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {msg.images.map((img, imgIdx) => (
                    <div
                      key={imgIdx}
                      onClick={() =>
                        setPreviewModalPhoto({
                          url: img.dataUrl || img.url || '',
                          label: img.label,
                        })
                      }
                      className="group relative rounded-lg border border-slate-300 overflow-hidden cursor-pointer shadow-2xs hover:border-blue-500 transition-all bg-black/10"
                      title="Clic para ampliar captura"
                    >
                      <img
                        src={img.dataUrl || img.url}
                        alt={img.label}
                        className="w-24 h-16 object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] px-1 py-0.5 truncate text-center font-mono">
                        {img.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Verified Gemini Vision Analysis Badge */}
              {msg.analyzedPhotos && msg.analyzedPhotos.length > 0 && (
                <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-semibold font-sans">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Gemini Vision examinó directamente {msg.analyzedPhotos.length} captura(s) de gráfico
                  </span>
                </div>
              )}

              {/* Message text with Markdown */}
              <div className="whitespace-pre-wrap font-sans space-y-1.5 leading-relaxed">
                {msg.text}
              </div>

              {/* ACTION: Multiple Trades Draft */}
              {msg.action?.type === 'PROPOSE_MULTIPLE_TRADES' &&
                Array.isArray(msg.action.tradeDrafts) &&
                msg.action.tradeDrafts.length > 0 && (
                  <div className="mt-3.5 space-y-3 font-mono">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-sans">
                        <Layers className="w-4 h-4 text-blue-600" />
                        {msg.action.tradeDrafts.length} Operaciones Detectadas Listas para Guardar
                      </span>
                    </div>

                    {msg.action.tradeDrafts.map((draft, idx) => {
                      const cardId = `${msg.id}-multi-${idx}`;
                      const isExp = expandedAdvanced[cardId] || false;
                      const inst = draft.instrument === 'MGC' ? 'MGC' : 'MNQ';
                      const ptVal = settings.instruments[inst]?.pointValue || (inst === 'MGC' ? 10 : 2);
                      const { totalContracts, weightedAvgPrice } = calculateWeightedEntry(
                        Array.isArray(draft.entries)
                          ? draft.entries.map((e: any, i: number) => ({
                              id: `e-${i}`,
                              entryNumber: i + 1,
                              contracts: Number(e.contracts) || 1,
                              price: Number(e.price) || 0,
                            }))
                          : [{ id: 'e-1', entryNumber: 1, contracts: 1, price: Number(draft.price) || 0 }]
                      );
                      const grossPts = calculateGrossPoints(
                        draft.direction === 'SHORT' ? 'SHORT' : 'LONG',
                        weightedAvgPrice,
                        Number(draft.exitPrice) || weightedAvgPrice
                      );
                      const grossPnL = calculateGrossPnL(grossPts, totalContracts, ptVal);
                      const netPnL = calculateNetPnL(grossPnL, Number(draft.commissions) || 2.5);

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>Operación #{idx + 1}:</span>
                              <span
                                className={
                                  draft.direction === 'LONG'
                                    ? 'text-emerald-700'
                                    : 'text-rose-700'
                                }
                              >
                                {inst} {draft.direction}
                              </span>
                            </span>
                            <span
                              className={`font-bold ${
                                netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatUSD(netPnL)}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 font-sans space-y-0.5">
                            <div>
                              <strong>Entradas:</strong> {totalContracts} contratos · Promedio ponderado:{' '}
                              <strong className="text-blue-700 font-mono">
                                {weightedAvgPrice.toFixed(2)}
                              </strong>
                            </div>
                            <div>
                              <strong>Salida:</strong> {draft.exitPrice || '-'} · Stop Inicial:{' '}
                              {draft.initialStop || 'Pendiente'}
                            </div>
                          </div>

                          {/* Collapsible Advanced Details */}
                          <div>
                            <button
                              type="button"
                              onClick={() => toggleAdvanced(cardId)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-sans cursor-pointer mt-1"
                            >
                              <span>Detalles avanzados</span>
                              {isExp ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {isExp && (
                              <div className="mt-2 p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 font-sans space-y-1">
                                <div>
                                  <strong>Estrategia:</strong> {draft.strategy || 'No especificada'}
                                </div>
                                <div>
                                  <strong>Emociones:</strong>{' '}
                                  {Array.isArray(draft.emotionsBefore)
                                    ? draft.emotionsBefore.join(', ')
                                    : draft.emotionsBefore || 'Calma'}
                                </div>
                                <div>
                                  <strong>Lección:</strong> {draft.lessons || 'Ninguna registrada'}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2 font-sans flex items-center gap-2">
                      {msg.tradeSaved ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>¡Operaciones guardadas en el diario!</span>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleConfirmMultipleDrafts(msg.action?.tradeDrafts || [], msg.id)
                          }
                          className="px-4 py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Confirmar y Guardar Todos ({msg.action.tradeDrafts.length} trades)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* ACTION: Single Proposed Trade */}
              {msg.action?.type === 'PROPOSE_NEW_TRADE' && msg.action.tradeDraft && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 font-mono">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5 font-sans">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Resumen del Trade para Confirmar
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        msg.action.tradeDraft.direction === 'LONG'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {msg.action.tradeDraft.instrument} · {msg.action.tradeDraft.direction}
                    </span>
                  </div>

                  {/* Scale-ins summary */}
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="text-slate-500 font-sans font-medium text-[10px]">
                      Entradas (mismo ID único):
                    </div>
                    {Array.isArray(msg.action.tradeDraft.entries) &&
                      msg.action.tradeDraft.entries.map((e: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-slate-700">
                          <span>Entrada {idx + 1}:</span>
                          <span className="text-slate-900 font-semibold">
                            {e.contracts} ct{e.contracts > 1 ? 's' : ''} @ {e.price}
                          </span>
                        </div>
                      ))}
                    <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                      <span>Precio Salida:</span>
                      <span className="text-slate-900 font-bold">
                        {msg.action.tradeDraft.exitPrice || 'Pendiente'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Stop Inicial:</span>
                      <span className="text-rose-700 font-bold">
                        {msg.action.tradeDraft.initialStop || 'Pendiente'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Comisiones:</span>
                      <span>-${msg.action.tradeDraft.commissions || 2.5}</span>
                    </div>
                  </div>

                  {/* Collapsible Advanced Details */}
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleAdvanced(msg.id)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-sans cursor-pointer mt-1"
                    >
                      <span>Detalles avanzados (Psicología y notas)</span>
                      {expandedAdvanced[msg.id] ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {expandedAdvanced[msg.id] && (
                      <div className="mt-2 p-2.5 rounded-lg bg-white border border-slate-200 font-sans text-[11px] text-slate-600 space-y-1.5">
                        {msg.action.tradeDraft.emotionsBefore && (
                          <div>
                            <strong className="text-slate-500">Emociones:</strong>{' '}
                            {Array.isArray(msg.action.tradeDraft.emotionsBefore)
                              ? msg.action.tradeDraft.emotionsBefore.join(', ')
                              : msg.action.tradeDraft.emotionsBefore}
                          </div>
                        )}
                        {msg.action.tradeDraft.disciplineScore && (
                          <div>
                            <strong className="text-slate-500">Disciplina:</strong>{' '}
                            {msg.action.tradeDraft.disciplineScore}/5 estrellas
                          </div>
                        )}
                        {msg.action.tradeDraft.mistakes && (
                          <div>
                            <strong className="text-slate-500">Errores auditados:</strong>{' '}
                            {Array.isArray(msg.action.tradeDraft.mistakes)
                              ? msg.action.tradeDraft.mistakes.join(', ')
                              : msg.action.tradeDraft.mistakes}
                          </div>
                        )}
                        {msg.action.tradeDraft.lessons && (
                          <div>
                            <strong className="text-slate-500">Lección:</strong>{' '}
                            {msg.action.tradeDraft.lessons}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-wrap items-center gap-2 font-sans">
                    {msg.tradeSaved ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold py-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>¡Guardado en el diario exitosamente!</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleConfirmSingleDraft(msg.action?.tradeDraft, msg.id)}
                          className="px-4 py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Confirmar y Guardar</span>
                        </button>
                        <button
                          onClick={() => onOpenTradeFormWithDraft(msg.action?.tradeDraft)}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Editar en formulario</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ACTION: Update Reflection */}
              {msg.action?.type === 'UPDATE_TRADE_REFLECTION' && msg.action.reflectionUpdate && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 font-sans">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                      <Edit className="w-3.5 h-3.5 text-blue-600" />
                      Actualización de Reflexión Psicológica
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {msg.action.reflectionUpdate.tradeId}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 space-y-1">
                    {msg.action.reflectionUpdate.lessons && (
                      <div>
                        <strong className="text-slate-500">Nueva Lección:</strong>{' '}
                        {msg.action.reflectionUpdate.lessons}
                      </div>
                    )}
                    {msg.action.reflectionUpdate.mistakes && (
                      <div>
                        <strong className="text-slate-500">Errores identificados:</strong>{' '}
                        {Array.isArray(msg.action.reflectionUpdate.mistakes)
                          ? msg.action.reflectionUpdate.mistakes.join(', ')
                          : msg.action.reflectionUpdate.mistakes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleConfirmReflectionUpdate(msg.action?.reflectionUpdate)}
                    className="mt-1 px-3.5 py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Guardar Reflexión en este Trade</span>
                  </button>
                </div>
              )}

              <div className="text-[10px] text-slate-400 mt-2 text-right">
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-700 shrink-0 mt-0.5 shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 text-slate-600 rounded-2xl rounded-bl-xs p-4 text-xs flex items-center gap-2 shadow-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>El Coach está formulando su respuesta...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input & Voice Dictation */}
      <div className="shrink-0 p-3 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
        {isListening && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between animate-pulse">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-ping"></span>
              <span>Escuchando... Dicta tu operación o respuesta con naturalidad</span>
            </span>
            <button
              onClick={toggleSpeechRecognition}
              className="text-[11px] font-semibold underline cursor-pointer"
            >
              Detener
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              isInterviewActive
                ? 'Escribe tu respuesta aquí (o usa el micrófono para dictar)...'
                : 'Escribe o dicta: "Hoy operé MNQ largo...", haz una pregunta o pide ayuda...'
            }
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-none font-sans"
          />

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            title={
              isListening
                ? 'Detener dictado por voz'
                : 'Dictar operación por voz (Micrófono)'
            }
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-xl bg-[#0f1f38] hover:bg-[#1a365d] text-white font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekly Report Modal */}
      {weeklyReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-xl p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Informe Semanal de Trading (Gemini AI)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs text-slate-700 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setWeeklyReportModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs text-slate-700 font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
              {weeklyReportModal}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setWeeklyReportModal(null)}
                className="px-4 py-2 bg-[#0f1f38] hover:bg-[#1a365d] text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
