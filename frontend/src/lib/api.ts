import {
  HEALTH_TIMEOUT_MS,
  RANK_TIMEOUT_MS,
} from "@/lib/config";
import type {
  ApiErrorResponse,
  ApiValidationErrorResponse,
  HealthResponse,
  RankingResponse,
} from "@/types/rankresume";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined");
}

export type ApiErrorKind =
  | "bad_request"
  | "validation"
  | "server"
  | "network";

export class RankResumeApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;

  constructor(message: string, status: number, kind: ApiErrorKind) {
    super(message);
    this.name = "RankResumeApiError";
    this.status = status;
    this.kind = kind;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RankResumeApiError(
        "The request timed out. Please try again.",
        0,
        "network"
      );
    }
    throw new RankResumeApiError(
      "Could not reach the server. Check your connection and that the API is running.",
      0,
      "network"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseErrorResponse(response: Response): Promise<never> {
  const { status } = response;

  try {
    const body: unknown = await response.json();

    if (status === 422) {
      console.error("RankResume validation error:", body);
      throw new RankResumeApiError(
        "Something went wrong building the request. Please refresh and try again.",
        status,
        "validation"
      );
    }

    if (status === 400 || status === 500) {
      const detail = (body as ApiErrorResponse).detail;
      throw new RankResumeApiError(
        detail ||
          (status === 500
            ? "The server ran into a problem — please try again."
            : "The request could not be processed."),
        status,
        status === 500 ? "server" : "bad_request"
      );
    }
  } catch (error) {
    if (error instanceof RankResumeApiError) {
      throw error;
    }
  }

  throw new RankResumeApiError(
    `Unexpected error (${status}). Please try again.`,
    status,
    "server"
  );
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/health`,
    { method: "GET" },
    HEALTH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new RankResumeApiError(
      "Health check failed.",
      response.status,
      "network"
    );
  }

  return response.json() as Promise<HealthResponse>;
}

export async function rankResumes(
  formData: FormData
): Promise<RankingResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/rank`,
    { method: "POST", body: formData },
    RANK_TIMEOUT_MS
  );

  if (!response.ok) {
    return parseErrorResponse(response);
  }

  return response.json() as Promise<RankingResponse>;
}

export type { ApiValidationErrorResponse };
