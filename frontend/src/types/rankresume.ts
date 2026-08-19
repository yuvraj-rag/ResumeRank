export interface HealthResponse {
  status: "ok" | "degraded";
  spacy_model_loaded: boolean;
}

export interface CVRankingEntry {
  cv: string;
  score: number;
  semantic_score: number;
  keyword_coverage: number;
  experience_score: number | null;
  matched: string[];
  missing: string[];
}

export interface ExperienceDetail {
  years: number;
  method: "explicit_window" | "job_block_inference" | "cross_validated";
}

export interface FileError {
  filename: string;
  error: string;
}

export interface RankingResponse {
  jd_filename: string;
  rankings: CVRankingEntry[];
  experience: Record<string, Record<string, ExperienceDetail>>;
  file_errors: FileError[];
}

export interface RankRequestOptions {
  jobDescription: File;
  cvs: File[];
  extractExperience: boolean;
  requiredSkills: string[];
  useExperienceInScore: boolean;
}

export interface ApiErrorResponse {
  detail: string;
}

export interface ApiValidationErrorResponse {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}

export function buildRankRequestFormData(options: RankRequestOptions): FormData {
  const formData = new FormData();
  formData.append("job_description", options.jobDescription);
  options.cvs.forEach((file) => formData.append("cvs", file));
  formData.append("extract_experience", String(options.extractExperience));

  const skills = options.requiredSkills.map((s) => s.trim()).filter(Boolean);
  if (skills.length > 0) {
    formData.append("required_skills", skills.join(","));
  }

  formData.append(
    "use_experience_in_score",
    String(options.useExperienceInScore)
  );
  return formData;
}
