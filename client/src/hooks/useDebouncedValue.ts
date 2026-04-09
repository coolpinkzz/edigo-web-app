import { useEffect, useState } from "react";

/**
 * Returns `value` only after it has been stable for `delayMs` milliseconds.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Debounced `value.trim()` for search fields. Non-empty values wait `delayMs`;
 * empty string updates immediately so clears and “reset filters” stay in sync.
 */
export function useDebouncedString(value: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(() => value.trim());

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === "") {
      setDebounced("");
      return;
    }
    const id = window.setTimeout(() => {
      setDebounced(trimmed);
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
