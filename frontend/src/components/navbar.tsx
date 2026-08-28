"use client";

import { AuthModal } from "@/components/auth-modal";
import { HowItWorksModal } from "@/components/how-it-works-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import type { HealthResponse } from "@/types/rankresume";
import {
  AlertCircle,
  HelpCircle,
  History,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

export type HealthState =
  | { status: "loading" }
  | { status: "ok"; data: HealthResponse }
  | { status: "degraded"; data: HealthResponse }
  | { status: "unreachable"; message: string };

interface NavbarProps {
  health: HealthState;
  onRetryHealth: () => void;
  activeView: "create" | "history";
  onViewChange: (view: "create" | "history") => void;
  savedRunsCount?: number;
}

export function Navbar({
  health,
  onRetryHealth,
  activeView,
  onViewChange,
  savedRunsCount,
}: NavbarProps) {
  const { user, signOut } = useAuth();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onViewChange("create")}
              className="cursor-pointer flex items-center gap-3 text-left focus:outline-none"
            >
              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#232D36] shadow-xs">
                <Image
                  src="/favicon.svg"
                  alt="RankResume"
                  width={36}
                  height={36}
                  className="size-9 object-contain"
                  priority
                />
              </div>
              <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                RankResume
              </span>
            </button>

            {/* Navigation Tabs (when signed in or Supabase configured) */}
            <nav className="hidden sm:flex items-center gap-1 border-l border-zinc-200 pl-6 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => onViewChange("create")}
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                  activeView === "create"
                    ? "bg-zinc-100 text-zinc-900 font-semibold dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <PlusCircle className="size-4" />
                <span>New Ranking</span>
              </button>

              {user && (
                <button
                  type="button"
                  onClick={() => onViewChange("history")}
                  className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                    activeView === "history"
                      ? "bg-zinc-100 text-zinc-900 font-semibold dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  <History className="size-4" />
                  <span>History</span>
                  {typeof savedRunsCount === "number" && savedRunsCount > 0 && (
                    <span className="rounded-md bg-zinc-200 px-1.5 py-0.2 text-xs font-mono font-bold dark:bg-zinc-700">
                      {savedRunsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>

          {/* Right Controls: Health Pill, Methodology, Theme Toggle, Auth */}
          <div className="flex items-center gap-2.5">
            {/* Health Status Notifications */}
            {health.status === "loading" && (
              <div
                className="hidden items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500 lg:flex dark:border-zinc-800 dark:bg-zinc-900"
                title="Checking service connection..."
              >
                <Loader2 className="size-3.5 animate-spin" />
                <span>Connecting...</span>
              </div>
            )}

            {health.status === "degraded" && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                title="Service initializing"
              >
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="hidden sm:inline">Initializing</span>
                <button
                  type="button"
                  onClick={onRetryHealth}
                  className="cursor-pointer ml-1 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                  aria-label="Retry connection"
                >
                  <RefreshCw className="size-3" />
                </button>
              </div>
            )}

            {health.status === "unreachable" && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                title="Service currently unreachable"
              >
                <AlertCircle className="size-3.5 text-red-500" />
                <span className="hidden sm:inline">Unavailable</span>
                <button
                  type="button"
                  onClick={onRetryHealth}
                  className="cursor-pointer ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
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
              className="cursor-pointer inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <HelpCircle className="size-4 text-zinc-500" />
              <span className="hidden sm:inline">Methodology</span>
            </button>

            {/* Theme Switcher */}
            <ThemeToggle />

            {/* Authentication Button / User Dropdown */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="cursor-pointer inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-2xs transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-expanded={isUserMenuOpen}
                >
                  <div className="flex size-5.5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {user.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="max-w-[120px] truncate text-xs sm:text-sm font-semibold">
                    {user.email?.split("@")[0]}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-100">
                    <div className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {user.email}
                      </p>
                      <p className="text-[11px] text-zinc-400">Account Active</p>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          onViewChange("history");
                          setIsUserMenuOpen(false);
                        }}
                        className="cursor-pointer flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                      >
                        <History className="size-4 text-zinc-500" />
                        <span>Saved History</span>
                      </button>
                    </div>

                    <div className="border-t border-zinc-100 pt-1 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          signOut();
                          setIsUserMenuOpen(false);
                          onViewChange("create");
                        }}
                        className="cursor-pointer flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <LogOut className="size-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="cursor-pointer inline-flex h-9 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-sm font-semibold text-white shadow-2xs transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <UserIcon className="size-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Methodology Guide Modal */}
      <HowItWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />

      {/* Supabase Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
