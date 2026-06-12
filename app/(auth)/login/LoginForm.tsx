"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FaEnvelopeOpenText, FaFutbol } from "react-icons/fa6";
import {
  type EmailSignInState,
  signInAsGuest,
  signInWithEmail,
  signInWithGoogle,
} from "../actions";

const initialEmailState: EmailSignInState = { status: "idle" };

function SubmitButton({
  children,
  pendingLabel = "Enviando…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Formulario de entrada (tarea 2.1 + modo invitado). Tres métodos:
 *  - Invitado (primario): action `signInAsGuest` — anonymous sign-in, cero forms.
 *  - Google (OAuth): form que invoca la action `signInWithGoogle` (redirige).
 *  - Email (magic link): `useActionState` muestra "revisa tu correo" al enviar.
 */
export function LoginForm({ error }: { error?: string }) {
  const [emailState, emailAction] = useActionState(
    signInWithEmail,
    initialEmailState,
  );

  if (emailState.status === "sent") {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm">
        <p className="flex items-center justify-center gap-1.5 font-medium text-foreground">
          <FaEnvelopeOpenText aria-hidden /> Revisa tu correo
        </p>
        <p className="mt-1 text-foreground-muted">
          Te enviamos un enlace de acceso a{" "}
          <span className="text-foreground">{emailState.email}</span>. Ábrelo
          para entrar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <form action={signInAsGuest} className="flex flex-col gap-2">
        <SubmitButton pendingLabel="Entrando…">
          <span className="inline-flex items-center gap-1.5">
            <FaFutbol aria-hidden /> Jugar sin cuenta
          </span>
        </SubmitButton>
        <p className="text-center text-xs text-foreground-muted">
          Sin registro. Después puedes guardar tu progreso con Google.
        </p>
      </form>

      <div className="flex items-center gap-3 text-xs text-foreground-muted">
        <span className="h-px flex-1 bg-border" />o crea tu cuenta
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-muted"
        >
          <GoogleIcon />
          Continuar con Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-foreground-muted">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>

      <form action={emailAction} className="flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className="w-full rounded-lg border border-border bg-surface-muted px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-brand"
        />
        {emailState.status === "error" && (
          <p role="alert" className="text-sm text-danger">
            {emailState.message}
          </p>
        )}
        <SubmitButton>Enviar enlace de acceso</SubmitButton>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
