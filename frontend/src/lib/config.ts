export const ACCEPTED_EXTENSIONS = [".txt", ".pdf", ".docx"] as const;

export const ACCEPTED_MIME_ACCEPT = ".txt,.pdf,.docx";

export const MAX_FILE_SIZE_MB = Number(
  process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? 10
);

export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const MAX_CV_COUNT = Number(process.env.NEXT_PUBLIC_MAX_CV_COUNT ?? 20);

export const RANK_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_RANK_TIMEOUT_MS ?? 60_000
);

export const HEALTH_TIMEOUT_MS = 5_000;
