"use client";

import { CheckCircle2, FileSearch, Layers, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const STAGES = [
  { label: "Extracting text from uploaded documents (.pdf, .docx, .txt)", icon: FileSearch },
  { label: "Analyzing semantic context and domain requirements", icon: Layers },
  { label: "Calculating keyword coverage and synonym matches", icon: Sparkles },
  { label: "Evaluating skill experience timeline and final rankings", icon: Sparkles },
];

export function ProcessingStatus() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/80 animate-in fade-in zoom-in-98 duration-200">
      <div className="flex items-center gap-3.5">
        <div className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs">
          <Loader2 className="size-5.5 animate-spin" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Analyzing Candidate Resumes
          </h3>
          <p className="text-sm text-zinc-500">
            Evaluating candidates against job criteria
          </p>
        </div>
      </div>

      {/* Progress timeline */}
      <div className="mt-6 space-y-3">
        {STAGES.map((stage, idx) => {
          const isDone = idx < activeStage;
          const isCurrent = idx === activeStage;

          return (
            <div
              key={stage.label}
              className={`flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200 ${
                isCurrent
                  ? "border border-zinc-200 bg-zinc-50 font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-100"
                  : isDone
                  ? "text-zinc-600 dark:text-zinc-400"
                  : "text-zinc-400 opacity-60 dark:text-zinc-600"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="size-4.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : isCurrent ? (
                <Loader2 className="size-4.5 shrink-0 animate-spin text-zinc-900 dark:text-zinc-100" />
              ) : (
                <div className="size-4.5 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700" />
              )}
              <span className="flex-1">{stage.label}</span>
              {isCurrent && (
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 animate-pulse">
                  In progress...
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
