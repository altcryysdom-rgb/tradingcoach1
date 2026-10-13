import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Trade, Settings } from './types/trade';
import {
  loadTradesFromStorage,
  saveTradesToStorage,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  LEGACY_SAMPLE_TRADE_IDS,
} from './utils/storage';
import {
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  subscribeToTrades,
  saveTradeToFirestore,
  deleteTradeFromFirestore,
  deleteAllTradePhotosFromStorage,
  syncLocalTradesToFirestore,
  mergeLocalTradesToFirestore,
  saveSettingsToFirestore,
  testConnection,
} from './services/firebase';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TradingCoach } from './components/TradingCoach';
import { TradeForm } from './components/TradeForm';
import { TradeHistory } from './components/TradeHistory';
import { FormulaVerifier } from './components/FormulaVerifier';
import { SettingsBackup } from './components/SettingsBackup';

export default function App() {
  const [trades, setTrades] = useState<Trade[]>(() => loadTradesFromStorage());
  const [settings, setSettings] = useState<Settings>(() => loadSettingsFromStorage());
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<
    'dashboard' | 'coach' | 'new-trade' | 'history' | 'verifier' | 'settings'
  >('coach');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [privacyMode, setPrivacyMode] = useState<boolean>(
    () => settings.privacyMode || false
  );

  // Operaciones locales que todavía no están en la nube. Se conservan hasta
  // que el usuario decida sincronizarlas, sin subirlas automáticamente.
  const pendingLocalTradesRef = useRef<Trade[] | null>(null);

  // Sync trades to local storage on changes as a permanent offline cache
  useEffect(() => {
    saveTradesToStorage(trades);
  }, [trades]);

  // Sync settings to local storage on changes
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  // Firebase Auth & Realtime synchronization
  useEffect(() => {
    let unsubscribeTrades: (() => void) | null = null;

    const unsubscribeAuth = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Capturar antes de que el primer snapshot remoto reemplace el estado.
        // No mezclar operaciones pertenecientes a otra cuenta.
        pendingLocalTradesRef.current = loadTradesFromStorage().filter(
          (trade) => !trade.userId || trade.userId === currentUser.uid
        );
        setIsSyncing(true);
        try {
          await testConnection();
          // La nube es la fuente de verdad al iniciar sesión. No subir automáticamente
          // el caché local evita resucitar datos de ejemplo o datos obsoletos.
          // Real-time listener for multi-device sync
          unsubscribeTrades = subscribeToTrades(
            currentUser.uid,
            (remoteTrades) => {
              // Purgar las cuatro operaciones ficticias de versiones anteriores.
              const sampleIds = new Set<string>(LEGACY_SAMPLE_TRADE_IDS);
              const cleanTrades = remoteTrades.filter((trade) => !sampleIds.has(trade.id));
              const remoteIds = new Set(cleanTrades.map((trade) => trade.id));
              const pending = (pendingLocalTradesRef.current || []).filter(
                (trade) => !remoteIds.has(trade.id)
              );
              pendingLocalTradesRef.current = pending;
              const visibleTrades = [...cleanTrades, ...pending];
              setTrades(visibleTrades);
              saveTradesToStorage(visibleTrades);
              if (cleanTrades.length !== remoteTrades.length) {
                const staleSamples = remoteTrades.filter((trade) => sampleIds.has(trade.id));
                void Promise.all(staleSamples.map((trade) => deleteTradeFromFirestore(currentUser.uid, trade.id))).catch((err) =>
                  console.error('No se pudieron purgar operaciones ficticias de la nube:', err)
                );
              }
              setIsSyncing(false);
            },
            (err) => {
              console.warn('Realtime sync warning:', err);
              setIsSyncing(false);
            }
          );
        } catch (err) {
          console.error('Firebase sync error:', err);
          setIsSyncing(false);
        }
      } else {
        pendingLocalTradesRef.current = null;
        if (unsubscribeTrades) {
          unsubscribeTrades();
          unsubscribeTrades = null;
        }
        setIsSyncing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeTrades) unsubscribeTrades();
    };
  }, []);

  const handleSaveTrade = async (savedTrade: Trade) => {
    const tradeWithUser = user ? { ...savedTrade, userId: user.uid } : savedTrade;
    setTrades((prev) => {
      const existsIndex = prev.findIndex((t) => t.id === tradeWithUser.id);
      if (existsIndex >= 0) {
        const copy = [...prev];
        copy[existsIndex] = tradeWithUser;
        return copy;
      }
      return [tradeWithUser, ...prev];
    });
    setEditingTrade(null);
    setCurrentTab('history');

    if (user) {
      try {
        await saveTradeToFirestore(user.uid, tradeWithUser);
      } catch (err) {
        console.error('Error saving trade to cloud:', err);
      }
    }
  };

  const handleUpdateTrade = async (updatedTrade: Trade) => {
    const tradeWithUser = user ? { ...updatedTrade, userId: user.uid } : updatedTrade;
    setTrades((prev) => prev.map((t) => (t.id === tradeWithUser.id ? tradeWithUser : t)));

    if (user) {
      try {
        await saveTradeToFirestore(user.uid, tradeWithUser);
      } catch (err) {
        console.error('Error updating trade in cloud:', err);
      }
    }
  };

  const handleDeleteTrade = async (
    tradeId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (user) {
        // Confirm deletion in cloud Firestore first
        await deleteTradeFromFirestore(user.uid, tradeId);
      }
      // Update local state and offline persistent storage
      setTrades((prev) => {
        const next = prev.filter((t) => t.id !== tradeId);
        saveTradesToStorage(next);
        return next;
      });
      return { success: true };
    } catch (err: any) {
      console.error('Error al eliminar operación en Firestore:', err);
      let errorMsg = 'Error al eliminar la operación de la base de datos en la nube.';
      try {
        if (err.message && err.message.startsWith('{')) {
          const parsed = JSON.parse(err.message);
          errorMsg = parsed.error || errorMsg;
        } else if (err.message) {
          errorMsg = err.message;
        }
      } catch {
        errorMsg = err?.message || errorMsg;
      }
      return { success: false, error: errorMsg };
    }
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setCurrentTab('new-trade');
  };

  const handleOpenTradeFormWithDraft = (draft: any) => {
    const inst = draft.instrument === 'MGC' ? 'MGC' : 'MNQ';
    const formTrade: any = {
      id: `TRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      date: draft.date || new Date().toISOString().split('T')[0],
      time: draft.time || new Date().toTimeString().slice(0, 5),
      instrument: inst,
      direction: draft.direction === 'SHORT' ? 'SHORT' : 'LONG',
      status: 'CERRADA',
      entries: Array.isArray(draft.entries)
        ? draft.entries.map((e: any, idx: number) => ({
            id: `ent-${Date.now()}-${idx + 1}`,
            entryNumber: idx + 1,
            contracts: Number(e.contracts) || 1,
            price: Number(e.price) || 0,
            time: draft.time || '',
            notes: e.notes || '',
          }))
        : [{ id: 'ent-1', entryNumber: 1, contracts: 1, price: Number(draft.price) || 0 }],
      initialStop: Number(draft.initialStop) || 0,
      currentStop: draft.currentStop ? Number(draft.currentStop) : undefined,
      takeProfit: draft.takeProfit ? Number(draft.takeProfit) : undefined,
      exitPrice: Number(draft.exitPrice) || 0,
      commissions: Number(draft.commissions) || 2.5,
      session: draft.session || 'Nueva York Apertura',
      strategy: draft.strategy || 'Estrategia Coach',
      emotionsBefore: Array.isArray(draft.emotionsBefore) ? draft.emotionsBefore : ['Calma'],
      disciplineScore: Number(draft.disciplineScore) || 5,
      mistakes: Array.isArray(draft.mistakes) ? draft.mistakes : ['Ninguno (Plan ejecutado)'],
      lessons: draft.lessons || '',
      notes: draft.notes || '',
    };
    setEditingTrade(formTrade);
    setCurrentTab('new-trade');
  };

  const handleRestoreBackup = async (newTrades: Trade[], newSettings?: Settings) => {
    setTrades(newTrades);
    if (newSettings) {
      setSettings(newSettings);
      setPrivacyMode(newSettings.privacyMode);
    }
    if (user) {
      setIsSyncing(true);
      try {
        await mergeLocalTradesToFirestore(user.uid, newTrades);
        if (newSettings) {
          await saveSettingsToFirestore(user.uid, newSettings);
        }
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleClearAllTrades = async () => {
    setIsSyncing(true);
    try {
      // Primero sincronizar el borrado con Firestore para evitar que el listener
      // vuelva a insertar operaciones antiguas en el estado local.
      if (user) {
        await syncLocalTradesToFirestore(user.uid, []);
        await deleteAllTradePhotosFromStorage(user.uid);
      }
      pendingLocalTradesRef.current = [];
      saveTradesToStorage([]);
      setTrades([]);
      setCurrentTab('dashboard');
      if (!user) {
        alert('Se borraron las operaciones de este navegador. Para borrar también los datos de Firebase, inicia sesión con tu cuenta de Google y vuelve a usar “Limpiar Diario”.');
      }
    } catch (err) {
      console.error('No se pudieron borrar todas las operaciones:', err);
      alert('No se pudieron borrar las operaciones de la nube. Inténtalo de nuevo.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleForceSyncToCloud = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    const confirmed = window.confirm(
      'Esto agregará o actualizará las operaciones de este navegador en Firebase sin borrar las que ya están en la nube. Si tienen el mismo identificador, se actualizarán con la versión local. ¿Quieres continuar?'
    );
    if (!confirmed) return;
    setIsSyncing(true);
    try {
      await mergeLocalTradesToFirestore(user.uid, trades);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600/10 selection:text-blue-700">
      {/* Top Bar adhering to Universal Frontend Design Constitution */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab !== 'new-trade') setEditingTrade(null);
          setCurrentTab(tab);
        }}
        privacyMode={privacyMode}
        onTogglePrivacy={() => setPrivacyMode((prev) => !prev)}
        tradeCount={trades.length}
        user={user}
        isSyncing={isSyncing}
        onSignIn={signInWithGoogle}
        onSignOut={signOutUser}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <Dashboard
            trades={trades}
            settings={settings}
            privacyMode={privacyMode}
            onNewTrade={() => {
              setEditingTrade(null);
              setCurrentTab('new-trade');
            }}
            onSelectTrade={(t) => handleEditTrade(t)}
          />
        )}

        {currentTab === 'coach' && (
          <TradingCoach
            trades={trades}
            settings={settings}
            privacyMode={privacyMode}
            onSaveTrade={handleSaveTrade}
            onUpdateTrade={handleUpdateTrade}
            onOpenTradeFormWithDraft={handleOpenTradeFormWithDraft}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'new-trade' && (
          <TradeForm
            initialTrade={editingTrade}
            settings={settings}
            userId={user?.uid}
            onSaveTrade={handleSaveTrade}
            onCancel={() => {
              setEditingTrade(null);
              setCurrentTab('dashboard');
            }}
          />
        )}

        {currentTab === 'history' && (
          <TradeHistory
            trades={trades}
            settings={settings}
            privacyMode={privacyMode}
            user={user}
            onEditTrade={handleEditTrade}
            onDeleteTrade={handleDeleteTrade}
            onUpdateTrade={handleUpdateTrade}
          />
        )}

        {currentTab === 'verifier' && <FormulaVerifier />}

        {currentTab === 'settings' && (
          <SettingsBackup
            settings={settings}
            trades={trades}
            user={user}
            isSyncing={isSyncing}
            onUpdateSettings={async (newSettings) => {
              setSettings(newSettings);
              setPrivacyMode(newSettings.privacyMode);
              if (user) {
                await saveSettingsToFirestore(user.uid, newSettings);
              }
            }}
            onRestoreBackup={handleRestoreBackup}
            onClearAllTrades={handleClearAllTrades}
            onSignIn={signInWithGoogle}
            onSignOut={signOutUser}
            onSyncLocalToCloud={handleForceSyncToCloud}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Diario de Trading Futuros MNQ & MGC</span>
            <span aria-hidden="true">·</span>
            <span>Micro Nasdaq ($2/pt) y Micro Oro ($10/pt)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
            <span>Sincronización en la Nube con Google & Firestore</span>
            <span aria-hidden="true">·</span>
            <span>Caché Offline Seguro</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
