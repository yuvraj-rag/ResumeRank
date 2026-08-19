"use client";

import { HowItWorksModal } from "@/components/how-it-works-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import type { HealthResponse } from "@/types/rankresume";
import {
  AlertCircle,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

export type HealthState =
  | { status: "loading" }
  | { status: "ok"; data: HealthResponse }
  | { status: "degraded"; data: HealthResponse }
  | { status: "unreachable"; message: string };

interface NavbarProps {
  health: HealthState;
  onRetryHealth: () => void;
}

export function Navbar({ health, onRetryHealth }: NavbarProps) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Clean Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900">
              <FileText className="size-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              RankResume
            </span>
          </div>

          {/* Right Controls: Unobtrusive Status (only if degraded/offline), Methodology, Theme Toggle */}
          <div className="flex items-center gap-3">
            {health.status === "loading" && (
              <div
                className="hidden items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500 sm:flex dark:border-zinc-800 dark:bg-zinc-900"
                title="Checking service connection..."
              >
                <Loader2 className="size-3.5 animate-spin" />
                <span>Connecting...</span>
              </div>
            )}

            {health.status === "degraded" && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                title="Service degraded"
              >
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="hidden sm:inline">Model Initializing</span>
                <button
                  type="button"
                  onClick={onRetryHealth}
                  className="ml-1 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                  aria-label="Retry connection"
                >
                  <RefreshCw className="size-3" />
                </button>
              </div>
            )}

            {health.status === "unreachable" && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                title="Server unreachable"
              >
                <AlertCircle className="size-3.5 text-red-500" />
                <span className="hidden sm:inline">Offline</span>
                <button
                  type="button"
                  onClick={onRetryHealth}
                  className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                  aria-label="Retry connection"
                >
                  <RefreshCw className="size-3" />
                  Retry
                </button>
              </div>
            )}

            {/* Methodology Guide Trigger */}
            <button
              type="button"
              onClick={() => setShowHowItWorks(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <HelpCircle className="size-4 text-zinc-500" />
              <span>Methodology</span>
            </button>

            {/* Theme Switcher */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Detailed Methodology Guide Modal */}
      <HowItWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />
    </>
  );
}
