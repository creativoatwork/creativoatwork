import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth, persistenceReady } from '../firebase';
import { ADMIN_EMAILS } from '../config';

interface AuthState {
  user: User | null;
  loading: boolean;
  /**
   * Whether the signed-in email is on the allowlist.
   *
   * NOT the access control. This only prevents an accidental wrong-account session from showing
   * a broken UI; the Firestore rules are what refuse the data. See config.ts.
   */
  isAllowed: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  user: null, loading: true, isAllowed: false, signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    persistenceReady.finally(() => {
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    });
    return () => unsub();
  }, []);

  const email = user?.email?.toLowerCase() ?? '';
  const isAllowed = !!user && ADMIN_EMAILS.some((e) => e.toLowerCase() === email);

  return (
    <Ctx.Provider value={{ user, loading, isAllowed, signOut: () => fbSignOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}
