import { useState, useEffect } from "react";

/**
 * Standard debouncing hook for search inputs, filters, and high-frequency state changes.
 * Recommended: 300ms delay.
 * Automatically clears timeout on unmount or when value changes, ensuring
 * that newer keystrokes take precedence and stale requests are ignored.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
