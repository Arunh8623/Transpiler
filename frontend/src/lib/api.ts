import type {
  Generation,
  Project,
  ProjectCreateInput,
  Render,
  SettingsRead,
  SystemStatus,
} from "@/types/api";

const BASE = "/api";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Projects
  listProjects: (params?: { q?: string; favorite?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.favorite !== undefined) search.set("favorite", String(params.favorite));
    const qs = search.toString();
    return request<Project[]>(`/projects${qs ? `?${qs}` : ""}`);
  },
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (payload: ProjectCreateInput) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (id: string, payload: Partial<Pick<Project, "title" | "favorite">>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProject: (id: string) => request<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  duplicateProject: (id: string) => request<Project>(`/projects/${id}/duplicate`, { method: "POST" }),

  // Generation
  generate: (projectId: string) =>
    request<Generation>(`/projects/${projectId}/generation`, { method: "POST" }),
  listGenerations: (projectId: string) =>
    request<Generation[]>(`/projects/${projectId}/generation`),
  repair: (projectId: string, errorOutput: string) =>
    request<Generation>(`/projects/${projectId}/generation/repair`, {
      method: "POST",
      body: JSON.stringify({ error_output: errorOutput }),
    }),

  // Render
  startRender: (projectId: string) =>
    request<Render>(`/projects/${projectId}/render`, { method: "POST" }),
  cancelRender: (projectId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/render/cancel`, { method: "POST" }),
  listRenders: (projectId: string) => request<Render[]>(`/projects/${projectId}/render`),
  latestRender: (projectId: string) => request<Render | null>(`/projects/${projectId}/render/latest`),
  videoUrl: (projectId: string, renderId: string) => `${BASE}/projects/${projectId}/render/${renderId}/video`,
  logsUrl: (projectId: string, renderId: string) => `${BASE}/projects/${projectId}/render/${renderId}/logs`,
  thumbnailUrl: (projectId: string, renderId: string) =>
    `${BASE}/projects/${projectId}/render/${renderId}/thumbnail`,
  renderProgress: (projectId: string, renderId: string) =>
    request<{ percent: number | null; tail: string }>(`/projects/${projectId}/render/${renderId}/progress`),

  // System & settings
  systemStatus: () => request<SystemStatus>("/system/status"),
  getSettings: () => request<SettingsRead>("/settings"),
  updateSettings: (payload: { gemini_api_key?: string; gemini_model?: string }) =>
    request<SettingsRead>("/settings", { method: "PUT", body: JSON.stringify(payload) }),
};

export { ApiError };
