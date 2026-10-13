import { TradeEntry, TradeDirection, TradeOutcome, InstrumentConfig } from '../types/trade';

export const DEFAULT_INSTRUMENTS: Record<string, InstrumentConfig> = {
  MNQ: {
    symbol: 'MNQ',
    name: 'Micro E-mini Nasdaq-100',
    pointValue: 2.0, // 2 USD per index point
    tickSize: 0.25,
    tickValue: 0.50, // 0.25 * 2.0
    defaultCommission: 1.24, // USD per contract round-turn approx
  },
  MGC: {
    symbol: 'MGC',
    name: 'Micro Gold (Micro Oro)',
    pointValue: 10.0, // 10 USD per point ($1.00 move in gold = $10 per contract)
    tickSize: 0.10,
    tickValue: 1.00, // 0.10 * 10.0
    defaultCommission: 1.50, // USD per contract round-turn approx
  },
};

/**
 * Calculates total contracts and weighted average entry price across up to 6 entries.
 * Formula: sum(contracts_i * price_i) / sum(contracts_i)
 */
export function calculateWeightedEntry(entries: TradeEntry[]): {
  totalContracts: number;
  weightedAvgPrice: number;
} {
  const validEntries = entries.filter(
    (e) => Number(e.contracts) > 0 && Number(e.price) > 0
  );

  if (validEntries.length === 0) {
    return { totalContracts: 0, weightedAvgPrice: 0 };
  }

  const totalContracts = validEntries.reduce(
    (acc, e) => acc + Number(e.contracts),
    0
  );

  const weightedSum = validEntries.reduce(
    (acc, e) => acc + Number(e.contracts) * Number(e.price),
    0
  );

  const weightedAvgPrice = totalContracts > 0 ? weightedSum / totalContracts : 0;

  return {
    totalContracts,
    weightedAvgPrice: Number(weightedAvgPrice.toFixed(4)),
  };
}

/**
 * Calculates Gross Points gained or lost.
 * Long: Exit - AvgEntry
 * Short: AvgEntry - Exit
 */
export function calculateGrossPoints(
  direction: TradeDirection,
  avgEntry: number,
  exitPrice: number
): number {
  if (!avgEntry || !exitPrice) return 0;
  const pts = direction === 'LONG' ? exitPrice - avgEntry : avgEntry - exitPrice;
  return Number(pts.toFixed(4));
}

/**
 * Calculates Gross PnL in USD.
 * Formula: grossPoints * totalContracts * pointValue
 */
export function calculateGrossPnL(
  grossPoints: number,
  totalContracts: number,
  pointValue: number
): number {
  return Number((grossPoints * totalContracts * pointValue).toFixed(2));
}

/**
 * Calculates Net PnL in USD.
 * Formula: grossPnL - commissions
 */
export function calculateNetPnL(grossPnL: number, commissions: number): number {
  return Number((grossPnL - (commissions || 0)).toFixed(2));
}

/**
 * Calculates Initial Risk in points and USD.
 * Long: (AvgEntry - InitialStop) * totalContracts * pointValue
 * Short: (InitialStop - AvgEntry) * totalContracts * pointValue
 */
export function calculateRisk(
  direction: TradeDirection,
  avgEntry: number,
  initialStop: number,
  totalContracts: number,
  pointValue: number
): {
  riskPoints: number;
  riskDollars: number;
  isValidRisk: boolean;
} {
  if (!avgEntry || !initialStop || totalContracts <= 0 || pointValue <= 0) {
    return { riskPoints: 0, riskDollars: 0, isValidRisk: false };
  }

  let riskPoints = 0;
  let isValidRisk = false;

  if (direction === 'LONG') {
    riskPoints = avgEntry - initialStop;
    isValidRisk = riskPoints > 0;
  } else {
    riskPoints = initialStop - avgEntry;
    isValidRisk = riskPoints > 0;
  }

  if (riskPoints < 0) {
    riskPoints = 0;
    isValidRisk = false;
  }

  const riskDollars = Number(
    (riskPoints * totalContracts * pointValue).toFixed(2)
  );

  return {
    riskPoints: Number(riskPoints.toFixed(4)),
    riskDollars,
    isValidRisk,
  };
}

/**
 * Calculates R-Multiple (netPnL / initialRiskDollars).
 */
export function calculateRMultiple(
  netPnL: number,
  riskDollars: number
): number | null {
  if (!riskDollars || riskDollars <= 0) return null;
  return Number((netPnL / riskDollars).toFixed(2));
}

