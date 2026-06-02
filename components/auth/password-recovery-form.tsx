"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPocketBase, logPocketBaseError, runPocketBaseRequest } from "@/lib/pocketbase";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await runPocketBaseRequest("Request password reset", () =>
        getPocketBase().collection("users").requestPasswordReset(email.trim().toLowerCase()),
      );
      setSent(true);
    } catch (resetError) {
      logPocketBaseError("Request password reset workflow", resetError);
      setError(
        resetError instanceof Error
          ? resetError.message
          : "The recovery email could not be sent.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="hud-label">Password Recovery</div>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
        Send a recovery thread.
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Enter your account email and PocketBase will send the reset link through
        the configured mailer.
      </p>

      <form className="mt-9 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="hud-label ml-1">Sanctuary Email</span>
          <span className="mt-2 flex items-center rounded-lg border border-pearl/15 bg-pearl/[0.05] px-3.5 transition focus-within:border-aureate/60 focus-within:shadow-halo">
            <Mail className="h-4 w-4 text-aureate/80" />
            <input
              required
              autoComplete="email"
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3.5 py-3 text-xs leading-5 text-rose-200">
            {error}
          </div>
        )}
        {sent && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.06] px-3.5 py-3 text-xs leading-5 text-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Recovery email sent. Follow the link in your inbox.
          </div>
        )}

        <Button className="mt-2 w-full py-3.5" disabled={loading || sent} type="submit">
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Send Recovery Email
        </Button>
      </form>

      <div className="mt-7 text-center text-xs text-slate-500">
        <Link className="font-semibold text-aureate transition hover:text-pearl" href="/login">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState(token ? "" : "The reset link is missing its token.");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (password.length < 8) {
      setError("The new private phrase must contain at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("The private phrases do not match.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await runPocketBaseRequest("Confirm password reset", () =>
        getPocketBase()
          .collection("users")
          .confirmPasswordReset(token, password, passwordConfirm),
      );
      router.push("/login");
      router.refresh();
    } catch (resetError) {
      logPocketBaseError("Confirm password reset workflow", resetError);
      setError(
        resetError instanceof Error
          ? resetError.message
          : "The private phrase could not be reset.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="hud-label">Password Recovery</div>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
        Choose a new phrase.
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Complete the reset from your email link, then return to the sanctuary.
      </p>

      <form className="mt-9 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="hud-label ml-1">New Private Phrase</span>
          <span className="mt-2 flex items-center rounded-lg border border-pearl/15 bg-pearl/[0.05] px-3.5 transition focus-within:border-aureate/60 focus-within:shadow-halo">
            <KeyRound className="h-4 w-4 text-aureate/80" />
            <input
              required
              autoComplete="new-password"
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              type="password"
              value={password}
            />
          </span>
        </label>
        <label className="block">
          <span className="hud-label ml-1">Confirm Phrase</span>
          <span className="mt-2 flex items-center rounded-lg border border-pearl/15 bg-pearl/[0.05] px-3.5 transition focus-within:border-aureate/60 focus-within:shadow-halo">
            <KeyRound className="h-4 w-4 text-aureate/80" />
            <input
              required
              autoComplete="new-password"
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              minLength={8}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="Repeat the private phrase"
              type="password"
              value={passwordConfirm}
            />
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3.5 py-3 text-xs leading-5 text-rose-200">
            {error}
          </div>
        )}

        <Button className="mt-2 w-full py-3.5" disabled={loading || !token} type="submit">
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Reset Password
        </Button>
      </form>

      <div className="mt-7 text-center text-xs text-slate-500">
        <Link className="font-semibold text-aureate transition hover:text-pearl" href="/login">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}
