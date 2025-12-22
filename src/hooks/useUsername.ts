import { useState, useEffect } from 'react';

const USERNAME_KEY = 'vibequeue_username';

export function useUsername() {
  const [username, setUsernameState] = useState<string | null>(() => {
    return localStorage.getItem(USERNAME_KEY);
  });

  const setUsername = (name: string) => {
    localStorage.setItem(USERNAME_KEY, name);
    setUsernameState(name);
  };

  const clearUsername = () => {
    localStorage.removeItem(USERNAME_KEY);
    setUsernameState(null);
  };

  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_KEY);
    if (stored) {
      setUsernameState(stored);
    }
  }, []);

  return { username, setUsername, clearUsername };
}
