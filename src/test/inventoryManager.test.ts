import { describe, it, expect } from 'vitest';
import {
  calculateDateWiseInventory,
  prepareDispatchDeduction,
  validateDispatchStock,
  getOrderDispatchDate,
  isDateFuture,
  isDateToday,
  isDatePast,
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

    // Before processing dispatch
    const beforeSummary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [todayOrder],
      [],
      'Inventory 1',
      todayStr
    );

    expect(beforeSummary.chocolates['10 rs dairy milk'].availableStock).toBe(5000);
    expect(beforeSummary.chocolates['10 rs dairy milk'].todayScheduled).toBe(200);

    // Process dispatch
    const prepResult = prepareDispatchDeduction(todayOrder, beforeSummary, [], dynamicInventory, todayStr);
    expect(prepResult.success).toBe(true);
    expect(prepResult.transactions?.length).toBe(1);

    const transactions: InventoryTransaction[] = prepResult.transactions || [];

    // After processing dispatch
    const afterSummary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      [todayOrder],
      transactions,
      'Inventory 1',
      todayStr
    );

    expect(afterSummary.chocolates['10 rs dairy milk'].availableStock).toBe(4800);
    expect(afterSummary.chocolates['10 rs dairy milk'].todayProcessed).toBe(200);
    expect(afterSummary.chocolates['10 rs dairy milk'].todayScheduled).toBe(0);
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

    expect(initialSummary.chocolates['10 rs dairy milk'].availableStock).toBe(5000);
    expect(initialSummary.chocolates['10 rs dairy milk'].todayScheduled).toBe(200);
    expect(initialSummary.chocolates['10 rs dairy milk'].futureScheduled).toBe(1300); // 300 + 1000

    // Process only the Oct 18 dispatch
    const oct18Deduction = prepareDispatchDeduction(
      orders[0],
      initialSummary,
      [],
      dynamicInventory,
      todayStr
    );
    expect(oct18Deduction.success).toBe(true);

    const updatedSummary = calculateDateWiseInventory(
      dynamicInventory,
      logs,
      orders,
      oct18Deduction.transactions,
      'Inventory 1',
      todayStr
    );

    // EXACT Expected Result: availableStock is 4,800
    expect(updatedSummary.chocolates['10 rs dairy milk'].availableStock).toBe(4800);
    expect(updatedSummary.chocolates['10 rs dairy milk'].todayProcessed).toBe(200);
    expect(updatedSummary.chocolates['10 rs dairy milk'].todayScheduled).toBe(0);
    // Future orders remain completely undeducted!
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
  // Test Case 7: Insufficient Stock
  // Initial stock: 100. Eligible dispatch quantity: 150.
  // Expected result: reject or block the deduction, show error, do not create negative stock balance.
  // -------------------------------------------------------------------------
  it('Test Case 7: Insufficient Stock must block deduction and prevent negative balance', () => {
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

    const summary = calculateDateWiseInventory(dynamicInventory, logs, [largeOrder], [], 'Inventory 1', todayStr);
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(100);

    // Validation must fail
    const validation = validateDispatchStock(largeOrder, summary, dynamicInventory);
    expect(validation.valid).toBe(false);
    expect(validation.insufficientItems.length).toBe(1);
    expect(validation.insufficientItems[0].available).toBe(100);
    expect(validation.insufficientItems[0].required).toBe(150);

    // Deduction must be blocked
    const result = prepareDispatchDeduction(largeOrder, summary, [], dynamicInventory, todayStr);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient stock');

    // Stock must not be negative
    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(100);
  });

  // -------------------------------------------------------------------------
  // Test Case 8: Overdue Dispatch
  // An order has a Dispatch Date in the past but has not been processed.
  // Expected result: flag it as overdue or pending and process it only according to established workflow.
  // -------------------------------------------------------------------------
  it('Test Case 8: Overdue Dispatch must be flagged as pending/overdue and not silently discarded', () => {
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

    expect(summary.chocolates['10 rs dairy milk'].availableStock).toBe(1000);
    expect(summary.chocolates['10 rs dairy milk'].overduePending).toBe(50);

    // Can be dispatched on demand when user processes it
    const dispatchResult = prepareDispatchDeduction(overdueOrder, summary, [], dynamicInventory, todayStr);
    expect(dispatchResult.success).toBe(true);
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
    expect(summary.totalStockDeducted).toBe(200); // Only delivered order
    expect(summary.totalAvailableStock).toBe(4800); // 5000 - 200
    expect(summary.todayProcessedQuantity).toBe(200);
    expect(summary.todayScheduledQuantity).toBe(150);
    expect(summary.futureScheduledQuantity).toBe(300);
    expect(summary.pendingDispatchQuantity).toBe(450); // 150 + 300
    expect(summary.remainingStock).toBe(4800);
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
});
