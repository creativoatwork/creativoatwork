import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { SignInCard } from './SignInCard';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, isAllowed } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-[var(--color-ink-3)]">
        Checking session…
      </div>
    );
  }
  // Gate on the allowlist for the UI only. Firestore rules are the real refusal.
  return isAllowed ? <>{children}</> : <SignInCard />;
}
