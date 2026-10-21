import { describe, it, expect } from 'vitest';
import {
  calculateDateWiseInventory,
  prepareDispatchDeduction,
  validateDispatchStock,
  getDateWiseDispatchDetails,
  parseChocolateProductDetails,
  getOrderDispatchDate,
  isDateFuture,
  isDateToday,
  isDatePast,
  isOrderFuture,
  normalizeChocName,
  InventoryLogItem,
  InventoryTransaction,
} from '../lib/inventoryManager';

describe('Date-Wise Chocolate Inventory Management System (Section 12 Tests)', () => {
  const dynamicInventory = [
    '1 rs chocolate',
    '10 rs dairy milk',
    '10 rs kitkat',
    '5 rs 5 star',
  ];

  const todayStr = '2026-10-18';

  // -------------------------------------------------------------------------
  // Test Case 1: Today's Dispatch
  // Initial stock: 5,000. Today's eligible dispatch quantity: 200.
  // Expected result after successful dispatch processing: 4,800.
  // -------------------------------------------------------------------------
  it('Test Case 1: Today\'s Dispatch should deduct only when processed, leaving 4,800', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    // Order scheduled for today, in process (not yet dispatched)
    const todayOrder = {
      id: 101,
      fireId: 'order-101',
      name: 'Ravi',
      chocolate: '10 rs dairy milk',
      count: '200',
      deliveryDate: '2026-10-18',
      status: 'In Process',
      orderStatus: 'forward to print (paid)',
      inventory: 'Inventory 1',
    };

    // Today's dispatch automatically deducts stock, leaving 4,800
    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [todayOrder],
      [],
      'Inventory 1',
      todayStr
    );

    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(4800);
    expect(summary.chocolates['10 rs dairy milk'].todayProcessed).toBe(200);

    // Calling prepareDispatchDeduction generates atomic transaction
    const prepResult = prepareDispatchDeduction(todayOrder, summary, [], dynamicInventory, todayStr);
    expect(prepResult.success).toBe(true);
    expect(prepResult.transactions?.length).toBe(1);

    // After applying transaction, stock remains 4,800 without double-deducting
    const summaryAfter = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [todayOrder],
      prepResult.transactions || [],
      'Inventory 1',
      todayStr
    );
    expect(summaryAfter.chocolates['10 rs dairy milk'].availableStock).toBe(4800);
  });

  // -------------------------------------------------------------------------
  // Test Case 2: Future Dispatch
  // Initial stock: 5,000. Tomorrow's scheduled dispatch quantity: 300.
  // Expected result before dispatch processing: 5,000.
  // -------------------------------------------------------------------------
  it('Test Case 2: Future Dispatch (tomorrow) must not reduce current available stock', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const tomorrowOrder = {
      id: 102,
      chocolate: '10 rs dairy milk',
      count: '300',
      deliveryDate: '2026-10-19',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [tomorrowOrder],
      [],
      'Inventory 1',
      todayStr
    );

    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(5000);
    expect(summary.chocolates['10 rs dairy milk'].futureScheduled).toBe(300);
  });

  // -------------------------------------------------------------------------
  // Test Case 3: Distant Future Dispatch
  // Initial stock: 5,000. October 25 scheduled dispatch quantity: 1,000.
  // Expected result before dispatch processing: 5,000.
  // -------------------------------------------------------------------------
  it('Test Case 3: Distant Future Dispatch (Oct 25) must remain undeducted from today\'s stock', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const oct25Order = {
      id: 103,
      chocolate: '10 rs dairy milk',
      count: '1000',
      deliveryDate: '2026-10-25',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [oct25Order],
      [],
      'Inventory 1',
      todayStr
    );

    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(5000);
    expect(summary.chocolates['10 rs dairy milk'].futureScheduled).toBe(1000);

    // Attempting premature dispatch processing on future order must be rejected
    const attemptResult = prepareDispatchDeduction(oct25Order, summary, [], dynamicInventory, todayStr);
    expect(attemptResult.success).toBe(false);
    expect(attemptResult.message).toContain('future');
  });

  // -------------------------------------------------------------------------
  // Test Case 4: Multiple Dispatch Dates
  // Initial stock: 5,000.
  // - October 18 dispatch: 200.
  // - October 19 dispatch: 300.
  // - October 25 dispatch: 1,000.
  // After successfully processing only the October 18 dispatch, expected available stock: 4,800.
  // The future quantities must remain undeducted.
  // -------------------------------------------------------------------------
  it('Test Case 4: Multiple Dispatch Dates - only Oct 18 processed, Oct 19 & 25 remain undeducted', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const orders = [
      {
        id: 'ord-oct18',
        chocolate: '10 rs dairy milk',
        count: '200',
        deliveryDate: '2026-10-18',
        status: 'In Process',
        inventory: 'Inventory 1',
      },
      {
        id: 'ord-oct19',
        chocolate: '10 rs dairy milk',
        count: '300',
        deliveryDate: '2026-10-19',
        status: 'In Process',
        inventory: 'Inventory 1',
      },
      {
        id: 'ord-oct25',
        chocolate: '10 rs dairy milk',
        count: '1000',
        deliveryDate: '2026-10-25',
        status: 'In Process',
        inventory: 'Inventory 1',
      },
    ];

    const initialSummary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      orders,
      [],
      'Inventory 1',
      todayStr
    );

    expect(initialSummary.chocolates['10 rs dairy milk'].availableStock).toBe(4800);
    expect(initialSummary.chocolates['10 rs dairy milk'].todayProcessed).toBe(200);
    expect(initialSummary.chocolates['10 rs dairy milk'].futureScheduled).toBe(1300); // 300 + 1000

    // Calling prepareDispatchDeduction generates atomic transaction
    const oct18Deduction = prepareDispatchDeduction(
      orders[0],
      initialSummary,
      [],
      dynamicInventory,
      todayStr
    );
    expect(oct18Deduction.success).toBe(true);
    expect(oct18Deduction.transactions?.length).toBe(1);

    // Stock remains 4,800 without double-deduction and future orders remain completely undeducted!
    const updatedSummary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      orders,
      oct18Deduction.transactions,
      'Inventory 1',
      todayStr
    );
    expect(updatedSummary.chocolates['10 rs dairy milk'].availableStock).toBe(4800);
    expect(updatedSummary.chocolates['10 rs dairy milk'].futureScheduled).toBe(1300);
  });

  // -------------------------------------------------------------------------
  // Test Case 5: Duplicate Processing
  // Initial stock: 5,000. Dispatch quantity: 200.
  // Process the same dispatch twice using repeated requests or page refreshes.
  // Expected result: stock remains 4,800, not 4,600.
  // -------------------------------------------------------------------------
  it('Test Case 5: Duplicate Processing - repeated requests or refreshes must not deduct twice', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const order = {
      id: 555,
      fireId: 'order-555',
      chocolate: '10 rs dairy milk',
      count: '200',
      deliveryDate: '2026-10-18',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    // First deduction
    const summary1 = calculateDateWiseInventory(dynamicInventory, logs, [order], [], 'Inventory 1', todayStr);
    const deduction1 = prepareDispatchDeduction(order, summary1, [], dynamicInventory, todayStr);
    expect(deduction1.success).toBe(true);
    const transactions = deduction1.transactions || [];

    const summaryAfterFirst = calculateDateWiseInventory(dynamicInventory, logs, [order], transactions, 'Inventory 1', todayStr);
    expect(summaryAfterFirst.chocolates['10 rs dairy milk'].availableStock).toBe(4800);

    // Second deduction attempt with same order & existing transactions (e.g. repeated click or refresh)
    const deduction2 = prepareDispatchDeduction(order, summaryAfterFirst, transactions, dynamicInventory, todayStr);
    expect(deduction2.alreadyProcessed).toBe(true);

    // Summary recomputed: MUST REMAIN 4800, NOT 4600!
    const summaryAfterSecond = calculateDateWiseInventory(dynamicInventory, logs, [order], transactions, 'Inventory 1', todayStr);
    expect(summaryAfterSecond.chocolates['10 rs dairy milk'].availableStock).toBe(4800);
  });

  // -------------------------------------------------------------------------
  // Test Case 6: Cancelled Order
  // Initial stock: 5,000. Cancelled order quantity: 100.
  // Expected result: no stock deduction for an order cancelled before dispatch processing.
  // -------------------------------------------------------------------------
  it('Test Case 6: Cancelled Order must not cause stock deduction', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const cancelledOrder = {
      id: 601,
      chocolate: '10 rs dairy milk',
      count: '100',
      deliveryDate: '2026-10-18',
      status: 'Cancelled',
      orderStatus: 'cancelled',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [cancelledOrder],
      [],
      'Inventory 1',
      todayStr
    );

    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(5000);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(0);
    expect(summary.chocolates['10 rs dairy milk'].todayScheduled).toBe(0);

    // Attempting to dispatch a cancelled order must be blocked
    const result = prepareDispatchDeduction(cancelledOrder, summary, [], dynamicInventory, todayStr);
    expect(result.success).toBe(false);
    expect(result.message).toContain('cancelled');
  });

  // -------------------------------------------------------------------------
  // Test Case 7: Stock Calculation - Support Negative Stock Balance
  // Initial stock: 100. Eligible dispatch quantity: 150.
  // Expected result: 100 - 150 = -50 negative stock balance.
  // -------------------------------------------------------------------------
  it('Test Case 7: Stock calculation accurately calculates and displays negative stock balance', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 1,
        itemsPerBox: 100,
        totalChocolates: 100,
        inventory: 'Inventory 1',
      },
    ];

    const largeOrder = {
      id: 701,
      chocolate: '10 rs dairy milk',
      count: '150',
      deliveryDate: '2026-10-18',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    // Stock calculation supports negative stock balance: 100 - 150 = -50
    const summary = calculateDateWiseInventory(dynamicInventory, logs, [largeOrder], [], 'Inventory 1', todayStr);
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(-50);
    expect(summary.chocolates['10 rs dairy milk'].remainingStock).toBe(-50);

    // Initial stock before deduction is 100
    const summaryBefore = calculateDateWiseInventory(dynamicInventory, logs, [], [], 'Inventory 1', todayStr);
    expect(summaryBefore.chocolates['10 rs dairy milk'].availableStock).toBe(100);

    // When allowNegativeStock is false, strict validation flags insufficient stock
    const strictValidation = validateDispatchStock(largeOrder, summaryBefore, dynamicInventory, false);
    expect(strictValidation.valid).toBe(false);
    expect(strictValidation.insufficientItems.length).toBe(1);
    expect(strictValidation.insufficientItems[0].available).toBe(100);
    expect(strictValidation.insufficientItems[0].required).toBe(150);

    // Default validation allows negative stock balance
    const defaultValidation = validateDispatchStock(largeOrder, summaryBefore, dynamicInventory);
    expect(defaultValidation.valid).toBe(true);

    // Deduction creates transaction with accurate negative balance: 100 - 150 = -50
    const result = prepareDispatchDeduction(largeOrder, summaryBefore, [], dynamicInventory, todayStr);
    expect(result.success).toBe(true);
    expect(result.transactions).toBeDefined();
    expect(result.transactions![0].previousStockBalance).toBe(100);
    expect(result.transactions![0].updatedStockBalance).toBe(-50);
  });

  // -------------------------------------------------------------------------
  // Test Case 8: Overdue Dispatch
  // An order has a Dispatch Date in the past (historical / existing order).
  // Expected result: past orders deduct from available stock and are tracked in overduePending.
  // -------------------------------------------------------------------------
  it('Test Case 8: Overdue Dispatch must be flagged as pending/overdue and deducted from stock', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
    ];

    const overdueOrder = {
      id: 801,
      chocolate: '10 rs dairy milk',
      count: '50',
      deliveryDate: '2026-10-15', // 3 days ago relative to 2026-10-18
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(dynamicInventory, logs, [overdueOrder], [], 'Inventory 1', todayStr);

    // Initial stock 1000 - 50 = 950 available stock
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(950);
    expect(summary.chocolates['10 rs dairy milk'].overduePending).toBe(50);
  });

  // -------------------------------------------------------------------------
  // Test Case 9: Multiple Users (Concurrency & Idempotency)
  // Two authorized users attempt to process dispatches simultaneously.
  // Expected result: preserves inventory accuracy, prevents duplicate processing, prevents invalid balance.
  // -------------------------------------------------------------------------
  it('Test Case 9: Multiple Users simultaneous processing maintains idempotency and data integrity', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
    ];

    const order1 = {
      id: 901,
      chocolate: '10 rs dairy milk',
      count: '200',
      deliveryDate: '2026-10-18',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const currentSummary = calculateDateWiseInventory(dynamicInventory, logs, [order1], [], 'Inventory 1', todayStr);

    // User A executes dispatch
    const resultUserA = prepareDispatchDeduction(order1, currentSummary, [], dynamicInventory, todayStr);
    expect(resultUserA.success).toBe(true);
    const recordedTransactions = resultUserA.transactions || [];

    // User B attempts to execute dispatch for same order at the same time
    const resultUserB = prepareDispatchDeduction(order1, currentSummary, recordedTransactions, dynamicInventory, todayStr);
    expect(resultUserB.alreadyProcessed).toBe(true);

    // Stock deducted only once
    const finalSummary = calculateDateWiseInventory(dynamicInventory, logs, [order1], recordedTransactions, 'Inventory 1', todayStr);
    expect(finalSummary.chocolates['10 rs dairy milk'].availableStock).toBe(800);
  });

  // -------------------------------------------------------------------------
  // Test Case 10: Dashboard Consistency
  // Process a valid dispatch and compare inventory summary metrics.
  // Expected result: all relevant stock values agree with recorded transactions.
  // -------------------------------------------------------------------------
  it('Test Case 10: Dashboard Consistency - all metrics agree with recorded transactions', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const orders = [
      { id: 1001, chocolate: '10 rs dairy milk', count: '200', deliveryDate: '2026-10-18', status: 'Delivered', inventory: 'Inventory 1' },
      { id: 1002, chocolate: '10 rs dairy milk', count: '150', deliveryDate: '2026-10-18', status: 'In Process', inventory: 'Inventory 1' },
      { id: 1003, chocolate: '10 rs dairy milk', count: '300', deliveryDate: '2026-10-20', status: 'In Process', inventory: 'Inventory 1' },
    ];

    const summary = calculateDateWiseInventory(dynamicInventory, logs, orders, [], 'Inventory 1', todayStr);

    expect(summary.totalStockReceived).toBe(5000);
    expect(summary.totalStockDeducted).toBe(350); // Delivered (200) + Today's in process (150)
    expect(summary.totalAvailableStock).toBe(4650); // 5000 - 350
    expect(summary.todayProcessedQuantity).toBe(350);
    expect(summary.futureScheduledQuantity).toBe(300); // Oct 20 order remains future and undeducted
    expect(summary.remainingStock).toBe(4650);
  });

  // -------------------------------------------------------------------------
  // Test Case 11: Date helpers & route sanity
  // -------------------------------------------------------------------------
  it('Test Case 11: Date helpers accurately identify today, future, and past in Asia/Kolkata', () => {
    expect(isDateToday('2026-10-18', '2026-10-18')).toBe(true);
    expect(isDateFuture('2026-10-19', '2026-10-18')).toBe(true);
    expect(isDateFuture('2026-10-25', '2026-10-18')).toBe(true);
    expect(isDatePast('2026-10-17', '2026-10-18')).toBe(true);
    expect(getOrderDispatchDate({ deliveryDate: '18-10-2026' })).toBe('2026-10-18');
  });

  // -------------------------------------------------------------------------
  // Test Case 12: Future Stock Receipt
  // Add a future-dated inventory batch.
  // Expected result: the system does not treat that stock as physically available before receipt date.
  // -------------------------------------------------------------------------
  it('Test Case 12: Future Stock Receipt must not be treated as physically available before receipt date', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
      // Future batch received on Oct 25
      {
        date: '2026-10-25',
        chocolate: '10 rs dairy milk',
        boxCount: 20,
        itemsPerBox: 100,
        totalChocolates: 2000,
        inventory: 'Inventory 1',
      },
    ];

    const summary = calculateDateWiseInventory(dynamicInventory, logs, [], [], 'Inventory 1', todayStr);

    // On Oct 18, only 1,000 is physically available! The 2,000 on Oct 25 is futureReceived!
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(1000);
    expect(summary.chocolates['10 rs dairy milk'].totalReceived).toBe(1000);
    expect(summary.chocolates['10 rs dairy milk'].futureReceived).toBe(2000);
  });

  // -------------------------------------------------------------------------
  // Test Case 13: OverallInventorySummary overduePending and toLocaleString formatting
  // -------------------------------------------------------------------------
  it('Test Case 13: OverallInventorySummary has overduePending and formats with toLocaleString()', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
    ];

    const overdueOrder = {
      id: 99,
      fireId: 'order-99',
      name: 'Past Customer',
      chocolate: '10 rs dairy milk',
      count: '150',
      deliveryDate: '2026-10-15', // Past date relative to Oct 18
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(dynamicInventory, logs, [overdueOrder], [], 'Inventory 1', todayStr);

    expect(summary.overduePending).toBe(150);
    expect(summary.totalAvailableStock).toBe(850);
    expect(summary.overduePending.toLocaleString()).toBe('150');
    expect(summary.totalAvailableStock.toLocaleString()).toBe('850');
    expect(summary.totalStockReceived.toLocaleString()).toBe('1,000');
    expect(summary.totalStockDeducted.toLocaleString()).toBe('150');
  });

  // -------------------------------------------------------------------------
  // Test Case 14: Order Added with Current Date (Today) Automatically Deducts
  // -------------------------------------------------------------------------
  it('Test Case 14: Order saved with current date (today) automatically deducts from available stock', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const currentOrder = {
      id: 201,
      fireId: 'order-201',
      name: 'Priya',
      chocolate: '10 rs dairy milk',
      count: '250',
      orderDate: '2026-10-18',
      deliveryDate: '2026-10-18',
      stockDeductionStatus: 'Deducted',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [currentOrder],
      [],
      'Inventory 1',
      todayStr
    );

    // Initial stock 5000 - 250 = 4750 available
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(4750);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(250);
    expect(summary.chocolates['10 rs dairy milk'].todayProcessed).toBe(250);
    expect(summary.chocolates['10 rs dairy milk'].futureScheduled).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test Case 15: Order Saved with Future Date Must NOT Deduct from Inventory
  // -------------------------------------------------------------------------
  it('Test Case 15: Order saved with future date must NOT deduct from available stock and remain in futureScheduled', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 50,
        itemsPerBox: 100,
        totalChocolates: 5000,
        inventory: 'Inventory 1',
      },
    ];

    const futureOrder = {
      id: 202,
      fireId: 'order-202',
      name: 'Karthik',
      chocolate: '10 rs dairy milk',
      count: '400',
      orderDate: '2026-10-18',
      deliveryDate: '2026-10-25', // Future dispatch date
      stockDeductionStatus: 'Pending',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [futureOrder],
      [],
      'Inventory 1',
      todayStr
    );

    // Initial stock 5000 remains 5000 available; futureScheduled is 400
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(5000);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(0);
    expect(summary.chocolates['10 rs dairy milk'].futureScheduled).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Test Case 16: Dispatch Date Priority
  // order.dispatchDate takes precedence over deliveryDate, functionDate, and orderDate
  // -------------------------------------------------------------------------
  it('Test Case 16: getOrderDispatchDate strictly respects priority dispatchDate > deliveryDate > functionDate > orderDate', () => {
    // 1. When dispatchDate is provided
    expect(getOrderDispatchDate({
      dispatchDate: '2026-10-25',
      deliveryDate: '2026-10-20',
      functionDate: '2026-10-19',
      orderDate: '2026-10-18'
    })).toBe('2026-10-25');

    // 2. Fallback to deliveryDate
    expect(getOrderDispatchDate({
      deliveryDate: '2026-10-20',
      functionDate: '2026-10-19',
      orderDate: '2026-10-18'
    })).toBe('2026-10-20');

    // 3. Fallback to functionDate
    expect(getOrderDispatchDate({
      functionDate: '2026-10-19',
      orderDate: '2026-10-18'
    })).toBe('2026-10-19');

    // 4. Fallback to orderDate
    expect(getOrderDispatchDate({
      orderDate: '2026-10-18'
    })).toBe('2026-10-18');
  });

  // -------------------------------------------------------------------------
  // Test Case 17: Current Dispatch Date Order Deducts Inventory Immediately
  // -------------------------------------------------------------------------
  it('Test Case 17: Order with current dispatch date (<= today) deducts inventory count immediately', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
    ];

    const currentOrder = {
      id: 301,
      fireId: 'order-301',
      name: 'Ramesh',
      chocolate: '10 rs dairy milk',
      count: '150',
      orderDate: '2026-10-18',
      dispatchDate: '2026-10-18', // Today's dispatch date
      deliveryDate: '2026-10-18',
      stockDeductionStatus: 'Deducted',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [currentOrder],
      [],
      'Inventory 1',
      todayStr
    );

    // Initial stock 1000 - 150 = 850 available stock
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(850);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(150);
    expect(summary.chocolates['10 rs dairy milk'].todayProcessed).toBe(150);
    expect(summary.chocolates['10 rs dairy milk'].futureScheduled).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test Case 18: Future Dispatch Date Order Does NOT Deduct Inventory
  // -------------------------------------------------------------------------
  it('Test Case 18: Order with future dispatch date (even in next year) does NOT deduct inventory', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
    ];

    const nextYearFutureOrder = {
      id: 302,
      fireId: 'order-302',
      name: 'Suresh',
      chocolate: '10 rs dairy milk',
      count: '300',
      orderDate: '2026-10-18',
      dispatchDate: '2027-01-15', // Future dispatch date next year
      deliveryDate: '15 Jan 2027',
      stockDeductionStatus: 'Pending',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const isFuture = isOrderFuture(nextYearFutureOrder, todayStr);
    expect(isFuture).toBe(true);

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [nextYearFutureOrder],
      [],
      'Inventory 1',
      todayStr
    );

    // 1000 stock remains intact; futureScheduled is 300
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(1000);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(0);
    expect(summary.chocolates['10 rs dairy milk'].futureScheduled).toBe(300);
  });

  // -------------------------------------------------------------------------
  // Test Case 19: Multi-Chocolate Current Dispatch Date Deducts All Items
  // -------------------------------------------------------------------------
  it('Test Case 19: Multi-chocolate order on current dispatch date deducts all items accurately', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
      {
        date: '2026-10-10',
        chocolate: '5 rs 5 star',
        boxCount: 5,
        itemsPerBox: 100,
        totalChocolates: 500,
        inventory: 'Inventory 1',
      },
    ];

    const multiOrder = {
      id: 303,
      fireId: 'order-303',
      name: 'Priya',
      chocolate: '10 rs dairy milk, 5 rs 5 star',
      count: '200, 100',
      orderDate: '2026-10-18',
      dispatchDate: '2026-10-18',
      deliveryDate: '2026-10-18',
      stockDeductionStatus: 'Deducted',
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [multiOrder],
      [],
      'Inventory 1',
      todayStr
    );

    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(800);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(200);

    expect(summary.chocolates['5 rs 5 star'].availableStock).toBe(400);
    expect(summary.chocolates['5 rs 5 star'].totalDeducted).toBe(100);
  });

  // -------------------------------------------------------------------------
  // Test Case 20: Existing / Previous Data Without stockDeductionStatus Deducts
  // -------------------------------------------------------------------------
  it('Test Case 20: Existing / previous orders without stockDeductionStatus follow dispatch date deduction logic', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 20,
        itemsPerBox: 100,
        totalChocolates: 2000,
        inventory: 'Inventory 1',
      },
    ];

    // Previous orders created in earlier versions (NO stockDeductionStatus field)
    const legacyOrders = [
      // 1. Past order: 100 chocolates, dispatch date 2026-10-15 (<= today) -> MUST DEDUCT
      {
        id: 1,
        fireId: 'legacy-1',
        chocolate: '10 rs dairy milk',
        count: '100',
        deliveryDate: '2026-10-15',
        status: 'In Process',
        inventory: 'Inventory 1',
      },
      // 2. Today's order: 200 chocolates, dispatch date 2026-10-18 (<= today) -> MUST DEDUCT
      {
        id: 2,
        fireId: 'legacy-2',
        chocolate: '10 rs dairy milk',
        count: '200',
        deliveryDate: '2026-10-18',
        status: 'In Process',
        inventory: 'Inventory 1',
      },
      // 3. Future order: 300 chocolates, dispatch date 2026-10-25 (> today) -> MUST NOT DEDUCT
      {
        id: 3,
        fireId: 'legacy-3',
        chocolate: '10 rs dairy milk',
        count: '300',
        deliveryDate: '2026-10-25',
        status: 'In Process',
        inventory: 'Inventory 1',
      },
    ];

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      legacyOrders,
      [],
      'Inventory 1',
      todayStr
    );

    // Initial stock 2000 - 100 (past) - 200 (today) = 1700 available stock
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(1700);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(300);
    expect(summary.chocolates['10 rs dairy milk'].todayProcessed).toBe(200);
    // Future order remains undeducted in futureScheduled
    expect(summary.chocolates['10 rs dairy milk'].futureScheduled).toBe(300);
  });

  // -------------------------------------------------------------------------
  // Test Case 21: Flexible Date Formats (DD/MM, DD-MM-YYYY, 2-digit years)
  // -------------------------------------------------------------------------
  it('Test Case 21: Accurately parses and normalizes diverse date formats including DD/MM', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
    ];

    const orderWithDm = {
      id: 401,
      chocolate: '10 rs dairy milk',
      count: '120',
      deliveryDate: '18/10', // DD/MM format like user mobile UI screenshot
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [orderWithDm],
      [],
      'Inventory 1',
      todayStr
    );

    // Initial stock 1000 - 120 = 880
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(880);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(120);
  });

  // -------------------------------------------------------------------------
  // Test Case 22: Order Without Order Date (Removed From Modal)
  // -------------------------------------------------------------------------
  it('Test Case 22: Order created without orderDate deducts correctly based on dispatch/function date', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-10',
        chocolate: '10 rs dairy milk',
        boxCount: 10,
        itemsPerBox: 100,
        totalChocolates: 1000,
        inventory: 'Inventory 1',
      },
    ];

    // Order created after removing orderDate from UI form
    const orderWithoutOrderDate = {
      id: 501,
      name: 'Selva',
      chocolate: '10 rs dairy milk',
      count: '180',
      functionDate: '2026-10-18',
      deliveryDate: '2026-10-18', // Dispatch Date
      status: 'In Process',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [orderWithoutOrderDate],
      [],
      'Inventory 1',
      todayStr
    );

    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(820);
    expect(summary.chocolates['10 rs dairy milk'].totalDeducted).toBe(180);
  });
});

