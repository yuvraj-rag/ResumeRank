"use client";

import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_ACCEPT, MAX_CV_COUNT, MAX_FILE_SIZE_MB } from "@/lib/config";
import {
  FileText,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import React, { useRef, useState } from "react";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const ext = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toUpperCase();
  return ext || "FILE";
}

interface SingleFileDropzoneProps {
  label: string;
  sublabel: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  onLoadSample?: () => void;
  sampleButtonText?: string;
}

export function SingleFileDropzone({
  label,
  sublabel,
  file,
  onFileSelect,
  onLoadSample,
  sampleButtonText = "Load Sample",
}: SingleFileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      onFileSelect(droppedFiles[0]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    onFileSelect(selected);
    if (e.target) {
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {label}
          </label>
          <p className="text-sm text-zinc-500">{sublabel}</p>
        </div>
        {onLoadSample && !file && (
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors"
          >
            <Sparkles className="size-3.5" />
            <span>{sampleButtonText}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_ACCEPT}
        onChange={handleChange}
        className="sr-only"
        id="single-file-upload"
      />

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`group flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
            isDragOver
              ? "border-zinc-900 bg-zinc-100/90 scale-[0.99] dark:border-zinc-100 dark:bg-zinc-800/90"
              : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/60"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-xs transition-transform duration-200 group-hover:scale-110 dark:bg-zinc-800 dark:text-zinc-200">
            <UploadCloud className="size-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Upload Job Description
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Drag & drop or browse ({ACCEPTED_EXTENSIONS.join(", ")}, max {MAX_FILE_SIZE_MB}MB)
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90 animate-in fade-in duration-150">
          <div className="flex items-center gap-3.5 overflow-hidden">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {getFileExtension(file.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {file.name}
              </p>
              <p className="text-xs text-zinc-500">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onFileSelect(null)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-label="Remove job description"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MultiFileDropzoneProps {
  label: string;
  sublabel: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onLoadSamples?: () => void;
  sampleButtonText?: string;
}

export function MultiFileDropzone({
  label,
  sublabel,
  files,
  onFilesChange,
  onLoadSamples,
  sampleButtonText = "Load Sample CVs",
}: MultiFileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > 0) {
      const newFiles = Array.from(dropped);
      const combined = [...files, ...newFiles].slice(0, MAX_CV_COUNT);
      onFilesChange(combined);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (selected && selected.length > 0) {
      const newFiles = Array.from(selected);
      const combined = [...files, ...newFiles].slice(0, MAX_CV_COUNT);
      onFilesChange(combined);
    }
    if (e.target) {
      e.target.value = "";
    }
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  function clearAll() {
    onFilesChange([]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {label}
          </label>
          <p className="text-sm text-zinc-500">{sublabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {onLoadSamples && files.length === 0 && (
            <button
              type="button"
              onClick={onLoadSamples}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors"
            >
              <Sparkles className="size-3.5" />
              <span>{sampleButtonText}</span>
            </button>
          )}
          {files.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
            >
              <Trash2 className="size-3.5" />
              <span>Clear all</span>
            </button>
          )}
          <span
            className={`rounded-lg border px-2.5 py-1 font-mono text-xs tabular-nums ${
              files.length >= MAX_CV_COUNT
                ? "border-amber-300 bg-amber-50 font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {files.length} / {MAX_CV_COUNT}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_ACCEPT}
        multiple
        onChange={handleChange}
        className="sr-only"
        id="multi-file-upload"
      />

      {/* Dropzone container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`group flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
          isDragOver
            ? "border-zinc-900 bg-zinc-100/90 scale-[0.99] dark:border-zinc-100 dark:bg-zinc-800/90"
            : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/60"
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-xs transition-transform duration-200 group-hover:scale-110 dark:bg-zinc-800 dark:text-zinc-200">
          <Users className="size-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Upload Candidate Resumes
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Drag & drop multiple files (.pdf, .docx, .txt)
        </p>
      </div>

      {/* Uploaded CV file chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="inline-flex max-w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/90 px-3 py-1.5 text-xs transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/80 dark:hover:border-zinc-700"
            >
              <FileText className="size-4 shrink-0 text-zinc-500" />
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100 max-w-[180px] sm:max-w-[220px]">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-zinc-400">
                ({formatFileSize(file.size)})
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
