"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPocketBase,
  hydratePocketBaseAuth,
  logPocketBaseError,
  requireAuthenticatedUserId,
  runPocketBaseRequest,
} from "@/lib/pocketbase";

type LoginChannel = "password" | "otp";

const otpDurationSeconds = 300;
const otpResendDelaySeconds = 60;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginChannel, setLoginChannel] = useState<LoginChannel>("password");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";
  const isOtpLogin = !isSignup && loginChannel === "otp";

  useEffect(() => {
    const pb = getPocketBase();
    if (!pb.authStore.isValid) {
      return;
    }
    void hydratePocketBaseAuth(pb)
      .then(() => router.replace("/dashboard"))
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    if (!otpExpiresAt) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [otpExpiresAt]);

  const otpSecondsLeft = useMemo(
    () => Math.max(0, Math.ceil(((otpExpiresAt ?? 0) - now) / 1000)),
    [now, otpExpiresAt],
  );
  const canResendOtp =
    !otpExpiresAt || otpSecondsLeft <= otpDurationSeconds - otpResendDelaySeconds;

  async function requestOtp() {
    if (!email.trim()) {
      setError("Enter your email address before requesting a code.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const pb = getPocketBase();
      const result = await runPocketBaseRequest("Request email OTP", () =>
        pb.collection("users").requestOTP(email.trim().toLowerCase()),
      );
      setOtpId(result.otpId);
      setOtpCode("");
      setOtpExpiresAt(Date.now() + otpDurationSeconds * 1000);
      setNow(Date.now());
      setNotice("A 6-digit passage code has been sent to your email.");
    } catch (otpError) {
      logPocketBaseError("Request OTP workflow", otpError);
      setError(
        otpError instanceof Error
          ? otpError.message
          : "The sanctuary could not send an email code.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otpId) {
      await requestOtp();
      return;
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError("Enter the 6-digit email code.");
      return;
    }
    if (otpSecondsLeft <= 0) {
      setError("This code has expired. Request a fresh email code.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const pb = getPocketBase();
      await runPocketBaseRequest("Authenticate with email OTP", () =>
        pb.collection("users").authWithOTP(otpId, otpCode.trim()),
      );
      requireAuthenticatedUserId(pb);
      router.push("/dashboard");
      router.refresh();
    } catch (otpError) {
      logPocketBaseError("Verify OTP workflow", otpError);
      setError(
        otpError instanceof Error
          ? otpError.message
          : "The email code could not open the sanctuary.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (isOtpLogin) {
      await verifyOtp();
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Registration failed.");
        }
      }

      const pb = getPocketBase();
      await runPocketBaseRequest("Authenticate user", () =>
        pb
          .collection("users")
          .authWithPassword(email.trim().toLowerCase(), password),
      );
      requireAuthenticatedUserId(pb);
      router.push("/dashboard");
      router.refresh();
    } catch (authError) {
      logPocketBaseError("Authentication workflow", authError);
      setError(
        authError instanceof Error
          ? authError.message
          : "The sanctuary could not verify your credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="hud-label">Celestial Access // ASNEB</div>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
        {isSignup ? "Begin your sanctuary." : "Welcome back, wanderer."}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {isSignup
          ? "Create one of the limited public seats for your private reading realm."
          : "Open your quiet archive of pages, fragments, and reflections."}
      </p>

      {!isSignup && (
        <div className="mt-7 grid grid-cols-2 gap-2 rounded-xl border border-pearl/10 bg-pearl/[0.04] p-1">
          {([
            ["password", KeyRound, "Password"],
            ["otp", ShieldCheck, "Email OTP"],
          ] as const).map(([channel, Icon, label]) => (
            <button
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                loginChannel === channel
                  ? "bg-aureate/[0.14] text-pearl shadow-halo"
                  : "text-slate-500 hover:text-slate-200"
              }`}
              key={channel}
              onClick={() => {
                setLoginChannel(channel);
                setError("");
                setNotice("");
              }}
              type="button"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      <form className="mt-9 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="hud-label ml-1">Sanctuary Email</span>
          <span className="mt-2 flex items-center rounded-lg border border-pearl/15 bg-pearl/[0.05] px-3.5 transition focus-within:border-aureate/60 focus-within:shadow-halo">
            <Mail className="h-4 w-4 text-aureate/80" />
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              placeholder="name@example.com"
            />
          </span>
        </label>

        {!isOtpLogin ? (
          <label className="block">
            <span className="hud-label ml-1">Private Phrase</span>
            <span className="mt-2 flex items-center rounded-lg border border-pearl/15 bg-pearl/[0.05] px-3.5 transition focus-within:border-aureate/60 focus-within:shadow-halo">
              <KeyRound className="h-4 w-4 text-aureate/80" />
              <input
                required
                minLength={8}
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="Minimum 8 characters"
              />
            </span>
          </label>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="hud-label ml-1">Email Passage Code</span>
              <span className="mt-2 flex items-center rounded-lg border border-pearl/15 bg-pearl/[0.05] px-3.5 transition focus-within:border-aureate/60 focus-within:shadow-halo">
                <ShieldCheck className="h-4 w-4 text-aureate/80" />
                <input
                  disabled={!otpId}
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  type="text"
                  value={otpCode}
                  onChange={(event) =>
                    setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-50"
                  placeholder={otpId ? "000000" : "Request a code first"}
                />
              </span>
            </label>
            {otpId && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-aureate/15 bg-aureate/[0.06] px-3 py-2 text-[0.68rem] text-aureate/85">
                <span className="flex items-center gap-1.5">
                  <TimerReset className="h-3.5 w-3.5" />
                  Expires in {Math.floor(otpSecondsLeft / 60)}:
                  {String(otpSecondsLeft % 60).padStart(2, "0")}
                </span>
                <button
                  className="font-semibold text-pearl transition hover:text-aureate disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={loading || !canResendOtp}
                  onClick={() => void requestOtp()}
                  type="button"
                >
                  Resend code
                </button>
              </div>
            )}
          </div>
        )}

        {!isSignup && loginChannel === "password" && (
          <div className="text-right text-xs">
            <Link
              className="font-semibold text-aureate transition hover:text-pearl"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3.5 py-3 text-xs leading-5 text-rose-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-aureate/25 bg-aureate/[0.06] px-3.5 py-3 text-xs leading-5 text-aureate/90">
            {notice}
          </div>
        )}

        <Button
          className="mt-2 w-full py-3.5"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : isOtpLogin && !otpId ? (
            <Send className="h-4 w-4" />
          ) : isOtpLogin ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isSignup
            ? "Create Sanctuary"
            : isOtpLogin && !otpId
              ? "Send Email Code"
              : isOtpLogin
                ? "Open with Code"
                : "Enter Sanctuary"}
        </Button>
      </form>

      <div className="mt-7 text-center text-xs text-slate-500">
        {isSignup ? "Already have a realm?" : "Need a reading realm?"}{" "}
        <Link
          className="font-semibold text-aureate transition hover:text-pearl"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Sign in" : "Create account"}
        </Link>
      </div>
    </div>
  );
}