/**
 * Determines outcome category based on net PnL.
 */
export function determineOutcome(netPnL: number): TradeOutcome {
  if (netPnL > 0.05) return 'GANADORA';
  if (netPnL < -0.05) return 'PERDIDA';
  return 'BREAKEVEN';
}

/**
 * Formats currency values in USD with sign and decimals.
 */
export function formatUSD(amount: number, hideAmount: boolean = false): string {
  if (hideAmount) return '••••••';
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPoints(points: number): string {
  const prefix = points > 0 ? '+' : '';
  return `${prefix}${points.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} pts`;
}

export function formatR(r: number | null): string {
  if (r === null || r === undefined) return 'N/A';
  const prefix = r > 0 ? '+' : '';
  return `${prefix}${r.toFixed(2)}R`;
}

/**
 * Test & Verification Suite:
 * Automated tests with Long, Short, scale-in entries, commissions, and loss cases.
 * Returns detailed step-by-step breakdown.
 */
export interface VerificationCase {
  id: string;
  title: string;
  description: string;
  tradeData: {
    instrument: string;
    pointValue: number;
    direction: TradeDirection;
    entries: { contracts: number; price: number }[];
    initialStop: number;
    exitPrice: number;
    commissions: number;
  };
  expected: {
    totalContracts: number;
    weightedAvgPrice: number;
    grossPoints: number;
    grossPnL: number;
    netPnL: number;
    riskPoints: number;
    riskDollars: number;
    rMultiple: number | null;
    outcome: TradeOutcome;
  };
  actual?: {
    totalContracts: number;
    weightedAvgPrice: number;
    grossPoints: number;
    grossPnL: number;
    netPnL: number;
    riskPoints: number;
    riskDollars: number;
    rMultiple: number | null;
    outcome: TradeOutcome;
  };
  passed: boolean;
  notes: string[];
}

export function runFormulaVerificationTests(): VerificationCase[] {
  const cases: Omit<VerificationCase, 'actual' | 'passed' | 'notes'>[] = [
    {
      id: 'TEST-1-LONG-MNQ-SCALE-IN-WIN',
      title: 'Caso 1: Operación LONG en MNQ con 3 entradas escalonadas (Ganadora)',
      description:
        '3 entradas en MNQ (Valor punto: $2). Entrada 1: 1 ct @ 20,400. Entrada 2: 2 cts @ 20,410. Entrada 3: 1 ct @ 20,420. Total = 4 contratos. Stop inicial @ 20,380. Salida @ 20,460. Comisiones = $8.00.',
      tradeData: {
        instrument: 'MNQ',
        pointValue: 2.0,
        direction: 'LONG',
        entries: [
          { contracts: 1, price: 20400 },
          { contracts: 2, price: 20410 },
          { contracts: 1, price: 20420 },
        ],
        initialStop: 20380,
        exitPrice: 20460,
        commissions: 8.0,
      },
      expected: {
        // (1*20400 + 2*20410 + 1*20420)/4 = (20400 + 40820 + 20420)/4 = 81640/4 = 20,410.00
        totalContracts: 4,
        weightedAvgPrice: 20410,
        // Exit(20460) - Avg(20410) = +50.00 pts
        grossPoints: 50.0,
        // 50 pts * 4 cts * $2 = $400.00
        grossPnL: 400.0,
        // $400.00 - $8.00 comm = $392.00
        netPnL: 392.0,
        // Avg(20410) - SL(20380) = 30 pts
        riskPoints: 30.0,
        // 30 pts * 4 cts * $2 = $240.00
        riskDollars: 240.0,
        // +$392.00 / $240.00 = +1.63R
        rMultiple: 1.63,
        outcome: 'GANADORA',
      },
    },
    {
      id: 'TEST-2-SHORT-MGC-SCALE-IN-LOSS',
      title: 'Caso 2: Operación SHORT en MGC con 2 entradas escalonadas (Pérdida en Stop)',
      description:
        '2 entradas en MGC (Valor punto: $10). Entrada 1: 1 ct @ 2650.0. Entrada 2: 1 ct @ 2652.0. Total = 2 contratos. Stop inicial @ 2656.0. Salida tocando Stop @ 2656.0. Comisiones = $6.00.',
      tradeData: {
        instrument: 'MGC',
        pointValue: 10.0,
        direction: 'SHORT',
        entries: [
          { contracts: 1, price: 2650.0 },
          { contracts: 1, price: 2652.0 },
        ],
        initialStop: 2656.0,
        exitPrice: 2656.0,
        commissions: 6.0,
      },
      expected: {
        // (1*2650 + 1*2652)/2 = 2651.00
        totalContracts: 2,
        weightedAvgPrice: 2651.0,
        // SHORT: Avg(2651) - Exit(2656) = -5.00 pts
        grossPoints: -5.0,
        // -5.0 pts * 2 cts * $10 = -$100.00
        grossPnL: -100.0,
        // -$100.00 - $6.00 comm = -$106.00
        netPnL: -106.0,
        // SHORT: SL(2656) - Avg(2651) = 5.0 pts
        riskPoints: 5.0,
        // 5.0 pts * 2 cts * $10 = $100.00
        riskDollars: 100.0,
        // -$106.00 / $100.00 = -1.06R
        rMultiple: -1.06,
        outcome: 'PERDIDA',
      },
    },
    {
      id: 'TEST-3-SHORT-MNQ-SINGLE-WIN',
      title: 'Caso 3: Operación SHORT en MNQ 1 entrada (Ganadora)',
      description:
        '1 entrada en MNQ de 2 contratos @ 20,500. Stop inicial @ 20,530. Salida @ 20,420 (+80 pts). Comisiones = $4.96.',
      tradeData: {
        instrument: 'MNQ',
        pointValue: 2.0,
        direction: 'SHORT',
        entries: [{ contracts: 2, price: 20500 }],
        initialStop: 20530,
        exitPrice: 20420,
        commissions: 4.96,
      },
      expected: {
        totalContracts: 2,
        weightedAvgPrice: 20500,
        // SHORT: Avg(20500) - Exit(20420) = +80.00 pts
        grossPoints: 80.0,
        // 80 pts * 2 cts * $2 = $320.00
        grossPnL: 320.0,
        // $320.00 - $4.96 = $315.04
        netPnL: 315.04,
        // SHORT: SL(20530) - Avg(20500) = 30 pts
        riskPoints: 30.0,
        // 30 pts * 4 cts * $2 = $120.00
        riskDollars: 120.0,
        // +$315.04 / $120.00 = +2.63R
        rMultiple: 2.63,
        outcome: 'GANADORA',
      },
    },
    {
      id: 'TEST-4-LONG-MGC-BREAKEVEN',
      title: 'Caso 4: Operación LONG en MGC con salida en Breakeven (Resultado Neto Negativo por Comisiones)',
      description:
        '1 entrada en MGC de 1 contrato @ 2640.0. Salida en el mismo precio de entrada @ 2640.0. Stop inicial @ 2635.0. Comisiones = $3.00.',
      tradeData: {
        instrument: 'MGC',
        pointValue: 10.0,
        direction: 'LONG',
        entries: [{ contracts: 1, price: 2640.0 }],
        initialStop: 2635.0,
        exitPrice: 2640.0,
        commissions: 3.0,
      },
      expected: {
        totalContracts: 1,
        weightedAvgPrice: 2640.0,
        grossPoints: 0.0,
        grossPnL: 0.0,
        netPnL: -3.0,
        riskPoints: 5.0,
        riskDollars: 50.0,
        rMultiple: -0.06,
        outcome: 'PERDIDA',
      },
    },
    {
      id: 'TEST-5-ZERO-RISK',
      title: 'Caso 5: Operación con stop inválido en el precio de entrada',
      description: 'Una operación ganadora tiene el stop inicial en el mismo precio de entrada; el riesgo no debe dividirse entre cero y el múltiplo R debe quedar como N/A.',
      tradeData: {
        instrument: 'MNQ',
        pointValue: 2.0,
        direction: 'LONG',
        entries: [{ contracts: 1, price: 20000 }],
        initialStop: 20000,
        exitPrice: 20010,
        commissions: 0,
      },
      expected: {
        totalContracts: 1,
        weightedAvgPrice: 20000,
        grossPoints: 10,
        grossPnL: 20,
        netPnL: 20,
        riskPoints: 0,
        riskDollars: 0,
        rMultiple: null,
        outcome: 'GANADORA',
      },
    },
    {
      id: 'TEST-6-INVALID-ENTRY',
      title: 'Caso 6: Entradas inválidas sin contratos ni precio',
      description: 'Las entradas con cero contratos o cero precio deben excluirse de los cálculos y no generar PnL ni riesgo ficticio.',
      tradeData: {
        instrument: 'MGC',
        pointValue: 10.0,
        direction: 'LONG',
        entries: [{ contracts: 0, price: 2640 }, { contracts: 1, price: 0 }],
        initialStop: 0,
        exitPrice: 0,
        commissions: 0,
      },
      expected: {
        totalContracts: 0,
        weightedAvgPrice: 0,
        grossPoints: 0,
        grossPnL: 0,
        netPnL: 0,
        riskPoints: 0,
        riskDollars: 0,
        rMultiple: null,
        outcome: 'BREAKEVEN',
      },
    },
  ];

  return cases.map((tc) => {
    const rawEntries: TradeEntry[] = tc.tradeData.entries.map((e, idx) => ({
      id: `ent-${idx + 1}`,
      entryNumber: idx + 1,
      contracts: e.contracts,
      price: e.price,
    }));

    const { totalContracts, weightedAvgPrice } = calculateWeightedEntry(rawEntries);
    const grossPoints = calculateGrossPoints(
      tc.tradeData.direction,
      weightedAvgPrice,
      tc.tradeData.exitPrice
    );
    const grossPnL = calculateGrossPnL(
      grossPoints,
      totalContracts,
      tc.tradeData.pointValue
    );
    const netPnL = calculateNetPnL(grossPnL, tc.tradeData.commissions);
    const { riskPoints, riskDollars } = calculateRisk(
      tc.tradeData.direction,
      weightedAvgPrice,
      tc.tradeData.initialStop,
      totalContracts,
      tc.tradeData.pointValue
    );
    const rMultiple = calculateRMultiple(netPnL, riskDollars);
    const outcome = determineOutcome(netPnL);

    const actual = {
      totalContracts,
      weightedAvgPrice,
      grossPoints,
      grossPnL,
      netPnL,
      riskPoints,
      riskDollars,
      rMultiple,
      outcome,
    };

    const notes: string[] = [];
    let passed = true;

    if (actual.totalContracts !== tc.expected.totalContracts) {
      passed = false;
      notes.push(
        `Falla en Contratos: esperado ${tc.expected.totalContracts}, obtenido ${actual.totalContracts}`
      );
    }
    if (Math.abs(actual.weightedAvgPrice - tc.expected.weightedAvgPrice) > 0.001) {
      passed = false;
      notes.push(
        `Falla en Precio Ponderado: esperado ${tc.expected.weightedAvgPrice}, obtenido ${actual.weightedAvgPrice}`
      );
    }
    if (Math.abs(actual.grossPoints - tc.expected.grossPoints) > 0.001) {
      passed = false;
      notes.push(
        `Falla en Puntos Brutos: esperado ${tc.expected.grossPoints}, obtenido ${actual.grossPoints}`
      );
    }
    if (Math.abs(actual.grossPnL - tc.expected.grossPnL) > 0.01) {
      passed = false;
      notes.push(
        `Falla en PnL Bruto: esperado ${tc.expected.grossPnL}, obtenido ${actual.grossPnL}`
      );
    }
    if (Math.abs(actual.netPnL - tc.expected.netPnL) > 0.01) {
      passed = false;
      notes.push(
        `Falla en PnL Neto: esperado ${tc.expected.netPnL}, obtenido ${actual.netPnL}`
      );
    }
    if (Math.abs(actual.riskPoints - tc.expected.riskPoints) > 0.001) {
      passed = false;
      notes.push(
        `Falla en Riesgo en puntos: esperado ${tc.expected.riskPoints}, obtenido ${actual.riskPoints}`
      );
    }
    if (Math.abs(actual.riskDollars - tc.expected.riskDollars) > 0.01) {
      passed = false;
      notes.push(
        `Falla en Riesgo $: esperado ${tc.expected.riskDollars}, obtenido ${actual.riskDollars}`
      );
    }
    if (
      (tc.expected.rMultiple === null && actual.rMultiple !== null) ||
      (tc.expected.rMultiple !== null &&
        (actual.rMultiple === null || Math.abs(actual.rMultiple - tc.expected.rMultiple) > 0.02))
    ) {
      passed = false;
      notes.push(
        `Falla en Múltiplo R: esperado ${tc.expected.rMultiple}, obtenido ${actual.rMultiple}`
      );
    }
    if (actual.outcome !== tc.expected.outcome) {
      passed = false;
      notes.push(
        `Falla en Resultado: esperado ${tc.expected.outcome}, obtenido ${actual.outcome}`
      );
    }

    if (passed) {
      notes.push('✓ Todas las fórmulas y redondeos coinciden exactamente con la especificación matemática.');
    }

    return {
      ...tc,
      actual,
      passed,
      notes,
    };
  });
}
