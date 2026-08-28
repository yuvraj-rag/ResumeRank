"use client";

import {
  BookOpen,
  CheckCircle2,
  Clock,
  Code2,
  FileCheck2,
  Layers,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-it-works-title"
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2
                id="how-it-works-title"
                className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
              >
                Scoring Methodology & Pipeline
              </h2>
              <p className="text-sm text-zinc-500">
                How candidate resumes are evaluated against job requirements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6 text-sm text-zinc-600 dark:text-zinc-300">
          {/* Section 1: Semantic Similarity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Layers className="size-4.5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-base font-semibold">
                1. Semantic Similarity (65% Standard Weight)
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 pl-6.5">
              The job description and candidate resumes are parsed into high-dimensional semantic vector embeddings. Cosine similarity is computed between document vectors to evaluate overall domain context and role alignment.
            </p>
          </div>

          {/* Section 2: Weighted Keyword Coverage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Code2 className="size-4.5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-base font-semibold">
                2. Weighted Keyword Coverage (35% Standard Weight)
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 pl-6.5">
              Extracts the top key technical terms and phrases from the job description weighted by relevance. Each candidate’s coverage is evaluated with:
            </p>
            <ul className="pl-12 list-disc space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <li><strong>Synonym Expansion:</strong> Recognizes standard technical variations and abbreviations (e.g. <em>JS</em> ↔ <em>JavaScript</em>, <em>ML</em> ↔ <em>Machine Learning</em>, <em>Postgres</em> ↔ <em>PostgreSQL</em>).</li>
              <li><strong>Negation Awareness:</strong> Inspects contextual windows around phrases to ignore negated mentions (such as <em>&quot;not experienced in Docker&quot;</em>).</li>
            </ul>
          </div>

          {/* Section 3: Experience Inference */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Clock className="size-4.5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-base font-semibold">
                3. Skill Experience Extraction (Optional 20% Blend)
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 pl-6.5">
              When specific skills are tracked (e.g. Python, React), our dual-detection engine calculates estimated tenure:
            </p>
            <ul className="pl-12 list-disc space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <li><strong>Explicit Duration Phrases:</strong> Locates phrases like <em>&quot;5+ years of Python&quot;</em> directly in the text.</li>
              <li><strong>Dated Job Blocks:</strong> Analyzes employment date ranges in work history blocks where the skill is mentioned.</li>
              <li><strong>Cross-Validation:</strong> Averages both methods when both signals are detected. A 5-year tenure cap represents 100% credit per skill.</li>
            </ul>
          </div>

          {/* Section 4: Specifications */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
              <FileCheck2 className="size-4 text-zinc-600 dark:text-zinc-400" />
              File & Processing Specifications
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                <span>Supported: .pdf, .docx, .txt</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                <span>Max size: 10 MB per file</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                <span>Batch limit: Up to 20 CVs per run</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                <span>Standard text-based document parsing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-200 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
