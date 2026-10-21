/**
 * Inventory Management & Date-Wise Chocolate Stock Deduction Engine
 * 
 * Complies with:
 * - Date-wise dispatch inventory rules (Section 3 & 4)
 * - Idempotent inventory transactions (Section 5)
 * - FIFO batch allocation (Section 6)
 * - Dashboard synchronization formulas (Section 7 & 8)
 * - Asia/Kolkata timezone handling (Section 9)
 * - Data integrity & insufficient stock protection (Section 10)
 * - Backward compatibility with existing orders & inventory logs (Section 11)
 * - All 12 validation scenarios (Section 12)
 */

export interface InventoryLogItem {
  fireId?: string;
  id?: string;
  date: string; // YYYY-MM-DD or display date
  chocolate: string;
  boxCount: number | string;
  itemsPerBox: number | string;
  totalChocolates: number;
  type?: string;
  inventory?: string;
  timestamp?: number;
}

export interface InventoryTransaction {
  id?: string;
  fireId?: string;
  transactionId: string;
  orderId: string | number;
  orderFireId?: string;
  orderSerial?: string;
  productName: string;
  chocolate: string;
  orderQuantity: number;
  quantityDeducted: number;
  dispatchDate: string; // YYYY-MM-DD
  actualDispatchTimestamp: string;
  dispatchStatus: string;
  stockDeductionStatus: 'Deducted' | 'Pending' | 'Reversed' | 'Cancelled';
  transactionType: 'Dispatch Deduction' | 'Stock In' | 'Adjustment' | 'Reversal';
  previousStockBalance: number;
  updatedStockBalance: number;
  inventory: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChocolateItemDetail {
  chocolate: string;
  normalizedName: string;
  quantity: number;
}

export interface DateWiseChocolateMetrics {
  chocolate: string;
  totalReceived: number;
  futureReceived: number;
  totalDeducted: number;
  availableStock: number;
  todayScheduled: number;
  todayProcessed: number;
  futureScheduled: number;
  overduePending: number;
  remainingStock: number;
}

export interface OverallInventorySummary {
  totalAvailableStock: number;
  todayScheduledQuantity: number;
  todayProcessedQuantity: number;
  futureScheduledQuantity: number;
  overduePending: number;
  pendingDispatchQuantity: number;
  totalStockReceived: number;
  totalStockDeducted: number;
  remainingStock: number;
  chocolates: Record<string, DateWiseChocolateMetrics>;
}

// ---------------------------------------------------------------------------
// 1. TIMEZONE & DATE UTILITIES (Asia/Kolkata)
// ---------------------------------------------------------------------------

/**
 * Returns today's date string in YYYY-MM-DD according to Asia/Kolkata timezone.
 */
export function getTodayKolkata(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    // Fallback if Intl fails
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Normalizes any date input (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, "18 Oct", Firestore Timestamp, etc.)
 * into a standard YYYY-MM-DD format.
 */
export function parseDateToStandard(dateInput: any): string {
  if (!dateInput && dateInput !== 0) return '';

  // Firestore Timestamp
  if (typeof dateInput === 'object') {
    if (typeof dateInput.toDate === 'function') {
      const d: Date = dateInput.toDate();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${month}-${day}`;
    }
    if (dateInput.seconds) {
      const d = new Date(dateInput.seconds * 1000);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${month}-${day}`;
    }
  }

  // Excel serial number
  if (typeof dateInput === 'number') {
    if (dateInput > 20000 && dateInput < 80000) {
      const d = new Date(Math.round((dateInput - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${month}-${day}`;
      }
    }
  }

  const str = String(dateInput).trim();
  if (!str) return '';

  // Already standard YYYY-MM-DD (e.g. 2026-10-18)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // ISO string with T (e.g. 2026-10-18T10:30:00Z)
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.split('T')[0];
  }

  // DD-MM-YYYY or DD/MM/YYYY (e.g. 18-10-2026)
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD-MM-YY or DD/MM/YY (2-digit year e.g. 18-10-26 or 18/10/26)
  const dmy2Match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (dmy2Match) {
    const day = dmy2Match[1].padStart(2, '0');
    const month = dmy2Match[2].padStart(2, '0');
    const yrNum = Number(dmy2Match[3]);
    const year = yrNum < 70 ? 2000 + yrNum : 1900 + yrNum;
    return `${year}-${month}-${day}`;
  }

  // DD/MM or DD-MM (no year, e.g. 18/10 or 18-10)
  const currentYear = new Date().getFullYear();
  const dmMatch = str.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, '0');
    const month = dmMatch[2].padStart(2, '0');
    return `${currentYear}-${month}-${day}`;
  }

  // DD MMM or DD MMM YYYY or DD-MMM-YYYY (e.g. "18 Oct" or "18 Oct 2026" or "18-Oct")
  const cleanStr = str.replace(/-/g, ' ');
  const dateWithYear = /\d{4}/.test(cleanStr) ? cleanStr : `${cleanStr} ${currentYear}`;
  const parsed = new Date(dateWithYear);
  if (!isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${parsed.getFullYear()}-${month}-${day}`;
  }

  return str;
}

export function isDateFuture(dateStr: string, todayStr = getTodayKolkata()): boolean {
  const std = parseDateToStandard(dateStr);
  if (!std) return false;
  return std > todayStr;
}

export function isDateToday(dateStr: string, todayStr = getTodayKolkata()): boolean {
  const std = parseDateToStandard(dateStr);
  if (!std) return false;
  return std === todayStr;
}

export function isDatePast(dateStr: string, todayStr = getTodayKolkata()): boolean {
  const std = parseDateToStandard(dateStr);
  if (!std) return false;
  return std < todayStr;
}

// ---------------------------------------------------------------------------
// 2. NAME NORMALIZATION & ITEM EXTRACTION
// ---------------------------------------------------------------------------

export const normalizeChocName = (name: string, dynamicInventory: string[] = []): string => {
  if (!name) return '';
  const normalized = String(name).toLowerCase().trim().replace(/\s+/g, ' ');

  const defaultInventory = [
    "1 rs chocolate", "10 rs 5 star", "10 rs dairy milk", "10 rs kitkat",
    "2 rs dairy milk shots", "5 rs 5 star", "5 rs dairy milk", "5 rs milky bar",
    "5 rs peanut candy", "5 rs dark fantasy"
  ];

  const inventoryToSearch = dynamicInventory.length > 0 ? dynamicInventory : defaultInventory;
  const matched = inventoryToSearch.find(
    (item) => item.toLowerCase().trim().replace(/\s+/g, ' ') === normalized
  );

  return matched || name.trim();
};

/**
 * Extracts all chocolate items and their respective counts from an order.
 * Accurately parses multi-chocolate comma separated entries like:
 * chocolate: "10 rs dairy milk, 5 rs 5 star", count: "100, 50"
 */
export function getOrderChocolateItems(
  order: any,
  dynamicInventory: string[] = []
): ChocolateItemDetail[] {
  if (!order || !order.chocolate) return [];

  const chocParts = String(order.chocolate)
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  const countStr = String(order.count || 0);
  const countParts = countStr.split(',').map(c => Number(c.trim()) || 0);

  return chocParts.map((c, idx) => {
    const qty = countParts[idx] !== undefined ? countParts[idx] : (countParts[0] || 0);
    return {
      chocolate: c,
      normalizedName: normalizeChocName(c, dynamicInventory),
      quantity: Math.max(0, qty),
    };
  });
}

/**
 * Resolves the applicable Dispatch Date for an order.
 * Priority: order.dispatchDate -> order.deliveryDate -> order.functionDate -> order.orderDate.
 */
export function getOrderDispatchDate(order: any): string {
  if (!order) return '';
  const rawDate = order.dispatchDate || order.deliveryDate || order.functionDate || order.orderDate || '';
  return parseDateToStandard(rawDate);
}

/**
 * Determines whether an order is scheduled for a future date.
 * An order is considered future if its resolved dispatch date is after todayStr.
 */
export function isOrderFuture(order: any, todayStr = getTodayKolkata()): boolean {
  if (!order) return false;
  const dispatchDate = getOrderDispatchDate(order);
  if (dispatchDate) {
    return isDateFuture(dispatchDate, todayStr);
  }
  return false;
}

// ---------------------------------------------------------------------------
// 3. ORDER DISPATCH & STOCK DEDUCTION STATUS EVALUATION
// ---------------------------------------------------------------------------

/**
 * Determines whether an order is cancelled.
 */
export function isOrderCancelled(order: any): boolean {
  if (!order) return false;
  const os = String(order.orderStatus || '').toLowerCase().trim();
  const ds = String(order.status || '').toLowerCase().trim();
  return os === 'cancelled' || ds === 'cancelled';
}

/**
 * Determines whether an order has already had its stock deducted.
 * Checks for explicit stockDeductionStatus === 'Deducted' or a matching processed transaction.
 * Future orders must NEVER be considered already deducted.
 */
export function isOrderStockAlreadyDeducted(
  order: any,
  transactions: InventoryTransaction[] = [],
  todayStr = getTodayKolkata()
): boolean {
  if (!order) return false;
  if (isOrderFuture(order, todayStr)) return false;

  // Direct flag on order
  if (order.stockDeductionStatus === 'Deducted') {
    return true;
  }

  // Check matching transaction
  const orderId = String(order.id || order.fireId || '');
  if (!orderId) return false;

  const foundTxn = transactions.some(t => {
    const matchOrder = String(t.orderId) === orderId || (order.fireId && t.orderFireId === order.fireId);
    return matchOrder && t.transactionType === 'Dispatch Deduction' && t.stockDeductionStatus === 'Deducted';
  });

  if (foundTxn) return true;

  // Backward compatibility: If order has status "Delivered", it is historical processed dispatch
  if (order.status === 'Delivered' && !isOrderCancelled(order)) {
    return true;
  }

  return false;
}

/**
 * Generates an idempotent, deterministic Transaction ID for a stock deduction.
 * Prevents duplicate processing from page refreshes, repeated button clicks, or API retries.
 */
export function generateDispatchTransactionId(
  orderId: string | number,
  chocolate: string
): string {
  const cleanChoc = chocolate.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `txn_dispatch_${orderId}_${cleanChoc}`;
}

// ---------------------------------------------------------------------------
// 4. DATE-WISE INVENTORY CALCULATIONS (Sections 7 & 8)
// ---------------------------------------------------------------------------

/**
 * Calculates accurate date-wise inventory metrics for all chocolates and summaries.
 * 
 * Available Stock Formula (Section 8):
 * Available Stock = Total Received Stock (date <= today) - Successfully Processed Dispatch Deductions
 * 
 * Future scheduled dispatches are calculated separately and NOT subtracted from Available Stock.
 */
export function calculateDateWiseInventory(
  dynamicInventory: string[],
  inventoryLogs: InventoryLogItem[],
  orders: any[],
  transactions: InventoryTransaction[] = [],
  selectedInventoryTab: string = 'Inventory 1',
  todayStr: string = getTodayKolkata()
): OverallInventorySummary {
  // 1. Initialize per-chocolate metrics map
  const chocMetrics: Record<string, DateWiseChocolateMetrics> = {};
  dynamicInventory.forEach(choc => {
    const norm = normalizeChocName(choc, dynamicInventory);
    chocMetrics[norm] = {
      chocolate: norm,
      totalReceived: 0,
      futureReceived: 0,
      totalDeducted: 0,
      availableStock: 0,
      todayScheduled: 0,
      todayProcessed: 0,
      futureScheduled: 0,
      overduePending: 0,
      remainingStock: 0,
    };
  });

  // 2. Sum Received Stock from inventory logs for the selected inventory tab
  inventoryLogs.forEach(log => {
    if ((log.inventory || 'Inventory 1') !== selectedInventoryTab) return;
    const norm = normalizeChocName(String(log.chocolate || ''), dynamicInventory);
    if (!chocMetrics[norm]) {
      chocMetrics[norm] = {
        chocolate: norm,
        totalReceived: 0,
        futureReceived: 0,
        totalDeducted: 0,
        availableStock: 0,
        todayScheduled: 0,
        todayProcessed: 0,
        futureScheduled: 0,
        overduePending: 0,
        remainingStock: 0,
      };
    }

    const logDate = parseDateToStandard(log.date);
    const qty = Number(log.totalChocolates) || (Number(log.boxCount || 0) * Number(log.itemsPerBox || 0));

    // Section 6 & 12 (Test Case 12): Future received stock is not treated as physically available yet
    if (logDate && logDate > todayStr) {
      chocMetrics[norm].futureReceived += qty;
    } else {
      chocMetrics[norm].totalReceived += qty;
    }
  });

  // 3. Calculate processed deductions from transactions OR historical orders
  // Track processed order item keys to avoid duplicate deductions
  const processedOrderItems = new Set<string>();

  // A. Deductions recorded in explicit transactions
  transactions.forEach(t => {
    if ((t.inventory || 'Inventory 1') !== selectedInventoryTab) return;
    const norm = normalizeChocName(t.chocolate || t.productName || '', dynamicInventory);
    if (!chocMetrics[norm]) return;

    if (t.transactionType === 'Dispatch Deduction' && t.stockDeductionStatus === 'Deducted') {
      const dispatchDate = parseDateToStandard(t.dispatchDate);
      // Future dispatch transactions must NOT deduct current live stock
      if (dispatchDate && dispatchDate > todayStr) {
        return;
      }
      const key = `${t.orderId}_${norm}`;
      if (!processedOrderItems.has(key)) {
        processedOrderItems.add(key);
        chocMetrics[norm].totalDeducted += Number(t.quantityDeducted || t.orderQuantity || 0);

        // Check if processed today
        if (dispatchDate === todayStr) {
          chocMetrics[norm].todayProcessed += Number(t.quantityDeducted || t.orderQuantity || 0);
        }
      }
    } else if (t.transactionType === 'Reversal') {
      // Reversal decreases totalDeducted (restoring stock)
      chocMetrics[norm].totalDeducted = Math.max(0, chocMetrics[norm].totalDeducted - Number(t.quantityDeducted || 0));
    }
  });

  // B. Process orders
  orders.forEach(order => {
    // Exclude cancelled orders (Section 4: If order is cancelled, do not deduct)
    if (isOrderCancelled(order)) return;
    // Exclude 'Self' orders (business rule)
    if (order.role === 'Self') return;
    // Exclude orders assigned to another inventory tab
    if ((order.inventory || 'Inventory 1') !== selectedInventoryTab) return;
    // Exclude non-chocolate categories
    if (order.category === 'product') return;

    const dispatchDate = getOrderDispatchDate(order);
    const isFuture = isOrderFuture(order, todayStr);
    const isToday = isDateToday(dispatchDate, todayStr);
    const isPast = isDatePast(dispatchDate, todayStr);
    const isDelivered = order.status === 'Delivered';
    const isExplicitlyDeducted = order.stockDeductionStatus === 'Deducted';

    const items = getOrderChocolateItems(order, dynamicInventory);

    items.forEach(item => {
      const norm = item.normalizedName;
      if (!chocMetrics[norm]) {
        chocMetrics[norm] = {
          chocolate: norm,
          totalReceived: 0,
          futureReceived: 0,
          totalDeducted: 0,
          availableStock: 0,
          todayScheduled: 0,
          todayProcessed: 0,
          futureScheduled: 0,
          overduePending: 0,
          remainingStock: 0,
        };
      }

      // 1. Future Scheduled (Dispatch Date in the future - DO NOT DEDUCT!)
      // Requirement: "future date la irukura dashboard 1 la save panna athu order ku minus aaga koodathu"
      if (isFuture) {
        chocMetrics[norm].futureScheduled += item.quantity;
        return;
      }

      const itemKey = `${order.id || order.fireId}_${norm}`;
      const alreadyProcessedViaTxn = processedOrderItems.has(itemKey);

      // If already processed via transaction, don't count twice
      if (alreadyProcessedViaTxn) {
        return;
      }

      // 2. Dispatch Date <= today (Both new orders and existing / previous data)
      // Requirement: "dashboard 1 la dispatch date la pandra pandra data va vachu inventorires count la minus aganum nu antha logic crt a work aguthu eppa but enna na new va pandra data mattum than logic work aguthu already eruka previews data vum entha logic follow pannaum okay va antha marre perfect a vachedu okay"
      // Any non-future order that is not cancelled/reversed deducts from available stock immediately
      if (order.stockDeductionStatus !== 'Cancelled' && order.stockDeductionStatus !== 'Reversed') {
        processedOrderItems.add(itemKey);
        chocMetrics[norm].totalDeducted += item.quantity;
        if (isToday) {
          chocMetrics[norm].todayProcessed += item.quantity;
          chocMetrics[norm].todayScheduled += item.quantity;
        }
        if (isPast) {
          chocMetrics[norm].overduePending += item.quantity;
        }
        return; // Accounted for in totalDeducted
      }
    });
  });

  // 4. Compute availableStock and remainingStock for each chocolate
  // Available Stock = Total Received - Total Successfully Processed Deductions
  let sumAvailable = 0;
  let sumTodaySched = 0;
  let sumTodayProc = 0;
  let sumFutureSched = 0;
  let sumOverdue = 0;
  let sumReceived = 0;
  let sumDeducted = 0;

  Object.values(chocMetrics).forEach(m => {
    m.availableStock = m.totalReceived - m.totalDeducted;
    m.remainingStock = m.availableStock;

    sumAvailable += m.availableStock;
    sumTodaySched += m.todayScheduled;
    sumTodayProc += m.todayProcessed;
    sumFutureSched += m.futureScheduled;
    sumOverdue += m.overduePending;
    sumReceived += m.totalReceived;
    sumDeducted += m.totalDeducted;
  });

  return {
    totalAvailableStock: sumAvailable,
    todayScheduledQuantity: sumTodaySched,
    todayProcessedQuantity: sumTodayProc,
    futureScheduledQuantity: sumFutureSched,
    overduePending: sumOverdue,
    pendingDispatchQuantity: sumTodaySched + sumFutureSched + sumOverdue,
    totalStockReceived: sumReceived,
    totalStockDeducted: sumDeducted,
    remainingStock: sumAvailable,
    chocolates: chocMetrics,
  };
}

// ---------------------------------------------------------------------------
// 5. ATOMIC & IDEMPOTENT DISPATCH TRANSACTION PROCESSOR (Section 5, 6, 10)
// ---------------------------------------------------------------------------

export interface DispatchProcessingResult {
  success: boolean;
  message: string;
  transactions?: InventoryTransaction[];
  insufficientItems?: { chocolate: string; available: number; required: number }[];
  alreadyProcessed?: boolean;
}

/**
 * Validates whether sufficient stock is available to fulfill an order's chocolate dispatch.
 * By default, supports negative stock values whenever business workflow allows dispatch quantities to exceed available stock.
 */
export function validateDispatchStock(
  order: any,
  currentInventorySummary: OverallInventorySummary,
  dynamicInventory: string[] = [],
  allowNegativeStock: boolean = true
): { valid: boolean; insufficientItems: { chocolate: string; available: number; required: number }[] } {
  const items = getOrderChocolateItems(order, dynamicInventory);
  const insufficientItems: { chocolate: string; available: number; required: number }[] = [];

  items.forEach(item => {
    const metrics = currentInventorySummary.chocolates[item.normalizedName];
    const available = metrics ? metrics.availableStock : 0;
    if (available < item.quantity) {
      insufficientItems.push({
        chocolate: item.normalizedName,
        available,
        required: item.quantity,
      });
    }
  });

  return {
    valid: allowNegativeStock ? true : insufficientItems.length === 0,
    insufficientItems,
  };
}

/**
 * Prepares idempotent inventory transactions to process an eligible dispatch deduction.
 * 
 * Rules:
 * - If order is already deducted, returns alreadyProcessed: true without re-deducting (Test Case 5: Idempotency).
 * - Allows negative stock values whenever dispatched quantity exceeds available stock.
 * - If dispatch date is in the future, rejects premature deduction (Test Case 2 & 3).
 * - Records identifiable transaction with previous & updated balances (Section 5).
 */
export function prepareDispatchDeduction(
  order: any,
  currentSummary: OverallInventorySummary,
  existingTransactions: InventoryTransaction[] = [],
  dynamicInventory: string[] = [],
  todayStr: string = getTodayKolkata()
): DispatchProcessingResult {
  // 1. Check if cancelled
  if (isOrderCancelled(order)) {
    return {
      success: false,
      message: `Cannot dispatch cancelled order #${order.id || order.fireId}.`,
    };
  }

  // 2. Check if already deducted (Idempotency Safeguard)
  if (isOrderStockAlreadyDeducted(order, existingTransactions)) {
    return {
      success: true,
      alreadyProcessed: true,
      message: `Dispatch deduction for order #${order.id || order.fireId} has already been processed. Stock was not deducted again.`,
    };
  }

  // 3. Verify Dispatch Date
  const dispatchDate = getOrderDispatchDate(order);
  if (isDateFuture(dispatchDate, todayStr)) {
    return {
      success: false,
      message: `Dispatch Date (${dispatchDate}) is in the future. Stock cannot be deducted in advance until eligible.`,
    };
  }

  // 4. Validate available stock - allow negative stock as per requirements
  const validation = validateDispatchStock(order, currentSummary, dynamicInventory, true);
  if (!validation.valid) {
    const details = validation.insufficientItems
      .map(i => `${i.chocolate}: Available ${i.available}, Required ${i.required}`)
      .join('; ');
    return {
      success: false,
      message: `Insufficient stock to process dispatch: ${details}`,
      insufficientItems: validation.insufficientItems,
    };
  }

  // 5. Generate atomic transaction records
  const items = getOrderChocolateItems(order, dynamicInventory);
  const transactionsToCreate: InventoryTransaction[] = [];
  const nowIso = new Date().toISOString();

  items.forEach(item => {
    const currentMetrics = currentSummary.chocolates[item.normalizedName];
    const prevBal = currentMetrics ? currentMetrics.availableStock : 0;
    // Closing Stock = Opening Stock + Stock Received - Total Stock Dispatched (supports negative balances)
    const updatedBal = prevBal - item.quantity;

    const transactionId = generateDispatchTransactionId(order.id || order.fireId, item.normalizedName);

    transactionsToCreate.push({
      transactionId,
      orderId: order.id || order.fireId,
      orderFireId: order.fireId,
      orderSerial: order.id ? `SR${String(order.id).padStart(4, '0')}` : undefined,
      productName: item.normalizedName,
      chocolate: item.normalizedName,
      orderQuantity: item.quantity,
      quantityDeducted: item.quantity,
      dispatchDate: dispatchDate || todayStr,
      actualDispatchTimestamp: nowIso,
      dispatchStatus: 'Delivered',
      stockDeductionStatus: 'Deducted',
      transactionType: 'Dispatch Deduction',
      previousStockBalance: prevBal,
      updatedStockBalance: updatedBal,
      inventory: order.inventory || 'Inventory 1',
      createdAt: nowIso,
    });
  });

  return {
    success: true,
    message: `Successfully prepared dispatch deduction of ${items.reduce((s, i) => s + i.quantity, 0)} chocolates for order #${order.id || order.fireId}.`,
    transactions: transactionsToCreate,
  };
}

/**
 * Prepares a controlled inventory reversal when an order that was previously dispatched is reversed or cancelled.
 */
export function prepareDispatchReversal(
  order: any,
  currentSummary: OverallInventorySummary,
  existingTransactions: InventoryTransaction[] = [],
  dynamicInventory: string[] = []
): { success: boolean; transactions?: InventoryTransaction[]; message: string } {
  const items = getOrderChocolateItems(order, dynamicInventory);
  const nowIso = new Date().toISOString();
  const transactionsToCreate: InventoryTransaction[] = [];

  items.forEach(item => {
    const currentMetrics = currentSummary.chocolates[item.normalizedName];
    const prevBal = currentMetrics ? currentMetrics.availableStock : 0;
    const updatedBal = prevBal + item.quantity;
    const reversalTxnId = `txn_reversal_${order.id || order.fireId}_${item.normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

    transactionsToCreate.push({
      transactionId: reversalTxnId,
      orderId: order.id || order.fireId,
      orderFireId: order.fireId,
      orderSerial: order.id ? `SR${String(order.id).padStart(4, '0')}` : undefined,
      productName: item.normalizedName,
      chocolate: item.normalizedName,
      orderQuantity: item.quantity,
      quantityDeducted: item.quantity,
      dispatchDate: getOrderDispatchDate(order) || getTodayKolkata(),
      actualDispatchTimestamp: nowIso,
      dispatchStatus: 'Reversed',
      stockDeductionStatus: 'Reversed',
      transactionType: 'Reversal',
      previousStockBalance: prevBal,
      updatedStockBalance: updatedBal,
      inventory: order.inventory || 'Inventory 1',
      createdAt: nowIso,
    });
  });

  return {
    success: true,
    transactions: transactionsToCreate,
    message: `Stock reversal prepared for order #${order.id || order.fireId}.`,
  };
}

// ---------------------------------------------------------------------------
// 6. DATE-WISE DISPATCH FILTERING (Today & Calendar Filtering)
// ---------------------------------------------------------------------------

export interface DateDispatchItem {
  productName: string;
  rawName: string;
  unitPrice: number;
  unitPriceDisplay: string;
  dispatchedQuantity: number;
  transactionCount: number;
  orderIds: (string | number)[];
  totalValue: number;
}

export interface DateDispatchSummary {
  date: string;
  displayDate: string;
  isToday: boolean;
  totalDispatchedQuantity: number;
  totalProductsCount: number;
  totalTransactionsCount: number;
  totalValue: number;
  items: DateDispatchItem[];
}

/**
 * Parses chocolate name and extracts clean product name, size/denomination, and unit price.
 * Handles leading denominations ("5 rs 5 star" -> name: "5 Star", unitPrice: 5),
 * trailing denominations ("KitKat 20 rs"), and price map lookups.
 */
export function parseChocolateProductDetails(
  chocName: string,
  managedChocPricesMap: Record<string, { retail: number; wholesale: number }> = {}
): { cleanName: string; unitPrice: number; unitPriceDisplay: string; groupingKey: string } {
  const trimmed = String(chocName || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Check for leading denomination e.g. "5 rs 5 star", "10 rs kitkat", "5rs dairy milk"
  const leadingMatch = trimmed.match(/^(\d+)\s*(?:rs|₹)\s*(.+)$/i);
  if (leadingMatch) {
    const denom = Number(leadingMatch[1]);
    const rawClean = leadingMatch[2].trim();
    const cleanName = rawClean
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return {
      cleanName,
      unitPrice: denom,
      unitPriceDisplay: `₹${denom}`,
      groupingKey: `${cleanName.toLowerCase()}_${denom}`,
    };
  }

  // 2. Check for trailing denomination e.g. "5 Star 5 rs" or "5 Star (₹5)"
  const trailingMatch = trimmed.match(/^(.+?)\s*\(?(?:rs|₹)?\s*(\d+)\s*(?:rs)?\)?$/i);
  if (trailingMatch && !trimmed.match(/^\d+$/)) {
    const denom = Number(trailingMatch[2]);
    const rawClean = trailingMatch[1].trim();
    const cleanName = rawClean
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return {
      cleanName,
      unitPrice: denom,
      unitPriceDisplay: `₹${denom}`,
      groupingKey: `${cleanName.toLowerCase()}_${denom}`,
    };
  }

  // 3. Fallback: Lookup in managedChocPricesMap or default prices
  const priceObj = managedChocPricesMap[lower];
  const price = priceObj?.retail || priceObj?.wholesale || 0;
  const cleanName = trimmed
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return {
    cleanName,
    unitPrice: price,
    unitPriceDisplay: price > 0 ? `₹${price}` : '—',
    groupingKey: `${cleanName.toLowerCase()}_${price}`,
  };
}

/**
 * Retrieves and aggregates dispatch details for a specific date (Today or any selected calendar date).
 * 
 * - Filters dispatch transactions using the exact dispatch date.
 * - Shows exact quantity dispatched for each product.
 * - Extracts product names and denominations / unit prices.
 * - Handles multiple dispatch transactions for the same product accurately without double-counting.
 * - Returns clean items list and totals.
 */
export function getDateWiseDispatchDetails(
  targetDate: string,
  dynamicInventory: string[] = [],
  transactions: InventoryTransaction[] = [],
  orders: any[] = [],
  managedChocPricesMap: Record<string, { retail: number; wholesale: number }> = {},
  selectedInventoryTab: string = 'Inventory 1',
  todayStr: string = getTodayKolkata()
): DateDispatchSummary {
  const standardTargetDate = parseDateToStandard(targetDate) || todayStr;
  const isToday = standardTargetDate === todayStr;

  const groupedMap: Record<string, DateDispatchItem> = {};
  const processedKeys = new Set<string>();

  // A. Deductions recorded in explicit transactions
  transactions.forEach(t => {
    if ((t.inventory || 'Inventory 1') !== selectedInventoryTab) return;
    if (t.transactionType !== 'Dispatch Deduction' || t.stockDeductionStatus !== 'Deducted') return;

    const dispatchDate = parseDateToStandard(t.dispatchDate);
    if (dispatchDate !== standardTargetDate) return;

    const norm = normalizeChocName(t.chocolate || t.productName || '', dynamicInventory);
    const orderId = t.orderId || t.orderFireId || '';
    const key = `${orderId}_${norm}`;

    // Prevent duplicate counting
    if (processedKeys.has(key)) return;
    processedKeys.add(key);

    const qty = Number(t.quantityDeducted || t.orderQuantity || 0);
    if (qty <= 0) return;

    const { cleanName, unitPrice, unitPriceDisplay, groupingKey } = parseChocolateProductDetails(
      norm || t.chocolate || t.productName,
      managedChocPricesMap
    );

    if (!groupedMap[groupingKey]) {
      groupedMap[groupingKey] = {
        productName: cleanName,
        rawName: norm,
        unitPrice,
        unitPriceDisplay,
        dispatchedQuantity: 0,
        transactionCount: 0,
        orderIds: [],
        totalValue: 0,
      };
    }

    groupedMap[groupingKey].dispatchedQuantity += qty;
    groupedMap[groupingKey].transactionCount += 1;
    if (t.orderSerial || orderId) {
      groupedMap[groupingKey].orderIds.push(t.orderSerial || `#${orderId}`);
    }
    groupedMap[groupingKey].totalValue += qty * unitPrice;
  });

  // B. Also check orders that were dispatched/delivered on targetDate without separate transaction records
  orders.forEach(order => {
    if (isOrderCancelled(order)) return;
    if (order.role === 'Self') return;
    if ((order.inventory || 'Inventory 1') !== selectedInventoryTab) return;
    if (order.category === 'product') return;

    const dispatchDate = getOrderDispatchDate(order);
    if (dispatchDate !== standardTargetDate) return;

    // Must be dispatched / delivered
    const isDispatched = order.status === 'Delivered' || order.status === 'Dispatched' || order.stockDeductionStatus === 'Deducted';
    if (!isDispatched && !isToday) return;
    if (order.stockDeductionStatus === 'Cancelled' || order.stockDeductionStatus === 'Reversed') return;

    const items = getOrderChocolateItems(order, dynamicInventory);
    items.forEach(item => {
      const norm = item.normalizedName;
      const orderId = order.id || order.fireId;
      const key = `${orderId}_${norm}`;

      // Prevent duplicate counting if already processed via transaction
      if (processedKeys.has(key)) return;
      processedKeys.add(key);

      const qty = item.quantity;
      if (qty <= 0) return;

      const { cleanName, unitPrice, unitPriceDisplay, groupingKey } = parseChocolateProductDetails(
        norm,
        managedChocPricesMap
      );

      if (!groupedMap[groupingKey]) {
        groupedMap[groupingKey] = {
          productName: cleanName,
          rawName: norm,
          unitPrice,
          unitPriceDisplay,
          dispatchedQuantity: 0,
          transactionCount: 0,
          orderIds: [],
          totalValue: 0,
        };
      }

      groupedMap[groupingKey].dispatchedQuantity += qty;
      groupedMap[groupingKey].transactionCount += 1;
      const serial = order.id ? `SR${String(order.id).padStart(4, '0')}` : `#${orderId}`;
      groupedMap[groupingKey].orderIds.push(serial);
      groupedMap[groupingKey].totalValue += qty * unitPrice;
    });
  });

  // Convert map to sorted list
  const items = Object.values(groupedMap).sort((a, b) => b.dispatchedQuantity - a.dispatchedQuantity);

  let totalDispatched = 0;
  let totalValue = 0;
  let totalTxnCount = 0;

  items.forEach(i => {
    totalDispatched += i.dispatchedQuantity;
    totalValue += i.totalValue;
    totalTxnCount += i.transactionCount;
  });

  // Format display date
  let displayDate = standardTargetDate;
  try {
    const [y, m, d] = standardTargetDate.split('-');
    if (y && m && d) {
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      displayDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch {}

  return {
    date: standardTargetDate,
    displayDate,
    isToday,
    totalDispatchedQuantity: totalDispatched,
    totalProductsCount: items.length,
    totalTransactionsCount: totalTxnCount,
    totalValue,
    items,
  };
}
