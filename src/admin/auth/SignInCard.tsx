import { useState } from 'react';
import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from './AuthProvider';
import { Field, TextInput } from '../components/Field';

/**
 * The signed-out screen, and the wrong-account screen.
 *
 * It also displays the signed-in UID. That is not scaffolding: when the rules are locked to an
 * allowlist, reading your own UID is otherwise awkward, and it is visible only to someone who
 * has already authenticated.
 */
export function SignInCard() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      setError(
        code === 'auth/popup-closed-by-user' ? 'Sign-in was cancelled.'
        : code === 'auth/invalid-credential' ? 'That email and password did not match an account.'
        : `Sign-in failed (${code}).`,
      );
    } finally {
      setBusy(false);
    }
  };

  const wrongAccount = !!user;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <h1 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-3)]">
        admindash
      </h1>

      {wrongAccount ? (
        <>
          <p className="mt-4 text-[var(--color-ink)]">
            {user.email} does not have access.
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-3)]">
            Signed in, but this account is not on the allowlist.
          </p>
          <p className="mt-4 font-mono text-xs break-all text-[var(--color-ink-3)]">
            UID {user.uid}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 border border-[var(--color-rule-strong)] px-4 py-2 text-sm hover:border-[var(--color-ink)]"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-[var(--color-ink-3)]">
            Private. Sign in to continue.
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => signInWithPopup(auth, new GoogleAuthProvider()))}
            className="mt-6 border border-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Continue with Google'}
          </button>

          <button
            type="button"
            onClick={() => setShowEmail((v) => !v)}
            aria-expanded={showEmail}
            className="mt-3 self-start text-xs text-[var(--color-ink-3)] underline underline-offset-4"
          >
            Sign in with email instead
          </button>

          {showEmail && (
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => signInWithEmailAndPassword(auth, email.trim(), password));
              }}
            >
              <Field label="Email">
                {(id) => (
                  <TextInput
                    id={id} type="email" autoComplete="username" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Password">
                {(id) => (
                  <TextInput
                    id={id} type="password" autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>
              <button
                type="submit" disabled={busy}
                className="self-start border border-[var(--color-rule-strong)] px-4 py-2 text-sm hover:border-[var(--color-ink)] disabled:opacity-50"
              >
                Sign in
              </button>
            </form>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-accent)]">{error}</p>
      )}
    </main>
  );
}