describe('Inventory Management System – Stock Calculation & Date Filter Enhancements', () => {
  const dynamicInventory = [
    '1 rs chocolate',
    '10 rs dairy milk',
    '10 rs kitkat',
    '10 rs 5 star',
    '5 rs 5 star',
  ];
  const testPricesMap = {
    '5 rs 5 star': { retail: 15, wholesale: 15 },
    '10 rs 5 star': { retail: 22, wholesale: 9 },
    '10 rs kitkat': { retail: 20, wholesale: 20 },
    'kitkat': { retail: 20, wholesale: 18 },
    '5 star': { retail: 15, wholesale: 13 },
  };

  const todayDate = '2026-10-21';

  // -------------------------------------------------------------------------
  // Test Case 1: Negative Stock
  // Opening Stock: 20, Dispatched: 200, Expected Stock Balance: -180
  // -------------------------------------------------------------------------
  it('Test Case 1: Negative Stock - Opening 20, Dispatched 200 => Stock Balance -180', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-20',
        chocolate: '5 rs 5 star',
        boxCount: 1,
        itemsPerBox: 20,
        totalChocolates: 20, // Opening Stock: 20
        inventory: 'Inventory 1',
      },
    ];

    const dispatchOrder = {
      id: 101,
      chocolate: '5 rs 5 star',
      count: '200', // Today's Dispatch: 200
      dispatchDate: todayDate,
      status: 'Delivered',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(dynamicInventory, logs, [dispatchOrder], [], 'Inventory 1', todayDate);
    // Formula: Closing Stock = Opening Stock + Stock Received - Total Stock Dispatched = 20 + 0 - 200 = -180
    expect(summary.chocolates['5 rs 5 star'].totalReceived).toBe(20);
    expect(summary.chocolates['5 rs 5 star'].totalDeducted).toBe(200);
    expect(summary.chocolates['5 rs 5 star'].availableStock).toBe(-180);
    expect(summary.chocolates['5 rs 5 star'].remainingStock).toBe(-180);

    // Verify subsequent stock receipt updates balance accurately: -180 + 50 = -130
    const subsequentLogs: InventoryLogItem[] = [
      ...logs,
      {
        date: todayDate,
        chocolate: '5 rs 5 star',
        boxCount: 1,
        itemsPerBox: 50,
        totalChocolates: 50, // Receipt: 50
        inventory: 'Inventory 1',
      },
    ];
    const summaryAfterReceipt = calculateDateWiseInventory(dynamicInventory, subsequentLogs, [dispatchOrder], [], 'Inventory 1', todayDate);
    expect(summaryAfterReceipt.chocolates['5 rs 5 star'].availableStock).toBe(-130);

    // Verify further receipt brings it back positive: -130 + 150 = 20
    const finalLogs: InventoryLogItem[] = [
      ...subsequentLogs,
      {
        date: todayDate,
        chocolate: '5 rs 5 star',
        boxCount: 1,
        itemsPerBox: 150,
        totalChocolates: 150,
        inventory: 'Inventory 1',
      },
    ];
    const summaryFinal = calculateDateWiseInventory(dynamicInventory, finalLogs, [dispatchOrder], [], 'Inventory 1', todayDate);
    expect(summaryFinal.chocolates['5 rs 5 star'].availableStock).toBe(20);
  });

  // -------------------------------------------------------------------------
  // Test Case 2: Normal Stock
  // Opening Stock: 500, Dispatched: 200, Expected Stock Balance: 300
  // -------------------------------------------------------------------------
  it('Test Case 2: Normal Stock - Opening 500, Dispatched 200 => Stock Balance 300', () => {
    const logs: InventoryLogItem[] = [
      {
        date: '2026-10-20',
        chocolate: '10 rs kitkat',
        boxCount: 5,
        itemsPerBox: 100,
        totalChocolates: 500, // Opening Stock: 500
        inventory: 'Inventory 1',
      },
    ];

    const dispatchOrder = {
      id: 102,
      chocolate: '10 rs kitkat',
      count: '200',
      dispatchDate: todayDate,
      status: 'Delivered',
      inventory: 'Inventory 1',
    };

    const summary = calculateDateWiseInventory(dynamicInventory, logs, [dispatchOrder], [], 'Inventory 1', todayDate);
    expect(summary.chocolates['10 rs kitkat'].totalReceived).toBe(500);
    expect(summary.chocolates['10 rs kitkat'].totalDeducted).toBe(200);
    expect(summary.chocolates['10 rs kitkat'].availableStock).toBe(300);
  });

  // -------------------------------------------------------------------------
  // Test Case 3: Today's Dispatch Filter
  // Create multiple dispatch transactions on the current date
  // Expected Result: displays only the current date's dispatch records and their correct quantities
  // -------------------------------------------------------------------------
  it('Test Case 3: Today\'s Dispatch Filter displays only current date records with accurate quantities', () => {
    const transactions: InventoryTransaction[] = [
      {
        transactionId: 'txn_1',
        orderId: 201,
        orderSerial: 'SR0201',
        productName: '5 rs 5 star',
        chocolate: '5 rs 5 star',
        orderQuantity: 60,
        quantityDeducted: 60,
        dispatchDate: todayDate,
        actualDispatchTimestamp: '2026-10-21T10:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 100,
        updatedStockBalance: 40,
        inventory: 'Inventory 1',
        createdAt: '2026-10-21T10:00:00Z',
      },
      {
        transactionId: 'txn_2',
        orderId: 202,
        orderSerial: 'SR0202',
        productName: '10 rs kitkat',
        chocolate: '10 rs kitkat',
        orderQuantity: 50,
        quantityDeducted: 50,
        dispatchDate: todayDate,
        actualDispatchTimestamp: '2026-10-21T11:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 200,
        updatedStockBalance: 150,
        inventory: 'Inventory 1',
        createdAt: '2026-10-21T11:00:00Z',
      },
      // Historical transaction on past date - must NOT appear in Today's filter
      {
        transactionId: 'txn_past',
        orderId: 199,
        orderSerial: 'SR0199',
        productName: '5 rs 5 star',
        chocolate: '5 rs 5 star',
        orderQuantity: 100,
        quantityDeducted: 100,
        dispatchDate: '2026-10-19',
        actualDispatchTimestamp: '2026-10-19T10:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 300,
        updatedStockBalance: 200,
        inventory: 'Inventory 1',
        createdAt: '2026-10-19T10:00:00Z',
      },
    ];

    const todayFilter = getDateWiseDispatchDetails(todayDate, dynamicInventory, transactions, [], testPricesMap, 'Inventory 1', todayDate);
    expect(todayFilter.isToday).toBe(true);
    expect(todayFilter.totalDispatchedQuantity).toBe(110); // 60 + 50
    expect(todayFilter.items.length).toBe(2);

    const fiveStar = todayFilter.items.find(i => i.productName === '5 Star' && i.unitPrice === 5);
    expect(fiveStar).toBeDefined();
    expect(fiveStar!.dispatchedQuantity).toBe(60);
    expect(fiveStar!.unitPriceDisplay).toBe('₹5');

    const kitkat = todayFilter.items.find(i => i.productName === 'Kitkat');
    expect(kitkat).toBeDefined();
    expect(kitkat!.dispatchedQuantity).toBe(50);
  });

  // -------------------------------------------------------------------------
  // Test Case 4: Historical Date Filter
  // Select a previous date from the calendar
  // Expected Result: Only the dispatch transactions for the selected date are displayed
  // -------------------------------------------------------------------------
  it('Test Case 4: Historical Date Filter displays only transactions for selected historical date', () => {
    const historicalDate = '2026-10-19';
    const transactions: InventoryTransaction[] = [
      {
        transactionId: 'txn_hist',
        orderId: 180,
        orderSerial: 'SR0180',
        productName: '10 rs 5 star',
        chocolate: '10 rs 5 star',
        orderQuantity: 30,
        quantityDeducted: 30,
        dispatchDate: historicalDate,
        actualDispatchTimestamp: '2026-10-19T09:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 100,
        updatedStockBalance: 70,
        inventory: 'Inventory 1',
        createdAt: '2026-10-19T09:00:00Z',
      },
      {
        transactionId: 'txn_today',
        orderId: 201,
        orderSerial: 'SR0201',
        productName: '5 rs 5 star',
        chocolate: '5 rs 5 star',
        orderQuantity: 60,
        quantityDeducted: 60,
        dispatchDate: todayDate,
        actualDispatchTimestamp: '2026-10-21T10:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 100,
        updatedStockBalance: 40,
        inventory: 'Inventory 1',
        createdAt: '2026-10-21T10:00:00Z',
      },
    ];

    const histFilter = getDateWiseDispatchDetails(historicalDate, dynamicInventory, transactions, [], testPricesMap, 'Inventory 1', todayDate);
    expect(histFilter.isToday).toBe(false);
    expect(histFilter.date).toBe(historicalDate);
    expect(histFilter.totalDispatchedQuantity).toBe(30);
    expect(histFilter.items.length).toBe(1);
    expect(histFilter.items[0].productName).toBe('5 Star');
    expect(histFilter.items[0].unitPriceDisplay).toBe('₹10');
    expect(histFilter.items[0].dispatchedQuantity).toBe(30);
  });

  // -------------------------------------------------------------------------
  // Test Case 5: Multiple Transactions
  // Dispatch the same product multiple times on the same day
  // Expected Result: Accurately aggregates the quantities without double-counting
  // -------------------------------------------------------------------------
  it('Test Case 5: Multiple Transactions - aggregates multiple dispatches of same product on same day accurately', () => {
    const transactions: InventoryTransaction[] = [
      {
        transactionId: 'txn_a',
        orderId: 301,
        orderSerial: 'SR0301',
        productName: '5 rs 5 star',
        chocolate: '5 rs 5 star',
        orderQuantity: 40,
        quantityDeducted: 40,
        dispatchDate: todayDate,
        actualDispatchTimestamp: '2026-10-21T09:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 200,
        updatedStockBalance: 160,
        inventory: 'Inventory 1',
        createdAt: '2026-10-21T09:00:00Z',
      },
      {
        transactionId: 'txn_b',
        orderId: 302,
        orderSerial: 'SR0302',
        productName: '5 rs 5 star',
        chocolate: '5 rs 5 star',
        orderQuantity: 60,
        quantityDeducted: 60,
        dispatchDate: todayDate,
        actualDispatchTimestamp: '2026-10-21T11:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 160,
        updatedStockBalance: 100,
        inventory: 'Inventory 1',
        createdAt: '2026-10-21T11:00:00Z',
      },
    ];

    const filterResult = getDateWiseDispatchDetails(todayDate, dynamicInventory, transactions, [], testPricesMap, 'Inventory 1', todayDate);
    expect(filterResult.items.length).toBe(1);
    expect(filterResult.items[0].productName).toBe('5 Star');
    expect(filterResult.items[0].unitPriceDisplay).toBe('₹5');
    // 40 + 60 = 100 total dispatched quantity for this product
    expect(filterResult.items[0].dispatchedQuantity).toBe(100);
    expect(filterResult.items[0].transactionCount).toBe(2);
    expect(filterResult.items[0].orderIds).toEqual(['SR0301', 'SR0302']);
  });

  // -------------------------------------------------------------------------
  // Test Case 6: No Dispatch Records
  // Select a date on which no dispatch transactions exist
  // Expected Result: Display an appropriate empty-state message without breaking
  // -------------------------------------------------------------------------
  it('Test Case 6: No Dispatch Records - empty-state returns 0 items and empty array', () => {
    const emptyDate = '2026-10-01';
    const filterResult = getDateWiseDispatchDetails(emptyDate, dynamicInventory, [], [], testPricesMap, 'Inventory 1', todayDate);
    expect(filterResult.items.length).toBe(0);
    expect(filterResult.totalDispatchedQuantity).toBe(0);
    expect(filterResult.totalProductsCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test Case 7: Filter Switching
  // Switch between Today, a historical calendar date, and the default view
  // Expected Result: Each view displays the correct data without retaining stale filter results
  // -------------------------------------------------------------------------
  it('Test Case 7: Filter Switching - returns distinct data for today vs historical date', () => {
    const transactions: InventoryTransaction[] = [
      {
        transactionId: 'txn_today',
        orderId: 401,
        productName: '5 rs 5 star',
        chocolate: '5 rs 5 star',
        orderQuantity: 88,
        quantityDeducted: 88,
        dispatchDate: todayDate,
        actualDispatchTimestamp: '2026-10-21T10:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 100,
        updatedStockBalance: 12,
        inventory: 'Inventory 1',
        createdAt: '2026-10-21T10:00:00Z',
      },
      {
        transactionId: 'txn_oct20',
        orderId: 402,
        productName: '10 rs kitkat',
        chocolate: '10 rs kitkat',
        orderQuantity: 44,
        quantityDeducted: 44,
        dispatchDate: '2026-10-20',
        actualDispatchTimestamp: '2026-10-20T10:00:00Z',
        dispatchStatus: 'Delivered',
        stockDeductionStatus: 'Deducted',
        transactionType: 'Dispatch Deduction',
        previousStockBalance: 100,
        updatedStockBalance: 56,
        inventory: 'Inventory 1',
        createdAt: '2026-10-20T10:00:00Z',
      },
    ];

    // Today view
    const todayView = getDateWiseDispatchDetails(todayDate, dynamicInventory, transactions, [], testPricesMap, 'Inventory 1', todayDate);
    expect(todayView.totalDispatchedQuantity).toBe(88);
    expect(todayView.items[0].productName).toBe('5 Star');

    // Historical date view
    const oct20View = getDateWiseDispatchDetails('2026-10-20', dynamicInventory, transactions, [], testPricesMap, 'Inventory 1', todayDate);
    expect(oct20View.totalDispatchedQuantity).toBe(44);
    expect(oct20View.items[0].productName).toBe('Kitkat');

    // Dates remain distinct without stale cross-contamination
    expect(todayView.totalDispatchedQuantity).not.toBe(oct20View.totalDispatchedQuantity);
  });

  // -------------------------------------------------------------------------
  // Product Parsing Test: Matches prompt illustration exactly
  // Product Name: 5 Star, Unit Price: ₹5, Dispatched: 100
  // Product Name: KitKat, Unit Price: ₹20, Dispatched: 50
  // Product Name: 5 Star, Unit Price: ₹10, Dispatched: 30
  // -------------------------------------------------------------------------
  it('Product details parsing matches illustrative example format accurately', () => {
    const item1 = parseChocolateProductDetails('5 rs 5 star', testPricesMap);
    expect(item1.cleanName).toBe('5 Star');
    expect(item1.unitPriceDisplay).toBe('₹5');
    expect(item1.unitPrice).toBe(5);

    const item2 = parseChocolateProductDetails('KitKat', testPricesMap);
    expect(item2.cleanName).toBe('Kitkat');
    expect(item2.unitPriceDisplay).toBe('₹20');
    expect(item2.unitPrice).toBe(20);

    const item3 = parseChocolateProductDetails('10 rs 5 star', testPricesMap);
    expect(item3.cleanName).toBe('5 Star');
    expect(item3.unitPriceDisplay).toBe('₹10');
    expect(item3.unitPrice).toBe(10);
  });
});


