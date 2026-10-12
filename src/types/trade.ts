export type InstrumentSymbol = 'MNQ' | 'MGC' | string;

export interface InstrumentConfig {
  symbol: InstrumentSymbol;
  name: string;
  pointValue: number; // USD per full point
  tickSize: number; // e.g. 0.25 for MNQ, 0.10 for MGC
  tickValue: number; // tickSize * pointValue
  defaultCommission: number; // USD round turn per contract
}

export interface TradeEntry {
  id: string;
  entryNumber: number; // 1 to 6
  contracts: number;
  price: number;
  time?: string;
  notes?: string;
}

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'CERRADA' | 'ABIERTA';
export type TradeOutcome = 'GANADORA' | 'PERDIDA' | 'BREAKEVEN';

export interface Trade {
  id: string; // Unique ID, e.g. TRD-20261011-001
  userId?: string; // Firebase Auth UID
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  instrument: InstrumentSymbol;
  direction: TradeDirection;
  status: TradeStatus;

  // Up to 6 scale-ins grouped under this single trade ID
  entries: TradeEntry[];
  totalContracts: number;
  weightedAvgPrice: number;

  // Management price levels
  initialStop: number;
  currentStop?: number;
  takeProfit?: number;
  exitPrice?: number;
  exitDate?: string;
  exitTime?: string;
  commissions: number; // Total commissions in USD

  // Calculated financial metrics
  grossPoints: number;
  grossPnL: number;
  netPnL: number;
  initialRiskPoints: number;
  initialRiskDollars: number;
  rMultiple: number | null; // e.g. +2.50 or -1.00
  outcome: TradeOutcome;

  // Psychology & Journaling
  session: string; // 'Nueva York Apertura' | 'Nueva York AM' | 'Londres' | 'Asia' | etc.
  strategy: string; // 'Ruptura', 'Pullback', 'FVG', etc.
  emotionsBefore: string[];
  emotionsDuring: string[];
  emotionsAfter: string[];
  disciplineScore: number; // 1 to 5
  mistakes: string[];
  lessons: string;
  screenshotUrl?: string;
  photos?: TradePhotos;
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface TradePhotoItem {
  id: string;
  type: 'ENTRY_1M' | 'EXIT_1M' | 'CONTEXT_HTF';
  label: string;
  url: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  description?: string;
  uploadedAt: string;
}

export interface TradePhotos {
  entry1M?: TradePhotoItem;
  exit1M?: TradePhotoItem;
  contextHTF?: TradePhotoItem;
}

export interface Settings {
  instruments: Record<string, InstrumentConfig>;
  privacyMode: boolean; // Blurs monetary amounts
  requirePin: boolean;
  pinCode?: string;
  csvDelimiter: ',' | ';';
}
