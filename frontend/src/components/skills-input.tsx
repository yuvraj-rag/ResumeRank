"use client";

import { Check, Plus, Tag, X } from "lucide-react";
import React, { useState } from "react";

const SUGGESTED_SKILLS = [
  "Python",
  "React",
  "TypeScript",
  "FastAPI",
  "PostgreSQL",
  "Docker",
  "AWS",
  "REST APIs",
  "Git",
  "Machine Learning",
];

interface SkillsInputProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
}

export function SkillsInput({ skills, onChange, disabled }: SkillsInputProps) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCurrentSkill();
    } else if (e.key === "Backspace" && inputValue === "" && skills.length > 0) {
      removeSkill(skills.length - 1);
    }
  }

  function addCurrentSkill() {
    const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
    if (!trimmed) return;

    // Support comma-delimited pasting
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const updated = [...skills];
    for (const part of parts) {
      if (!updated.some((s) => s.toLowerCase() === part.toLowerCase())) {
        updated.push(part);
      }
    }

    onChange(updated);
    setInputValue("");
  }

  function removeSkill(index: number) {
    onChange(skills.filter((_, i) => i !== index));
  }

  function toggleSuggested(skill: string) {
    const isSelected = skills.some(
      (s) => s.toLowerCase() === skill.toLowerCase()
    );
    if (isSelected) {
      onChange(skills.filter((s) => s.toLowerCase() !== skill.toLowerCase()));
    } else {
      onChange([...skills, skill]);
    }
  }

  return (
    <div className="space-y-3.5">
      {/* Interactive Tag Input Box */}
      <div
        className={`flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2.5 shadow-2xs transition-all dark:bg-zinc-900 ${
          disabled
            ? "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
            : "border-zinc-300 focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:border-zinc-700 dark:focus-within:border-zinc-400 dark:focus-within:ring-zinc-100/10"
        }`}
      >
        {skills.map((skill, index) => (
          <span
            key={`${skill}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-100"
          >
            <Tag className="size-3.5 text-zinc-500" />
            <span>{skill}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeSkill(index)}
                className="cursor-pointer rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 transition-colors"
                aria-label={`Remove skill ${skill}`}
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addCurrentSkill}
          placeholder={
            skills.length === 0
              ? "Type a skill and press Enter or comma (e.g. Python, React)..."
              : "Add another skill..."
          }
          className="min-w-[200px] flex-1 bg-transparent px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      {/* Suggested skill chips */}
      {!disabled && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">
            Suggested skills (click to toggle):
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_SKILLS.map((skill) => {
              const isSelected = skills.some(
                (s) => s.toLowerCase() === skill.toLowerCase()
              );
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSuggested(skill)}
                  aria-pressed={isSelected}
                  className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-all active:scale-[0.97] ${
                    isSelected
                      ? "border-zinc-300 bg-zinc-100 text-zinc-900 font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                  }`}
                >
                  {isSelected ? (
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                  <span>{skill}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
