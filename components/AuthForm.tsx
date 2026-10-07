"use client";

import { useActionState } from "react";
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithPassword,
  signUp,
  updatePassword,
  type AuthState,
} from "@/lib/auth/actions";
import { ui } from "@/components/ui/styles";

type Mode = "login" | "signup" | "magic" | "forgot" | "reset";

const ACTIONS = {
  login: signInWithPassword,
  signup: signUp,
  magic: sendMagicLink,
  forgot: sendPasswordReset,
  reset: updatePassword,
} as const;

const SUBMIT: Record<Mode, [string, string]> = {
  login: ["Log in", "Logging in…"],
  signup: ["Create free account", "Creating account…"],
  magic: ["Email me a login link", "Sending…"],
  forgot: ["Send reset link", "Sending…"],
  reset: ["Save new password", "Saving…"],
};

export function AuthForm({ mode, next, initialError }: { mode: Mode; next?: string; initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(ACTIONS[mode], {
    error: initialError,
  });
  const done = Boolean(state.message) && mode !== "login";
  const [label, busy] = SUBMIT[mode];

  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <p role="alert" className={ui.errorBox}>
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className={ui.okBox}>
          {state.message}
        </p>
      ) : null}

      {mode !== "reset" && !done ? (
        <div>
          <label htmlFor="email" className={ui.label}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            placeholder="you@example.com"
            className={ui.input}
          />
        </div>
      ) : null}

      {(mode === "login" || mode === "signup" || mode === "reset") && !(done && mode !== "reset") ? (
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={ui.label}>
              {mode === "reset" ? "New password" : "Password"}
            </label>
            {mode === "login" ? (
              <a href="/forgot-password" className="text-xs text-slate-400 hover:text-white">
                Forgot password?
              </a>
            ) : null}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "login" ? undefined : 8}
            placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
            className={ui.input}
          />
        </div>
      ) : null}

      {mode === "reset" && !done ? (
        <div>
          <label htmlFor="confirm" className={ui.label}>
            Confirm new password
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={ui.input} />
        </div>
      ) : null}

      {!done ? (
        <button type="submit" disabled={pending} className={`${ui.primary} w-full`}>
          {pending ? busy : label}
        </button>
      ) : mode === "reset" ? (
        <a href="/account" className={`${ui.primary} w-full`}>
          Go to your account
        </a>
      ) : null}
    </form>
  );
}
