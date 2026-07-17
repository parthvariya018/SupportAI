import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext  = createContext(null);
const STORAGE_KEY  = 'supportai_auth';

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Guard against corrupted or partial saves
    if (!parsed.token || !parsed.user) return {};
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
};

export function AuthProvider({ children }) {
  const saved = loadFromStorage();
  const [user,  setUser]  = useState(saved.user  ?? null);
  const [token, setToken] = useState(saved.token ?? null);

  const setAuth = useCallback((u, t) => {
    setUser(u);
    setToken(t);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, token: t }));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser(prev => {
      const next = { ...prev, ...patch };
      const current = loadFromStorage();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: next, token: current.token }));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      setAuth,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
