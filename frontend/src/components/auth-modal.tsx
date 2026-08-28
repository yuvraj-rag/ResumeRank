"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  X,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "sign_in" | "sign_up";
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = "sign_in",
}: AuthModalProps) {
  const { isConfigured, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<"sign_in" | "sign_up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  function handleClose() {
    setError(null);
    setSuccessMessage(null);
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "sign_in") {
        const { error: authError } = await signInWithPassword(
          email,
          password
        );
        if (authError) {
          const msg = authError.message.toLowerCase();
          if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
            setError("Incorrect email or password. Please try again.");
          } else if (msg.includes("email not confirmed")) {
            setError("Please verify your email address before signing in.");
          } else if (msg.includes("not configured") || msg.includes("unavailable")) {
            setError("Authentication is temporarily unavailable. Please try again later.");
          } else {
            setError(authError.message || "Failed to sign in. Please check your credentials.");
          }
        } else {
          handleClose();
        }
      } else {
        const { error: authError, data } = await signUpWithPassword(
          email,
          password
        );
        if (authError) {
          const msg = authError.message.toLowerCase();
          if (msg.includes("already registered") || msg.includes("already exists")) {
            setError("An account with this email already exists. Please sign in instead.");
          } else if (msg.includes("not configured") || msg.includes("unavailable")) {
            setError("Account creation is temporarily unavailable. Please try again later.");
          } else {
            setError(authError.message || "Failed to create account.");
          }
        } else if (data?.user && !data.session) {
          // Email confirmation is required by auth settings
          setSuccessMessage(
            "Account created! Please check your email inbox to confirm your address before signing in."
          );
        } else {
          handleClose();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#232D36] shadow-xs">
              <Image
                src="/favicon.svg"
                alt="RankResume"
                width={40}
                height={40}
                className="size-10 object-contain"
              />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
              >
                {mode === "sign_in" ? "Sign In to RankResume" : "Create an Account"}
              </h2>
              <p className="text-xs text-zinc-500">
                Save and access your candidate ranking history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-200 bg-zinc-50/70 p-1 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            onClick={() => {
              setMode("sign_in");
              setError(null);
              setSuccessMessage(null);
            }}
            className={`cursor-pointer flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "sign_in"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("sign_up");
              setError(null);
              setSuccessMessage(null);
            }}
            className={`cursor-pointer flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "sign_up"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {!isConfigured && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Account Services Unavailable</p>
                <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
                  Account sign in is temporarily unavailable. You can continue to use all candidate ranking and comparison features anonymously.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 animate-in fade-in duration-100"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 animate-in fade-in duration-100"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="leading-relaxed">{successMessage}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="auth-email"
              className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={!isConfigured || isSubmitting}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2.5 pl-10 pr-3.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="auth-password"
              className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="auth-password"
                type="password"
                required
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "sign_in" ? "••••••••" : "Minimum 6 characters"}
                disabled={!isConfigured || isSubmitting}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2.5 pl-10 pr-3.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isConfigured || isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{mode === "sign_in" ? "Signing In..." : "Creating Account..."}</span>
                </>
              ) : (
                <span>{mode === "sign_in" ? "Sign In" : "Create Account"}</span>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-zinc-500">
            {mode === "sign_in" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign_up");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign_in");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
