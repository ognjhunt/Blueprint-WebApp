import { useState, useEffect } from "react";

export function useLocalStorage(key, initialValue) {
  // Get from local storage then
  // parse stored json or return initialValue
  const [value, setValue] = useState(() => {
    if (typeof window !== "undefined") {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        try {
          return JSON.parse(item);
        } catch (error) {
          console.warn(`Failed to parse localStorage key "${key}":`, error);
          window.localStorage.removeItem(key);
        }
      }
    }
    return initialValue;
  });

  // Update local storage when the state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);

  return [value, setValue];
}
