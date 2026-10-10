import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type AdminAuthState = {
  checked: boolean;
  isAdmin: boolean;
  login: (
    body: Record<string, any>
  ) => Promise<Record<string, string> | null>;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    async function verify() {
      const token = localStorage.getItem('token');
      if (!token) {
        setChecked(true);
        return;
      }
      try {
        const res = await fetch('/auth/check', {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
        });
        setIsAdmin(res.ok);
      } catch {
        setIsAdmin(false);
      }
      setChecked(true);
    }
    verify();
  }, []);

  const login = useCallback(async (body: Record<string, any>) => {
    const res = await fetch('/auth/admin', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.token) {
      localStorage.setItem('token', data.token);
      setIsAdmin(true);
    }
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setIsAdmin(false);
  }, []);

  const value = useMemo(
    () => ({ checked, isAdmin, login, logout }),
    [checked, isAdmin, login, logout]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx)
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
}

export default AdminAuthProvider;
