"use client";

import type {
  CVRankingEntry,
  ExperienceDetail,
  RankingResponse,
} from "@/types/rankresume";
import {
  Award,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileCheck2,
  Filter,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import React, { useMemo, useState } from "react";

const EXPERIENCE_METHOD_LABELS: Record<ExperienceDetail["method"], string> = {
  explicit_window: "Explicit phrase near skill",
  job_block_inference: "Inferred from dated job block",
  cross_validated: "Cross-validated average",
};

function formatScore(value: number): string {
  return value.toFixed(4);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getScoreBadgeColor(score: number): {
  bg: string;
  text: string;
  bar: string;
} {
  if (score >= 0.75) {
    return {
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
      text: "text-emerald-700 dark:text-emerald-400",
      bar: "bg-emerald-600 dark:bg-emerald-500",
    };
  }
  if (score >= 0.5) {
    return {
      bg: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700",
      text: "text-zinc-800 dark:text-zinc-200",
      bar: "bg-zinc-700 dark:bg-zinc-400",
    };
  }
  return {
    bg: "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800",
    text: "text-zinc-500 dark:text-zinc-400",
    bar: "bg-zinc-400 dark:bg-zinc-600",
  };
}

function KeywordTags({
  keywords,
  variant,
}: {
  keywords: string[];
  variant: "matched" | "missing";
}) {
  if (keywords.length === 0) {
    return <span className="text-sm text-zinc-400 italic">None detected</span>;
  }

  const isMatched = variant === "matched";

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <span
          key={keyword}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
            isMatched
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
              : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700"
          }`}
        >
          {isMatched ? (
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <span className="size-1.5 rounded-full bg-zinc-400" />
          )}
          <span>{keyword}</span>
        </span>
      ))}
    </div>
  );
}

interface RankingRowProps {
  entry: CVRankingEntry;
  rank: number;
  experience: Record<string, ExperienceDetail> | undefined;
  requiredSkills: string[];
  showExperienceBreakdown: boolean;
  showExperienceScore: boolean;
}

function RankingRow({
  entry,
  rank,
  experience,
  requiredSkills,
  showExperienceBreakdown,
  showExperienceScore,
}: RankingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const showSkillTable = showExperienceBreakdown && requiredSkills.length > 0;
  const scoreColors = getScoreBadgeColor(entry.score);

  function copyCandidateSummary() {
    const summary = [
      `Candidate: ${entry.cv}`,
      `Rank: #${rank}`,
      `Overall Score: ${formatScore(entry.score)} (${formatPercent(entry.score)})`,
      `Semantic Match: ${formatPercent(entry.semantic_score)}`,
      `Keyword Coverage: ${formatPercent(entry.keyword_coverage)}`,
      entry.experience_score !== null
        ? `Experience Score: ${formatPercent(entry.experience_score)}`
        : null,
      `Matched Keywords: ${entry.matched.join(", ") || "None"}`,
      `Missing Keywords: ${entry.missing.join(", ") || "None"}`,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <tr className="border-b border-zinc-200/80 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
        {/* Rank # */}
        <td className="px-5 py-4 text-sm font-semibold">
          <span
            className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${
              rank === 1
                ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:ring-amber-800"
                : rank === 2
                ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                : rank === 3
                ? "bg-amber-50 text-amber-800 dark:bg-zinc-800/80 dark:text-zinc-300"
                : "text-zinc-500 font-medium"
            }`}
          >
            {rank}
          </span>
        </td>

        {/* Candidate CV Name & Toggle */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-expanded={expanded}
              aria-label={expanded ? `Hide details for ${entry.cv}` : `Show details for ${entry.cv}`}
            >
              {expanded ? (
                <ChevronDown className="size-4.5" />
              ) : (
                <ChevronRight className="size-4.5" />
              )}
            </button>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
              {entry.cv}
            </span>
          </div>
        </td>

        {/* Overall Match Score with Progress Bar */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-3.5">
            <span className="font-mono text-sm sm:text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100 min-w-[56px]">
              {formatScore(entry.score)}
            </span>
            <div className="hidden sm:flex flex-col w-24 gap-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${scoreColors.bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, entry.score * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </td>

        {/* Semantic Similarity Score */}
        <td className="hidden px-5 py-4 font-mono text-sm tabular-nums text-zinc-700 sm:table-cell dark:text-zinc-300">
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800">
            {formatPercent(entry.semantic_score)}
          </span>
        </td>

        {/* Keyword Coverage */}
        <td className="hidden px-5 py-4 font-mono text-sm tabular-nums text-zinc-700 md:table-cell dark:text-zinc-300">
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800">
            {formatPercent(entry.keyword_coverage)}
          </span>
        </td>

        {/* Experience Score (Conditional) */}
        {showExperienceScore && (
          <td className="hidden px-5 py-4 font-mono text-sm tabular-nums text-zinc-700 lg:table-cell dark:text-zinc-300">
            {entry.experience_score !== null ? (
              <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800">
                {formatPercent(entry.experience_score)}
              </span>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </td>
        )}
      </tr>

      {/* Expanded Details Drawer */}
      {expanded && (
        <tr className="border-b border-zinc-200/80 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/60 animate-in fade-in duration-150">
          <td colSpan={showExperienceScore ? 6 : 5} className="px-5 py-6 sm:px-8">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="size-4.5 text-zinc-500" />
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Candidate Breakdown: {entry.cv}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={copyCandidateSummary}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy summary</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Matched Keywords */}
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60 shadow-2xs">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Matched Keywords
                    </p>
                    <span className="font-mono text-xs text-zinc-500">
                      {entry.matched.length} found
                    </span>
                  </div>
                  <KeywordTags keywords={entry.matched} variant="matched" />
                </div>

                {/* Missing Keywords */}
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60 shadow-2xs">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Missing Keywords
                    </p>
                    <span className="font-mono text-xs text-zinc-500">
                      {entry.missing.length} missing
                    </span>
                  </div>
                  <KeywordTags keywords={entry.missing} variant="missing" />
                </div>

                {/* Skill Experience Details */}
                {showSkillTable && (
                  <div className="sm:col-span-2 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60 shadow-2xs">
                    <div className="mb-3 flex items-center gap-2">
                      <Clock className="size-4 text-zinc-500" />
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Inferred Skill Experience
                      </p>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50 text-left font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                          <tr>
                            <th className="px-4 py-2.5">Skill</th>
                            <th className="px-4 py-2.5">Estimated Tenure</th>
                            <th className="px-4 py-2.5">Detection Method</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {requiredSkills.map((skill) => {
                            const detail = experience?.[skill];
                            return (
                              <tr key={skill}>
                                <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                                  {skill}
                                </td>
                                <td className="px-4 py-2.5 font-mono font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                                  {detail
                                    ? `${detail.years.toFixed(1)} years`
                                    : "Not detected"}
                                </td>
                                <td className="px-4 py-2.5 text-zinc-500 text-xs sm:text-sm">
                                  {detail
                                    ? EXPERIENCE_METHOD_LABELS[detail.method]
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface RankingResultsProps {
  result: RankingResponse;
  requiredSkills: string[];
  showExperienceBreakdown: boolean;
  showExperienceScore: boolean;
}

export function RankingResults({
  result,
  requiredSkills,
  showExperienceBreakdown,
  showExperienceScore,
}: RankingResultsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "score" | "semantic" | "keyword" | "experience" | "name"
  >("score");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [copiedReport, setCopiedReport] = useState(false);

  // Statistics calculation
  const totalCount = result.rankings.length;
  const topCandidate = result.rankings[0];
  const averageScore = useMemo(() => {
    if (totalCount === 0) return 0;
    const sum = result.rankings.reduce((acc, curr) => acc + curr.score, 0);
    return sum / totalCount;
  }, [result.rankings, totalCount]);

  // Filtered and sorted rankings
  const filteredAndSortedRankings = useMemo(() => {
    return result.rankings
      .filter((entry) =>
        entry.cv.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
      .sort((a, b) => {
        if (sortBy === "score") return b.score - a.score;
        if (sortBy === "semantic") return b.semantic_score - a.semantic_score;
        if (sortBy === "keyword") return b.keyword_coverage - a.keyword_coverage;
        if (sortBy === "experience") {
          const expA = a.experience_score ?? 0;
          const expB = b.experience_score ?? 0;
          return expB - expA;
        }
        if (sortBy === "name") return a.cv.localeCompare(b.cv);
        return 0;
      });
  }, [result.rankings, searchQuery, sortBy]);

  // CSV Export handler
  function exportToCSV() {
    const headers = [
      "Rank",
      "Candidate CV",
      "Overall Score",
      "Semantic Score",
      "Keyword Coverage",
      "Experience Score",
      "Matched Keywords",
      "Missing Keywords",
    ];

    const rows = result.rankings.map((entry, idx) => [
      idx + 1,
      `"${entry.cv}"`,
      entry.score.toFixed(4),
      (entry.semantic_score * 100).toFixed(1) + "%",
      (entry.keyword_coverage * 100).toFixed(1) + "%",
      entry.experience_score !== null
        ? (entry.experience_score * 100).toFixed(1) + "%"
        : "N/A",
      `"${entry.matched.join(", ")}"`,
      `"${entry.missing.join(", ")}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `rankresume-results-${result.jd_filename.replace(/[^a-z0-9]/gi, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Copy Summary Report
  function copySummaryReport() {
    const lines = [
      `==============================`,
      `RANKRESUME MATCH REPORT`,
      `Benchmark JD: ${result.jd_filename}`,
      `Total Evaluated: ${totalCount} candidates`,
      `Average Score: ${formatScore(averageScore)} (${formatPercent(averageScore)})`,
      `==============================`,
      ``,
      ...result.rankings.map(
        (r, i) =>
          `#${i + 1} | ${r.cv} | Score: ${formatScore(r.score)} | Semantic: ${formatPercent(r.semantic_score)} | Keywords: ${formatPercent(r.keyword_coverage)}`
      ),
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  }

  if (result.rankings.length === 0) return null;

  return (
    <section aria-labelledby="rankings-heading" className="space-y-6 animate-in fade-in duration-200">
      {/* Section Header & Export Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Trophy className="size-5.5 text-amber-500" />
            <h2
              id="rankings-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              Candidate Rankings
            </h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Scored against benchmark{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {result.jd_filename}
            </span>
          </p>
        </div>

        {/* Export & Copy Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={copySummaryReport}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {copiedReport ? (
              <>
                <Check className="size-4 text-emerald-600" />
                <span>Report Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-4 text-zinc-500" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-2xs transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Download className="size-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-zinc-500">
            <Users className="size-4" />
            <span className="text-xs sm:text-sm font-medium">Evaluated</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {totalCount} <span className="text-sm font-normal text-zinc-400">CVs</span>
          </p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-zinc-500">
            <Award className="size-4 text-amber-500" />
            <span className="text-xs sm:text-sm font-medium">Top Match</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {topCandidate ? formatPercent(topCandidate.score) : "—"}
          </p>
          <p className="truncate text-xs text-zinc-500 mt-0.5">
            {topCandidate?.cv}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-zinc-500">
            <BarChart3 className="size-4" />
            <span className="text-xs sm:text-sm font-medium">Average Match</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatPercent(averageScore)}
          </p>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {formatScore(averageScore)}
          </p>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-zinc-500">
            <Sparkles className="size-4" />
            <span className="text-xs sm:text-sm font-medium">Scoring Weights</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {showExperienceScore ? "65% Sem / 35% KW / 20% Exp" : "65% Semantic / 35% Keyword"}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {requiredSkills.length > 0
              ? `${requiredSkills.length} skills tracked`
              : "Standard weights"}
          </p>
        </div>
      </div>

      {/* Filter and View Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/40">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter candidates by name..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "score" | "semantic" | "keyword" | "experience" | "name"
                )
              }
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="score">Sort: Match Score (High to Low)</option>
              <option value="semantic">Sort: Semantic Similarity</option>
              <option value="keyword">Sort: Keyword Coverage</option>
              {showExperienceScore && (
                <option value="experience">Sort: Experience Score</option>
              )}
              <option value="name">Sort: Candidate Name</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === "table"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
              aria-label="Table view"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
              aria-label="Grid card view"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main View: Table View */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-4 w-14">#</th>
                <th className="px-5 py-4">Candidate CV</th>
                <th className="px-5 py-4">Match Score</th>
                <th className="hidden px-5 py-4 sm:table-cell">Semantic</th>
                <th className="hidden px-5 py-4 md:table-cell">Keywords</th>
                {showExperienceScore && (
                  <th className="hidden px-5 py-4 lg:table-cell">Experience</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRankings.map((entry, index) => (
                <RankingRow
                  key={entry.cv}
                  entry={entry}
                  rank={index + 1}
                  experience={result.experience[entry.cv]}
                  requiredSkills={requiredSkills}
                  showExperienceBreakdown={showExperienceBreakdown}
                  showExperienceScore={showExperienceScore}
                />
              ))}
            </tbody>
          </table>

          {filteredAndSortedRankings.length === 0 && (
            <div className="p-10 text-center text-sm text-zinc-500">
              No candidates matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* Alternative: Grid Cards View */}
      {viewMode === "grid" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedRankings.map((entry, idx) => {
            const scoreColors = getScoreBadgeColor(entry.score);
            return (
              <div
                key={entry.cv}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs transition-all hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="inline-flex size-8 items-center justify-center rounded-xl bg-zinc-100 font-mono text-sm font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                      #{idx + 1}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 font-mono text-sm font-bold ${scoreColors.bg}`}
                    >
                      {formatPercent(entry.score)}
                    </span>
                  </div>

                  <h3 className="mt-4 truncate font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                    {entry.cv}
                  </h3>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${scoreColors.bar}`}
                      style={{ width: `${Math.min(100, Math.max(0, entry.score * 100))}%` }}
                    />
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3.5 text-sm dark:border-zinc-800/80">
                    <div>
                      <p className="text-xs text-zinc-400">Semantic</p>
                      <p className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        {formatPercent(entry.semantic_score)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Keywords</p>
                      <p className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        {formatPercent(entry.keyword_coverage)}
                      </p>
                    </div>
                  </div>

                  {/* Top Matched Tag Preview */}
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-semibold text-zinc-500">
                      Matched Skills ({entry.matched.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.matched.slice(0, 4).map((k) => (
                        <span
                          key={k}
                          className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          {k}
                        </span>
                      ))}
                      {entry.matched.length > 4 && (
                        <span className="text-xs text-zinc-400 self-center">
                          +{entry.matched.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
