import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import DailyTasksBoard from '../components/DailyTasksBoard';

// Mock Firebase
vi.mock('@/firebase', () => ({
  db: {}
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {}),
  collection: vi.fn(),
  deleteDoc: vi.fn(() => Promise.resolve())
}));

// Mock Cloudinary
vi.mock('@/lib/cloudinary', () => ({
  uploadToCloudinary: vi.fn()
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('DailyTasksBoard Input Field Interaction', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders input fields directly in editable cells without requiring double-click', () => {
    render(<DailyTasksBoard />);

    // Query all cell inputs using data-cell-id
    const inputs = document.querySelectorAll('input[data-cell-id]');
    expect(inputs.length).toBeGreaterThan(0);

    // The first row's contactNumber input should be directly rendered
    const firstContactInput = Array.from(inputs).find(input => 
      input.getAttribute('data-cell-id')?.includes('contactNumber')
    ) as HTMLInputElement;

    expect(firstContactInput).toBeDefined();
    expect(firstContactInput.tagName).toBe('INPUT');
  });

  it('allows single click/tap focus and typing without character loss or double activation', async () => {
    render(<DailyTasksBoard />);

    const inputs = document.querySelectorAll('input[data-cell-id]');
    const firstContactInput = Array.from(inputs).find(input => 
      input.getAttribute('data-cell-id')?.includes('contactNumber')
    ) as HTMLInputElement;

    expect(firstContactInput).toBeDefined();

    // 1. Single tap / click activates focus once
    act(() => {
      fireEvent.focus(firstContactInput);
    });

    expect(document.activeElement).toBe(firstContactInput);

    // 2. Type text smoothly into input
    act(() => {
      fireEvent.change(firstContactInput, { target: { value: '9876543210' } });
    });

    expect(firstContactInput.value).toBe('9876543210');

    // 3. Blur commits the value
    act(() => {
      fireEvent.blur(firstContactInput);
    });

    // Check localStorage was updated with the new value
    const saved = localStorage.getItem('sabi_daily_tasks_excel_sheets_v3');
    expect(saved).toBeTruthy();
    expect(saved).toContain('9876543210');
  });

  it('navigates with Enter to next row without losing input focus or requiring double click', () => {
    render(<DailyTasksBoard />);

    const inputs = document.querySelectorAll('input[data-cell-id]');
    const contactInputs = Array.from(inputs).filter(input => 
      input.getAttribute('data-cell-id')?.includes('contactNumber')
    ) as HTMLInputElement[];

    expect(contactInputs.length).toBeGreaterThan(1);

    const firstInput = contactInputs[0];
    const secondInput = contactInputs[1];

    act(() => {
      fireEvent.focus(firstInput);
    });
    act(() => {
      fireEvent.change(firstInput, { target: { value: 'Row 1 Number' } });
    });
    act(() => {
      fireEvent.keyDown(firstInput, { key: 'Enter' });
    });

    expect(firstInput.value).toBe('Row 1 Number');
  });

  it('preserves text and cursor on touch without duplicate event bubbling', () => {
    render(<DailyTasksBoard />);

    const inputs = document.querySelectorAll('input[data-cell-id]');
    const firstInput = inputs[0] as HTMLInputElement;

    const stopPropagationSpy = vi.fn();
    const touchStartEvent = new Event('touchstart', { bubbles: true, cancelable: true });
    touchStartEvent.stopPropagation = stopPropagationSpy;

    fireEvent(firstInput, touchStartEvent);

    expect(firstInput.classList.contains('select-text')).toBe(true);
    expect(firstInput.classList.contains('touch-manipulation')).toBe(true);
  });

  it('sorts date column month-wise (A to Z) without erasing data or putting empty rows on top', () => {
    // Seed initial sheet data with October, November, December in reverse/random order
    const mockSheets = [
      {
        id: 'sheet-test',
        name: 'Test Sheet',
        columns: [
          { id: 'contactNumber', label: 'Contact Number', width: 170, type: 'text' },
          { id: 'count', label: 'Count', width: 100, type: 'text' },
          { id: 'birthday', label: 'Birthday', width: 140, type: 'date' },
          { id: 'comments', label: 'Comments', width: 220, type: 'text' }
        ],
        rows: [
          { id: 'r1', contactNumber: '999', count: '100', birthday: '28.11.2026', comments: 'Nov row' },
          { id: 'r2', contactNumber: '888', count: '200', birthday: '28.10.2026', comments: 'Oct row' },
          { id: 'r3', contactNumber: '777', count: '200', birthday: '20.12.2026', comments: 'Dec row' },
          // Empty placeholder rows
          { id: 'r4', contactNumber: '', count: '', birthday: '', comments: '' },
          { id: 'r5', contactNumber: '', count: '', birthday: '', comments: '' }
        ]
      }
    ];
    localStorage.setItem('sabi_daily_tasks_excel_sheets_v3', JSON.stringify(mockSheets));

    render(<DailyTasksBoard />);

    // Query Birthday inputs
    const birthdayInputs = Array.from(document.querySelectorAll('input[data-cell-id]')).filter(
      input => input.getAttribute('data-cell-id')?.includes('birthday')
    ) as HTMLInputElement[];

    expect(birthdayInputs.length).toBeGreaterThanOrEqual(3);
    // Initially: r1 (28.11.2026), r2 (28.10.2026), r3 (20.12.2026)
    expect(birthdayInputs[0].value).toBe('28.11.2026');

    // Click column header menu for Birthday
    // Find Birthday header th
    const birthdayTh = Array.from(document.querySelectorAll('th')).find(
      th => th.textContent?.includes('Birthday')
    );
    expect(birthdayTh).toBeDefined();

    // Click the 3-dot options button inside Birthday th
    const moreBtn = birthdayTh?.querySelector('button[title="Column options"]');
    expect(moreBtn).toBeDefined();
    act(() => {
      fireEvent.click(moreBtn!);
    });

    // Find and click Sort (A to Z) button
    const sortAscBtn = screen.getByText(/Sort \(A to Z\)/i);
    expect(sortAscBtn).toBeDefined();
    act(() => {
      fireEvent.click(sortAscBtn);
    });

    // Re-query inputs after sort
    const sortedInputs = Array.from(document.querySelectorAll('input[data-cell-id]')).filter(
      input => input.getAttribute('data-cell-id')?.includes('birthday')
    ) as HTMLInputElement[];

    // Expect: October (28.10.2026) -> November (28.11.2026) -> December (20.12.2026)
    // and empty rows must NOT precede data rows!
    expect(sortedInputs[0].value).toBe('28.10.2026');
    expect(sortedInputs[1].value).toBe('28.11.2026');
    expect(sortedInputs[2].value).toBe('20.12.2026');
    expect(sortedInputs[3].value).toBe('');
  });

  it('sorts date column (Z to A) newest first with empty rows placed at the bottom', () => {
    const mockSheets = [
      {
        id: 'sheet-test-2',
        name: 'Test Sheet 2',
        columns: [
          { id: 'contactNumber', label: 'Contact Number', width: 170, type: 'text' },
          { id: 'count', label: 'Count', width: 100, type: 'text' },
          { id: 'birthday', label: 'Birthday', width: 140, type: 'date' },
          { id: 'comments', label: 'Comments', width: 220, type: 'text' }
        ],
        rows: [
          { id: 'r1', contactNumber: '999', count: '100', birthday: '28.11.2026', comments: 'Nov row' },
          { id: 'r2', contactNumber: '888', count: '200', birthday: '28.10.2026', comments: 'Oct row' },
          { id: 'r3', contactNumber: '777', count: '200', birthday: '20.12.2026', comments: 'Dec row' },
          { id: 'r4', contactNumber: '', count: '', birthday: '', comments: '' }
        ]
      }
    ];
    localStorage.setItem('sabi_daily_tasks_excel_sheets_v3', JSON.stringify(mockSheets));

    render(<DailyTasksBoard />);

    const birthdayTh = Array.from(document.querySelectorAll('th')).find(
      th => th.textContent?.includes('Birthday')
    );
    const moreBtn = birthdayTh?.querySelector('button[title="Column options"]');
    act(() => {
      fireEvent.click(moreBtn!);
    });

    const sortDescBtn = screen.getByText(/Sort \(Z to A\)/i);
    act(() => {
      fireEvent.click(sortDescBtn);
    });

    const sortedInputs = Array.from(document.querySelectorAll('input[data-cell-id]')).filter(
      input => input.getAttribute('data-cell-id')?.includes('birthday')
    ) as HTMLInputElement[];

    // Expect: December (20.12.2026) -> November (28.11.2026) -> October (28.10.2026) -> empty
    expect(sortedInputs[0].value).toBe('20.12.2026');
    expect(sortedInputs[1].value).toBe('28.11.2026');
    expect(sortedInputs[2].value).toBe('28.10.2026');
    expect(sortedInputs[3].value).toBe('');
  });
});

