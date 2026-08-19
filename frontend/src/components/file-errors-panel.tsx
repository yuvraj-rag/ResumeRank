"use client";

import type { FileError } from "@/types/rankresume";
import { AlertTriangle, FileWarning, HelpCircle } from "lucide-react";

interface FileErrorsPanelProps {
  errors: FileError[];
}

export function FileErrorsPanel({ errors }: FileErrorsPanelProps) {
  if (errors.length === 0) return null;

  return (
    <section
      aria-labelledby="file-errors-heading"
      className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-2xs dark:border-amber-900/50 dark:bg-amber-950/20 animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
          <AlertTriangle className="size-5 shrink-0" />
        </div>
        <div>
          <h3
            id="file-errors-heading"
            className="text-base font-semibold text-amber-950 dark:text-amber-100"
          >
            {errors.length} {errors.length === 1 ? "file" : "files"} could not be processed
          </h3>
          <p className="text-sm text-amber-800/80 dark:text-amber-300/80">
            Valid files were scored successfully. Below are the files that encountered errors:
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {errors.map((item) => (
          <div
            key={item.filename}
            className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-white/90 p-3.5 text-sm dark:border-amber-900/40 dark:bg-zinc-900/70"
          >
            <FileWarning className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {item.filename}
              </span>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {item.error}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex items-center gap-2 text-xs text-amber-800/80 dark:text-amber-300/70">
        <HelpCircle className="size-3.5" />
        <span>Ensure PDFs contain selectable text and Word documents (.docx) are unencrypted.</span>
      </div>
    </section>
  );
}
