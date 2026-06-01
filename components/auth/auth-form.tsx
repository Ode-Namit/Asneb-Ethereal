"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPocketBase,
  logPocketBaseError,
  requireAuthenticatedUserId,
  runPocketBaseRequest,
} from "@/lib/pocketbase";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
          : "The observatory could not verify your credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="hud-label">Restricted Access // ASNEB</div>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
        {isSignup ? "Initialize your node." : "Welcome back, researcher."}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {isSignup
          ? "Access is limited to authorized research identities."
          : "Authenticate to resume your private study environment."}
      </p>

      <form className="mt-9 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="hud-label ml-1">Researcher Email</span>
          <span className="mt-2 flex items-center rounded-lg border border-slate-700/50 bg-slate-950/45 px-3.5 transition focus-within:border-cyan-300/60 focus-within:shadow-neon">
            <Mail className="h-4 w-4 text-cyan-300/70" />
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              placeholder="name@laboratory.org"
            />
          </span>
        </label>
        <label className="block">
          <span className="hud-label ml-1">Security Phrase</span>
          <span className="mt-2 flex items-center rounded-lg border border-slate-700/50 bg-slate-950/45 px-3.5 transition focus-within:border-cyan-300/60 focus-within:shadow-neon">
            <KeyRound className="h-4 w-4 text-cyan-300/70" />
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

        {error && (
          <div className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3.5 py-3 text-xs leading-5 text-rose-200">
            {error}
          </div>
        )}

        <Button
          className="mt-2 w-full py-3.5"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isSignup ? "Request Initialization" : "Enter Workstation"}
        </Button>
      </form>

      <div className="mt-7 text-center text-xs text-slate-500">
        {isSignup ? "Already initialized?" : "First authorized session?"}{" "}
        <Link
          className="font-semibold text-cyan-300 transition hover:text-cyan-100"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Authenticate" : "Create account"}
        </Link>
      </div>
    </div>
  );
}
