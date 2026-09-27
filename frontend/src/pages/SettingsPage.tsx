import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FolderOpen, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// True only when this page is running inside the Tauri desktop shell
// (frontend/src-tauri), never in a plain browser tab - so the button
// below simply doesn't render in normal dev-mode browser usage.
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function openOutputFolder(path: string) {
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(path);
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const statusQuery = useQuery({ queryKey: ["system-status"], queryFn: api.systemStatus });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateSettings({
        gemini_api_key: apiKey || undefined,
        gemini_model: model || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      setApiKey("");
    },
  });

  return (
    <div className="px-10 py-10 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <h2 className="font-medium mb-1">Gemini API key</h2>
        <p className="text-xs text-muted mb-3">
          Stored only in your local backend .env file. Never sent to or stored by the frontend.
        </p>
        <div className="flex gap-2 items-center mb-4">
          <span className="text-sm">Status:</span>
          {settingsQuery.data?.gemini_key_configured ? (
            <Badge variant="success">Configured</Badge>
          ) : (
            <Badge variant="warning">Not set</Badge>
          )}
        </div>
        <label className="text-sm font-medium mb-1 block">API key</label>
        <Input
          type="password"
          placeholder="Paste your Gemini API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mb-3"
        />
        <label className="text-sm font-medium mb-1 block">Model</label>
        <Input
          placeholder={settingsQuery.data?.gemini_model ?? "gemini-3-flash-preview"}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mb-4 max-w-sm"
        />
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Save settings
        </Button>
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Local tool checks</h2>
        <ToolRow ok={!!statusQuery.data?.manim_installed} label="Manim" version={statusQuery.data?.manim_version} />
        <ToolRow ok={!!statusQuery.data?.ffmpeg_installed} label="FFmpeg" version={statusQuery.data?.ffmpeg_version} />
        <ToolRow ok={!!statusQuery.data?.latex_installed} label="LaTeX" version={statusQuery.data?.latex_version} />
        <p className="text-xs text-muted mt-3">
          If a tool shows as missing, install it and add it to your PATH, then reload this page.
        </p>
      </Card>

      <Card>
        <h2 className="font-medium mb-1">Output folder</h2>
        <p className="text-xs text-muted mb-2">
          Projects, generated code, and rendered videos are stored under:
        </p>
        <code className="text-xs bg-black/40 rounded-lg px-2 py-1 block mb-3">
          {settingsQuery.data?.output_dir}
        </code>
        {isTauri ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => settingsQuery.data && openOutputFolder(settingsQuery.data.output_dir)}
          >
            <FolderOpen size={14} /> Open output folder
          </Button>
        ) : (
          <p className="text-xs text-muted">
            Open this path directly in File Explorer — the "Open output folder" button is only
            available in the Transpiler desktop app.
          </p>
        )}
      </Card>
    </div>
  );
}

function ToolRow({ ok, label, version }: { ok: boolean; label: string; version?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 size={16} className="text-accent-emerald" /> : <XCircle size={16} className="text-red-400" />}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-xs text-muted">{ok ? version || "Detected" : "Not found on PATH"}</span>
    </div>
  );
}
