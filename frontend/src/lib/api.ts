import {
  HEALTH_TIMEOUT_MS,
  HISTORY_TIMEOUT_MS,
  RANK_TIMEOUT_MS,
} from "@/lib/config";
import type {
  ApiErrorResponse,
  ApiValidationErrorResponse,
  HealthResponse,
  HistoryListResponse,
  HistoryRunDetail,
  RankingResponse,
  SignedUrlResponse,
} from "@/types/rankresume";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export type ApiErrorKind =
  | "bad_request"
  | "unauthorized"
  | "not_found"
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
      "Unable to connect to the server. Please check your internet connection and try again.",
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

    if (status === 401) {
      throw new RankResumeApiError(
        "Your session has expired or is invalid. Please sign in again.",
        status,
        "unauthorized"
      );
    }

    if (status === 404) {
      const detail = (body as ApiErrorResponse).detail;
      throw new RankResumeApiError(
        detail || "The requested item was not found.",
        status,
        "not_found"
      );
    }

    if (status === 422) {
      throw new RankResumeApiError(
        "The request could not be processed. Please check your inputs and try again.",
        status,
        "validation"
      );
    }

    if (status === 400 || status === 500) {
      const detail = (body as ApiErrorResponse).detail;
      throw new RankResumeApiError(
        detail ||
          (status === 500
            ? "An error occurred while processing your request. Please try again later."
            : "The request could not be processed. Please verify the uploaded files and try again."),
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
    "An unexpected error occurred. Please try again.",
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
      "Service is currently unavailable.",
      response.status,
      "network"
    );
  }

  return response.json() as Promise<HealthResponse>;
}

export async function rankResumes(
  formData: FormData,
  token?: string
): Promise<RankingResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/rank`,
    {
      method: "POST",
      headers,
      body: formData,
    },
    RANK_TIMEOUT_MS
  );

  if (!response.ok) {
    return parseErrorResponse(response);
  }

  return response.json() as Promise<RankingResponse>;
}

export async function getHistory(token: string): Promise<HistoryListResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/history`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    HISTORY_TIMEOUT_MS
  );

  if (!response.ok) {
    return parseErrorResponse(response);
  }

  return response.json() as Promise<HistoryListResponse>;
}

export async function getHistoryRun(
  runId: string,
  token: string
): Promise<HistoryRunDetail> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/history/${runId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    HISTORY_TIMEOUT_MS
  );

  if (!response.ok) {
    return parseErrorResponse(response);
  }

  return response.json() as Promise<HistoryRunDetail>;
}

export async function deleteHistoryRun(
  runId: string,
  token: string
): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/history/${runId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    HISTORY_TIMEOUT_MS
  );

  if (!response.ok) {
    return parseErrorResponse(response);
  }
}

export async function getHistoryFileUrl(
  runId: string,
  filename: string,
  token: string
): Promise<SignedUrlResponse> {
  const encodedFilename = encodeURIComponent(filename);
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/history/${runId}/files/${encodedFilename}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    HISTORY_TIMEOUT_MS
  );

  if (!response.ok) {
    return parseErrorResponse(response);
  }

  return response.json() as Promise<SignedUrlResponse>;
}

export type { ApiValidationErrorResponse };
