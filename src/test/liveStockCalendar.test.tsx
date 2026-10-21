import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  getDateWiseDispatchDetails,
  getTodayKolkata,
  parseDateToStandard,
  InventoryTransaction
} from '@/lib/inventoryManager';

// Timezone safe local date helpers matching Dashboard.tsx
const parseStandardToLocalDate = (dateStr: string): Date | undefined => {
  if (!dateStr) return undefined;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? undefined : fallback;
};

const formatLocalDateToStandard = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Component mimicking the Live Stock Inventory date filter header
function MockLiveStockHeader({
  initialFilter = null as 'today' | 'custom' | null,
  initialDate = '2026-10-21',
  transactions = [] as InventoryTransaction[]
}) {
  const [dispatchDateFilter, setDispatchDateFilter] = useState<'today' | 'custom' | null>(initialFilter);
  const [selectedDispatchDate, setSelectedDispatchDate] = useState<string>(initialDate);
  const [isLiveStockCalendarOpen, setIsLiveStockCalendarOpen] = useState(false);

  const todayKolkataDate = '2026-10-21';
  const target = dispatchDateFilter === 'today' ? todayKolkataDate : selectedDispatchDate;

  const liveStockDispatchSummary = dispatchDateFilter
    ? getDateWiseDispatchDetails(
        target,
        ['10 rs dairy milk', '5 rs 5 star'],
        transactions,
        [],
        { '10 rs dairy milk': { retail: 20, wholesale: 18 } },
        'Inventory 1',
        todayKolkataDate
      )
    : null;

  return (
    <div>
      <h2 id="live-stock-heading">Live Stock Balance Inventory (Inventory 1)</h2>
      
      {/* Today Button */}
      <button
        id="live-stock-today-btn"
        type="button"
        onClick={() => {
          if (dispatchDateFilter === 'today') {
            setDispatchDateFilter(null);
          } else {
            setSelectedDispatchDate(todayKolkataDate);
            setDispatchDateFilter('today');
          }
        }}
      >
        Today
      </button>

      {/* Calendar Button with Popover */}
      <Popover open={isLiveStockCalendarOpen} onOpenChange={setIsLiveStockCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            id="live-stock-calendar-btn"
            type="button"
            className="calendar-btn"
          >
            <span>
              {dispatchDateFilter === 'custom'
                ? `📅 ${liveStockDispatchSummary?.displayDate || selectedDispatchDate}`
                : '📅 Calendar'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="sabi-calendar-popover" align="start">
          <div data-testid="calendar-header-title">Filter Dispatches</div>
          <CalendarComponent
            mode="single"
            captionLayout="dropdown-buttons"
            fromYear={2022}
            toYear={2035}
            selected={parseStandardToLocalDate(selectedDispatchDate)}
            onSelect={(date) => {
              if (date) {
                const formatted = formatLocalDateToStandard(date);
                setSelectedDispatchDate(formatted);
                setDispatchDateFilter('custom');
                setIsLiveStockCalendarOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Clear / Default View Button */}
      {dispatchDateFilter && (
        <button
          id="live-stock-clear-filter-btn"
          type="button"
          onClick={() => setDispatchDateFilter(null)}
        >
          Default View
        </button>
      )}

      {/* Dispatch Details Section */}
      {dispatchDateFilter && (
        <div data-testid="dispatch-details-section">
          <h3>
            {dispatchDateFilter === 'today'
              ? "Today's Dispatch Details"
              : `Dispatch Details (${liveStockDispatchSummary?.displayDate})`}
          </h3>
          {liveStockDispatchSummary && liveStockDispatchSummary.items.length === 0 ? (
            <p data-testid="no-records-msg">
              {dispatchDateFilter === 'today'
                ? "No dispatch records found for today."
                : `No dispatch records found for the selected date (${liveStockDispatchSummary.displayDate || selectedDispatchDate}).`}
            </p>
          ) : (
            <div data-testid="records-table">
              {liveStockDispatchSummary?.items.map((it, idx) => (
                <div key={idx} data-testid="dispatch-item">
                  <span>{it.productName}</span>: <span>{it.dispatchedQuantity} units</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

describe('Live Stock Balance Inventory Calendar & Date Filter', () => {
  const sampleTransactions: InventoryTransaction[] = [
    {
      id: 'txn-1',
      transactionId: 'txn-1',
      dispatchDate: '2026-10-21',
      orderId: '1001',
      orderSerial: 'SR1001',
      chocolate: '10 rs dairy milk',
      productName: '10 rs dairy milk',
      quantityDeducted: 15,
      transactionType: 'Dispatch Deduction',
      stockDeductionStatus: 'Deducted',
      inventory: 'Inventory 1',
      createdAt: '2026-10-21T10:00:00.000Z'
    },
    {
      id: 'txn-2',
      transactionId: 'txn-2',
      dispatchDate: '2026-10-20',
      orderId: '1002',
      orderSerial: 'SR1002',
      chocolate: '10 rs dairy milk',
      productName: '10 rs dairy milk',
      quantityDeducted: 25,
      transactionType: 'Dispatch Deduction',
      stockDeductionStatus: 'Deducted',
      inventory: 'Inventory 1',
      createdAt: '2026-10-20T10:00:00.000Z'
    }
  ];

  it('renders Live Stock Balance Inventory heading and buttons', () => {
    render(<MockLiveStockHeader transactions={sampleTransactions} />);
    expect(screen.getByText(/Live Stock Balance Inventory/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /📅 Calendar/i })).toBeInTheDocument();
  });

  it('clicking Calendar button immediately opens the date picker popover', () => {
    render(<MockLiveStockHeader transactions={sampleTransactions} />);
    const calendarBtn = screen.getByRole('button', { name: /📅 Calendar/i });
    
    // Popover is initially closed
    expect(screen.queryByTestId('calendar-header-title')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(calendarBtn);

    // Popover is now visible
    expect(screen.getByTestId('calendar-header-title')).toBeInTheDocument();
    expect(screen.getByText('Filter Dispatches')).toBeInTheDocument();
  });

  it('allows selecting a date, closes the calendar, updates the button label and shows only that date records', async () => {
    render(<MockLiveStockHeader transactions={sampleTransactions} />);
    const calendarBtn = screen.getByRole('button', { name: /📅 Calendar/i });
    fireEvent.click(calendarBtn);

    // Find day cell for 20th October (txn-2 date)
    const day20 = screen.getByRole('gridcell', { name: '20' });
    expect(day20).toBeInTheDocument();
    
    // Click the 20th
    fireEvent.click(day20);

    // Calendar popover closes
    await waitFor(() => {
      expect(screen.queryByTestId('calendar-header-title')).not.toBeInTheDocument();
    });

    // Button label updates with the selected date (e.g. 20 Oct 2026)
    expect(screen.getByRole('button', { name: /20 Oct 2026|2026-10-20/i })).toBeInTheDocument();

    // Only 20th October dispatch records are displayed (25 units)
    expect(screen.getByTestId('dispatch-details-section')).toBeInTheDocument();
    expect(screen.getByText(/25 units/i)).toBeInTheDocument();
    expect(screen.queryByText(/15 units/i)).not.toBeInTheDocument();
  });

  it('displays "No dispatch records found for the selected date" when a date with no records is chosen', async () => {
    render(<MockLiveStockHeader transactions={sampleTransactions} />);
    const calendarBtn = screen.getByRole('button', { name: /📅 Calendar/i });
    fireEvent.click(calendarBtn);

    // Select day 15 (which has no transactions)
    const day15 = screen.getByRole('gridcell', { name: '15' });
    expect(day15).toBeInTheDocument();
    fireEvent.click(day15);

    await waitFor(() => {
      expect(screen.queryByTestId('calendar-header-title')).not.toBeInTheDocument();
    });

    // Should display the required empty state message
    const emptyMsg = screen.getByTestId('no-records-msg');
    expect(emptyMsg.textContent).toMatch(/No dispatch records found for the selected date/i);
  });

  it('clicking Today button switches to today dispatch records correctly', () => {
    render(<MockLiveStockHeader transactions={sampleTransactions} />);
    const todayBtn = screen.getByRole('button', { name: /today/i });
    fireEvent.click(todayBtn);

    // Today's dispatches (15 units) are shown
    expect(screen.getByText("Today's Dispatch Details")).toBeInTheDocument();
    expect(screen.getByText(/15 units/i)).toBeInTheDocument();
    expect(screen.queryByText(/25 units/i)).not.toBeInTheDocument();
  });

  it('switching between Today and Calendar date works back and forth', async () => {
    render(<MockLiveStockHeader transactions={sampleTransactions} />);
    
    // 1. Click Today
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    expect(screen.getByText(/15 units/i)).toBeInTheDocument();

    // 2. Click Calendar and choose 20th
    fireEvent.click(screen.getByRole('button', { name: /📅 Calendar/i }));
    const day20 = screen.getByRole('gridcell', { name: '20' });
    expect(day20).toBeInTheDocument();
    fireEvent.click(day20);

    await waitFor(() => {
      expect(screen.getByText(/25 units/i)).toBeInTheDocument();
    });

    // 3. Click Today again
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    expect(screen.getByText(/15 units/i)).toBeInTheDocument();
    expect(screen.queryByText(/25 units/i)).not.toBeInTheDocument();

    // 4. Click Default View to reset
    const clearBtn = screen.getByRole('button', { name: /default view/i });
    fireEvent.click(clearBtn);
    expect(screen.queryByTestId('dispatch-details-section')).not.toBeInTheDocument();
  });

  it('timezone date parsing accurately preserves year, month, and day without UTC offset drift', () => {
    const inputDateStr = '2026-10-21';
    const localDate = parseStandardToLocalDate(inputDateStr);
    expect(localDate).toBeDefined();
    expect(localDate?.getFullYear()).toBe(2026);
    expect(localDate?.getMonth()).toBe(9); // 0-indexed October
    expect(localDate?.getDate()).toBe(21);

    const formattedBack = formatLocalDateToStandard(localDate!);
    expect(formattedBack).toBe('2026-10-21');
  });

  it('navigates between months and years using dropdowns and selects date in different month/year', async () => {
    render(<MockLiveStockHeader transactions={sampleTransactions} />);
    const calendarBtn = screen.getByRole('button', { name: /📅 Calendar/i });
    fireEvent.click(calendarBtn);

    // Find Month select
    const monthSelect = screen.getByRole('combobox', { name: /month/i });
    expect(monthSelect).toBeInTheDocument();
    
    // Find Year select
    const yearSelect = screen.getByRole('combobox', { name: /year/i });
    expect(yearSelect).toBeInTheDocument();

    // Change year to 2025
    fireEvent.change(yearSelect, { target: { value: '2025' } });
    expect(yearSelect).toHaveValue('2025');

    // Change month to November (value 10)
    fireEvent.change(monthSelect, { target: { value: '10' } });
    expect(monthSelect).toHaveValue('10');

    // Select day 12 in November 2025
    const day12 = screen.getByRole('gridcell', { name: '12' });
    expect(day12).toBeInTheDocument();
    fireEvent.click(day12);

    await waitFor(() => {
      expect(screen.queryByTestId('calendar-header-title')).not.toBeInTheDocument();
    });

    // Calendar closed, date updated to November 2025
    expect(screen.getByRole('button', { name: /12 Nov 2025|2025-11-12/i })).toBeInTheDocument();
  });
});
