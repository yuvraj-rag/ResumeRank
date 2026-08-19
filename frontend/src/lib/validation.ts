import {
  ACCEPTED_EXTENSIONS,
  MAX_CV_COUNT,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
} from "@/lib/config";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalizedSkills: string[];
}

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(
  file: File,
  label: string,
  errors: string[]
): void {
  if (!hasAcceptedExtension(file.name)) {
    errors.push(
      `${label} "${file.name}" has an unsupported type. Accepted: .txt, .pdf, .docx`
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(
      `${label} "${file.name}" is ${formatFileSize(file.size)}, which exceeds the ${MAX_FILE_SIZE_MB} MB limit`
    );
  }
}

export function parseSkillsInput(skillsInput: string): string[] {
  return skillsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateRankRequest(options: {
  jobDescription: File | null;
  cvs: File[];
  skillsInput: string;
  extractExperience: boolean;
  useExperienceInScore: boolean;
}): ValidationResult {
  const errors: string[] = [];

  if (!options.jobDescription) {
    errors.push("Please upload a job description file.");
  } else {
    validateFile(options.jobDescription, "Job description", errors);
  }

  if (options.cvs.length === 0) {
    errors.push("Please upload at least one CV.");
  }

  if (options.cvs.length > MAX_CV_COUNT) {
    errors.push(
      `Too many CVs (${options.cvs.length}). Maximum allowed is ${MAX_CV_COUNT}.`
    );
  }

  options.cvs.forEach((file) => validateFile(file, "CV", errors));

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const file of options.cvs) {
    if (seen.has(file.name)) {
      duplicates.push(file.name);
    }
    seen.add(file.name);
  }
  if (duplicates.length > 0) {
    const unique = [...new Set(duplicates)];
    errors.push(
      `Duplicate CV filenames detected: ${unique.join(", ")}. Each CV must have a unique filename.`
    );
  }

  const normalizedSkills = parseSkillsInput(options.skillsInput);

  if (
    options.extractExperience &&
    normalizedSkills.length === 0 &&
    options.skillsInput.trim().length > 0
  ) {
    errors.push(
      "Required skills must be a comma-separated list with no empty entries."
    );
  }

  return { valid: errors.length === 0, errors, normalizedSkills };
}
