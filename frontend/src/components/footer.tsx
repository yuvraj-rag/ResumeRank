"use client";

import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#232D36] shadow-2xs">
            <Image
              src="/favicon.svg"
              alt="RankResume Logo"
              width={28}
              height={28}
              className="size-7 object-contain"
            />
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            RankResume
          </span>
          <span className="text-xs text-zinc-400">— Automated resume ranking and candidate scoring</span>
        </div>

        <div className="text-xs text-zinc-500">
          <span>&copy; {new Date().getFullYear()} RankResume</span>
        </div>
      </div>
    </footer>
  );
}
