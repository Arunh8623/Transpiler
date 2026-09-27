export type Role =
  | "high_school_student"
  | "college_student"
  | "high_school_teacher"
  | "college_professor"
  | "general_learner";

export type Mode =
  | "explain_concept"
  | "graph_2d"
  | "model_3d"
  | "solve_doubt"
  | "teacher_lesson";

export type QualityPreset = "draft" | "standard" | "high" | "cinematic" | "custom";
export type AspectRatio = "16:9" | "9:16" | "1:1";

export type ProjectStatus =
  | "draft"
  | "planning"
  | "generating_code"
  | "validating"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export type RenderStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface Project {
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  audience: Role;
  status: ProjectStatus;
  quality_preset: QualityPreset;
  resolution: string;
  fps: number;
  aspect_ratio: AspectRatio;
  duration_target: number;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  prompt: string;
  mode: Mode;
  audience: Role;
  quality_preset: QualityPreset;
  aspect_ratio: AspectRatio;
  duration_target: number;
  background_color?: string;
  renderer?: "cairo" | "opengl";
  camera_style?: string | null;
}

export interface SceneStep {
  beat: string;
  description: string;
  duration_estimate?: number;
}

export interface Generation {
  id: string;
  project_id: string;
  scene_plan_json: string;
  generated_manim_code: string;
  notes_markdown: string;
  gemini_model: string;
  version: number;
  created_at: string;
}

export interface Render {
  id: string;
  project_id: string;
  status: RenderStatus;
  output_video_path: string | null;
  thumbnail_path: string | null;
  logs_path: string | null;
  error_message: string | null;
  render_time_seconds: number | null;
  created_at: string;
}

export interface SystemStatus {
  gemini_key_configured: boolean;
  manim_installed: boolean;
  manim_version: string | null;
  ffmpeg_installed: boolean;
  ffmpeg_version: string | null;
  latex_installed: boolean;
  latex_version: string | null;
}

export interface SettingsRead {
  gemini_model: string;
  output_dir: string;
  gemini_key_configured: boolean;
}
