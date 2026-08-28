"use client";

import type { HistoryRunSummary } from "@/types/rankresume";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";

interface HistoryListProps {
  runs: HistoryRunSummary[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => Promise<void>;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return isoString;
  }
}

export function HistoryList({
  runs,
  isLoading,
  onRefresh,
  onSelectRun,
  onDeleteRun,
}: HistoryListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) =>
      run.jd_filename.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [runs, searchQuery]);

  async function handleDelete(runId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(runId);
    setDeleteError(null);
    try {
      await onDeleteRun(runId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete ranking run.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <History className="size-5.5 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Ranking History
            </h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            View, inspect, and manage your previously saved ranking runs.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="cursor-pointer inline-flex items-center gap-2 self-start rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Delete Error Notification */}
      {deleteError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs sm:text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="cursor-pointer rounded p-1 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Search toolbar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by job description filename..."
          className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-zinc-400 shadow-2xs focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/80 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
        />
      </div>

      {/* Loading state */}
      {isLoading && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <Loader2 className="size-6 animate-spin text-zinc-500" />
          <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Loading your saved runs...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-zinc-400 shadow-xs dark:bg-zinc-800">
            <History className="size-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No Saved Ranking Runs
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-500 leading-relaxed">
            When you run candidate rankings while signed in, your runs will be saved automatically here for future review.
          </p>
        </div>
      )}

      {/* Runs List */}
      {filteredRuns.length > 0 && (
        <div className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {filteredRuns.map((run) => {
            const isDeleting = deletingId === run.id;
            const isConfirming = confirmDeleteId === run.id;

            return (
              <div
                key={run.id}
                onClick={() => onSelectRun(run.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRun(run.id);
                  }
                }}
                className="group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-zinc-50/80 cursor-pointer dark:hover:bg-zinc-900/50"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 transition-transform group-hover:scale-105">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {run.jd_filename}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        <span>{formatDate(run.created_at)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        <Users className="size-3" />
                        <span>{run.cv_count} {run.cv_count === 1 ? "CV" : "CVs"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isConfirming ? (
                    <div
                      className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-1 dark:border-red-900/50 dark:bg-red-950/40 animate-in fade-in duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs font-semibold text-red-800 dark:text-red-300 px-2">
                        Delete permanently?
                      </span>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDelete(run.id, e)}
                        className="cursor-pointer rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700 transition-colors"
                      >
                        {isDeleting ? <Loader2 className="size-3 animate-spin" /> : "Yes"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(run.id);
                      }}
                      className="cursor-pointer rounded-lg p-2 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400 transition-all"
                      aria-label={`Delete run for ${run.jd_filename}`}
                      title="Delete run"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}

                  <div className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white transition-colors">
                    <span>View</span>
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredRuns.length === 0 && runs.length > 0 && (
        <div className="p-8 text-center text-sm text-zinc-500">
          No saved runs matching &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}
