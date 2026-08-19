"use client";

import { MultiFileDropzone, SingleFileDropzone } from "@/components/dropzone";
import { FileErrorsPanel } from "@/components/file-errors-panel";
import { Footer } from "@/components/footer";
import { Navbar, type HealthState } from "@/components/navbar";
import { ProcessingStatus } from "@/components/processing-status";
import { RankingResults } from "@/components/ranking-results";
import { SkillsInput } from "@/components/skills-input";
import {
  RankResumeApiError,
  checkHealth,
  rankResumes,
} from "@/lib/api";
import {
  MAX_CV_COUNT,
  MAX_FILE_SIZE_MB,
} from "@/lib/config";
import { validateRankRequest } from "@/lib/validation";
import type { RankingResponse } from "@/types/rankresume";
import { buildRankRequestFormData } from "@/types/rankresume";
import {
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Sliders,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Sample Job Description for 1-click demo testing
const SAMPLE_JD_TEXT = `Senior Backend Engineer (Python / FastAPI)

Role Summary:
We are seeking an experienced Senior Backend Engineer with strong expertise in Python, FastAPI, and asynchronous backend systems. You will design and scale robust microservices, architect PostgreSQL databases, and manage containerized deployments using Docker and AWS.

Requirements:
- 4+ years of professional software development experience in Python.
- Proven experience building high-performance APIs using FastAPI or Flask.
- Strong SQL proficiency and experience with PostgreSQL database optimization.
- Familiarity with containerization (Docker, Kubernetes) and cloud infrastructure (AWS).
- Experience with Git, CI/CD pipelines, and writing automated unit/integration tests.
- Knowledge of NLP, Redis, or Kafka is a significant plus.
`;

// Sample CV 1: Strong Match
const SAMPLE_CV_1_TEXT = `ALEX MORGAN - Senior Python Backend Engineer
Email: alex.morgan@example.com | GitHub: github.com/alexmorgan

SUMMARY:
Senior Backend Developer with 5 years of experience in Python and FastAPI backend development. Architected distributed microservices and optimized PostgreSQL databases.

EXPERIENCE:
Senior Backend Engineer | DataCore Systems (2021 - Present)
- Designed and maintained 12+ asynchronous microservices using Python and FastAPI.
- Optimized complex PostgreSQL queries and Redis caching, reducing API latency by 40%.
- Containerized services using Docker and orchestrated deployments on AWS ECS.
- Implemented CI/CD pipelines with Git and GitHub Actions.

Software Engineer | NexaTech (2019 - 2021)
- Developed RESTful APIs in Python and Flask.
- Maintained PostgreSQL databases and wrote comprehensive pytest suites.

SKILLS:
Python, FastAPI, Flask, PostgreSQL, Docker, AWS, Git, Redis, REST APIs, Microservices
`;

// Sample CV 2: Mid-Level / Partial Match
const SAMPLE_CV_2_TEXT = `SAMANTHA CHEN - Full-Stack Developer
Email: samantha.chen@example.com

SUMMARY:
Software Engineer with 3 years of experience in JavaScript, React, and Python.

EXPERIENCE:
Full-Stack Developer | PixelCraft (2022 - Present)
- Built interactive frontend applications using React and TypeScript.
- Developed backend endpoints with Python and Django.
- Worked with PostgreSQL and Git version control.

SKILLS:
React, TypeScript, JavaScript, Python, Django, PostgreSQL, Git, HTML, CSS
`;

// Sample CV 3: Frontend / Light Match
const SAMPLE_CV_3_TEXT = `JORDAN LEE - Senior Frontend Engineer
Email: jordan.lee@example.com

SUMMARY:
Frontend Engineer with 6 years of experience building modern web applications with React, Next.js, and TailwindCSS.

EXPERIENCE:
Lead Frontend Developer | WebFlow Labs (2020 - Present)
- Architected design systems using React, TypeScript, and TailwindCSS.
- Integrated REST APIs and GraphQL endpoints.

SKILLS:
React, Next.js, TypeScript, JavaScript, TailwindCSS, GraphQL, HTML5, CSS3, Git
`;

const noopSubscribe = () => () => {};

export function RankResumeApp() {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const [health, setHealth] = useState<HealthState>({ status: "loading" });
  const [jobDescription, setJobDescription] = useState<File | null>(null);
  const [cvs, setCvs] = useState<File[]>([]);
  const [extractExperience, setExtractExperience] = useState(true);
  const [skills, setSkills] = useState<string[]>(["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"]);
  const [useExperienceInScore, setUseExperienceInScore] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RankingResponse | null>(null);
  const [lastSubmittedSkills, setLastSubmittedSkills] = useState<string[]>([]);
  const [lastExtractExperience, setLastExtractExperience] = useState(false);
  const [lastUseExperienceInScore, setLastUseExperienceInScore] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  const canUseExperienceInScore = skills.length > 0;
  const effectiveUseExperienceInScore = canUseExperienceInScore && useExperienceInScore;

  // Check backend health
  useEffect(() => {
    let cancelled = false;

    checkHealth()
      .then((data) => {
        if (cancelled) return;
        setHealth(
          data.status === "ok"
            ? { status: "ok", data }
            : { status: "degraded", data }
        );
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof RankResumeApiError
            ? error.message
            : "Could not reach the server.";
        setHealth({ status: "unreachable", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function retryHealthCheck() {
    setHealth({ status: "loading" });
    checkHealth()
      .then((data) => {
        setHealth(
          data.status === "ok"
            ? { status: "ok", data }
            : { status: "degraded", data }
        );
      })
      .catch((error) => {
        const message =
          error instanceof RankResumeApiError
            ? error.message
            : "Could not reach the server.";
        setHealth({ status: "unreachable", message });
      });
  }

  // Sample data loaders
  function loadSampleJobDescription() {
    const file = new File([SAMPLE_JD_TEXT], "senior_backend_jd.txt", {
      type: "text/plain",
    });
    setJobDescription(file);
    setValidationErrors([]);
    setSubmitError(null);
  }

  function loadSampleCVs() {
    const cv1 = new File([SAMPLE_CV_1_TEXT], "Alex_Morgan_Senior_Python_CV.txt", {
      type: "text/plain",
    });
    const cv2 = new File([SAMPLE_CV_2_TEXT], "Samantha_Chen_FullStack_CV.txt", {
      type: "text/plain",
    });
    const cv3 = new File([SAMPLE_CV_3_TEXT], "Jordan_Lee_Frontend_CV.txt", {
      type: "text/plain",
    });
    setCvs([cv1, cv2, cv3]);
    setValidationErrors([]);
    setSubmitError(null);
  }

  function resetAll() {
    setJobDescription(null);
    setCvs([]);
    setSkills(["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"]);
    setExtractExperience(true);
    setUseExperienceInScore(false);
    setValidationErrors([]);
    setSubmitError(null);
    setResult(null);
  }

  const serviceReady = mounted && health.status === "ok";
  const analyzeDisabled = mounted ? (!serviceReady || isSubmitting) : false;

  async function handleAnalyze() {
    if (!serviceReady && mounted) return;
    if (isSubmitting) return;

    setValidationErrors([]);
    setSubmitError(null);

    const skillsInputString = skills.join(", ");
    const validation = validateRankRequest({
      jobDescription,
      cvs,
      skillsInput: skillsInputString,
      extractExperience,
      useExperienceInScore: effectiveUseExperienceInScore,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    if (!jobDescription) return;

    const normalizedSkills = validation.normalizedSkills;
    const effectiveExtractExperience =
      extractExperience || effectiveUseExperienceInScore;

    setIsSubmitting(true);
    try {
      const formData = buildRankRequestFormData({
        jobDescription,
        cvs,
        extractExperience: effectiveExtractExperience,
        requiredSkills: normalizedSkills,
        useExperienceInScore: effectiveUseExperienceInScore,
      });

      const response = await rankResumes(formData);
      setResult(response);
      setLastSubmittedSkills(normalizedSkills);
      setLastExtractExperience(effectiveExtractExperience);
      setLastUseExperienceInScore(effectiveUseExperienceInScore);

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      const message =
        error instanceof RankResumeApiError
          ? error.message
          : "An unexpected error occurred.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Keyboard shortcut (Ctrl + Enter / Cmd + Enter to Analyze)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!analyzeDisabled && jobDescription && cvs.length > 0) {
          e.preventDefault();
          handleAnalyze();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Navigation */}
      <Navbar health={health} onRetryHealth={retryHealthCheck} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        {/* Clean, Human-Focused Headline */}
        <section className="space-y-4 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-zinc-900 dark:text-white">
            Resume & Candidate Ranking
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
            Score and rank candidate resumes against your job description using semantic matching, keyword coverage, and skill tenure analysis.
          </p>

          {/* Workflow steps */}
          <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3 sm:gap-4">
            <div className="flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 font-mono text-sm font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                1
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Job Description
                </p>
                <p className="text-xs text-zinc-500">Benchmark role requirements</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 font-mono text-sm font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                2
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Candidate Resumes
                </p>
                <p className="text-xs text-zinc-500">Batch up to {MAX_CV_COUNT} resumes</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 font-mono text-sm font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                3
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Review & Rank
                </p>
                <p className="text-xs text-zinc-500">Compare scores and keywords</p>
              </div>
            </div>
          </div>
        </section>

        {/* Degraded / Unreachable API Notices */}
        {health.status === "degraded" && (
          <div
            role="alert"
            className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-sm">Model Initializing</p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200/90">
                The NLP language model is loading. Please wait a moment or click retry.
              </p>
            </div>
          </div>
        )}

        {health.status === "unreachable" && (
          <div
            role="alert"
            className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-semibold text-sm">Backend Service Offline</p>
                <p className="mt-0.5 text-xs text-red-800 dark:text-red-200/90">
                  {health.message} Ensure your backend server is running at{" "}
                  <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs dark:bg-red-900/50">
                    http://127.0.0.1:8000
                  </code>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={retryHealthCheck}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Workspace: File Uploads & Settings */}
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Panel 1: Job Description */}
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/70 sm:p-7">
              <SingleFileDropzone
                label="Benchmark Job Description"
                sublabel="The reference job description against which candidate CVs are scored."
                file={jobDescription}
                onFileSelect={(file) => {
                  setJobDescription(file);
                  setValidationErrors([]);
                  setSubmitError(null);
                }}
                onLoadSample={loadSampleJobDescription}
                sampleButtonText="Use Sample JD"
              />
            </div>

            {/* Panel 2: Candidate CVs */}
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/70 sm:p-7">
              <MultiFileDropzone
                label="Candidate Resumes"
                sublabel={`Upload up to ${MAX_CV_COUNT} resumes (.pdf, .docx, .txt, max ${MAX_FILE_SIZE_MB}MB each).`}
                files={cvs}
                onFilesChange={(newFiles) => {
                  setCvs(newFiles);
                  setValidationErrors([]);
                  setSubmitError(null);
                }}
                onLoadSamples={loadSampleCVs}
                sampleButtonText="Use 3 Sample CVs"
              />
            </div>
          </div>

          {/* Panel 3: Scoring Parameters */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/70 sm:p-7">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <Sliders className="size-4.5 text-zinc-500" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Experience & Skill Parameters
              </h3>
            </div>

            <div className="mt-6 space-y-6">
              {/* Toggle 1: Extract Experience */}
              <label className="flex cursor-pointer items-start gap-3.5">
                <input
                  type="checkbox"
                  checked={extractExperience}
                  onChange={(e) => setExtractExperience(e.target.checked)}
                  className="mt-0.5 size-4.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800"
                />
                <div>
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Extract skill experience timeline
                  </span>
                  <span className="block text-xs text-zinc-500 mt-0.5">
                    Analyzes duration phrases and employment history dates to estimate tenure for target skills.
                  </span>
                </div>
              </label>

              {/* Skills Tags Manager */}
              {(extractExperience || useExperienceInScore) && (
                <div className="ml-8 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Target Skills for Experience Analysis
                    </label>
                    <span className="font-mono text-xs text-zinc-500">
                      {skills.length} tracked
                    </span>
                  </div>

                  <SkillsInput skills={skills} onChange={setSkills} />
                </div>
              )}

              {/* Toggle 2: Factor Experience in Score */}
              <label
                className={`flex items-start gap-3.5 ${
                  canUseExperienceInScore
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={effectiveUseExperienceInScore}
                  disabled={mounted ? !canUseExperienceInScore : false}
                  onChange={(e) => setUseExperienceInScore(e.target.checked)}
                  className="mt-0.5 size-4.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800"
                />
                <div>
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Blend skill experience into final ranking score
                  </span>
                  <span className="block text-xs text-zinc-500 mt-0.5">
                    Factors candidate experience into the match score alongside semantic similarity and keyword coverage.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Validation Alert Box */}
          {validationErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50/90 p-5 text-sm dark:border-red-900/50 dark:bg-red-950/30 animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-2.5 text-red-900 dark:text-red-200">
                <AlertCircle className="size-5 shrink-0 text-red-600 dark:text-red-400" />
                <p className="font-bold text-sm">Please resolve the following before proceeding:</p>
              </div>
              <ul className="mt-2.5 list-inside list-disc space-y-1 text-xs sm:text-sm text-red-800 dark:text-red-300">
                {validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Submit Error Alert */}
          {submitError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/90 p-5 text-sm dark:border-red-900/50 dark:bg-red-950/30"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
                <div>
                  <p className="font-bold text-sm text-red-900 dark:text-red-200">Analysis Error</p>
                  <p className="mt-0.5 text-xs text-red-800 dark:text-red-300">{submitError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzeDisabled}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </button>
            </div>
          )}

          {/* Action Control Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500">
              <span className="hidden sm:inline">Shortcut:</span>
              <kbd className="rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                Ctrl + Enter
              </kbd>
              <span>to run ranking</span>
            </div>

            <div className="flex items-center gap-3">
              {(jobDescription || cvs.length > 0 || result) && (
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all"
                >
                  <RotateCcw className="size-4" />
                  <span>Reset</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzeDisabled}
                suppressHydrationWarning
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-zinc-900 px-7 py-2.5 text-sm font-bold text-white shadow-xs transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <Zap className="size-4 fill-current" />
                <span>Run Candidate Ranking</span>
              </button>
            </div>
          </div>
        </section>

        {/* Animated Processing State */}
        {isSubmitting && <ProcessingStatus />}

        {/* Results Section */}
        {result && (
          <div ref={resultsRef} className="space-y-6 pt-4">
            <FileErrorsPanel errors={result.file_errors} />
            <RankingResults
              result={result}
              requiredSkills={lastSubmittedSkills}
              showExperienceBreakdown={lastExtractExperience}
              showExperienceScore={lastUseExperienceInScore}
            />
          </div>
        )}
      </main>

      {/* Clean Footer */}
      <Footer />
    </div>
  );
}
