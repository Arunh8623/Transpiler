import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MODE_LABELS: Record<string, string> = {
  explain_concept: "Explain a Concept",
  graph_2d: "2D Graph & Curve",
  model_3d: "3D Model",
  solve_doubt: "Solve a Doubt",
  teacher_lesson: "Teacher Lesson Generator",
};

export const AUDIENCE_LABELS: Record<string, string> = {
  high_school_student: "High School Student",
  college_student: "College Student",
  high_school_teacher: "High School Teacher",
  college_professor: "College Professor",
  general_learner: "General Learner",
};

export const QUALITY_LABELS: Record<string, string> = {
  draft: "Draft — 480p / 24fps",
  standard: "Standard — 720p / 30fps",
  high: "High — 1080p / 30fps",
  cinematic: "Cinematic — 1080p / 60fps",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  planning: "Planning",
  generating_code: "Generating Code",
  validating: "Validating",
  rendering: "Rendering",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};
