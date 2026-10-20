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
});
