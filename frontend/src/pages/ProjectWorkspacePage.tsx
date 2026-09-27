import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Loader2, Play, RefreshCw, Square, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/select-tabs";
import { api } from "@/lib/api";
import { AUDIENCE_LABELS, MODE_LABELS, STATUS_LABELS } from "@/lib/utils";

const STAGES = ["planning", "generating_code", "validating", "rendering", "completed"];

function StageTracker({ status, percent }: { status: string; percent: number | null }) {
  const currentIndex = STAGES.indexOf(status);
  const failed = status === "failed";
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        {STAGES.map((stage, i) => {
          const reached = currentIndex >= i && !failed;
          const isCurrent = currentIndex === i;
          return (
            <div key={stage} className="flex items-center gap-2 flex-1">
              <div
                className={`h-2 flex-1 rounded-full transition-colors ${
                  failed && i <= currentIndex
                    ? "bg-red-500/60"
                    : reached
                    ? "bg-accent-indigo"
                    : "bg-border"
                } ${isCurrent ? "animate-pulse" : ""}`}
              />
            </div>
          );
        })}
      </div>
      {status === "rendering" && (
        <p className="text-xs text-muted mt-2">
          {percent !== null ? `Rendering… ${Math.round(percent)}% of current animation` : "Rendering… (waiting for Manim's first progress update)"}
        </p>
      )}
    </div>
  );
}

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [repairError, setRepairError] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId,
    refetchInterval: (query) =>
      ["planning", "generating_code", "validating", "rendering"].includes(query.state.data?.status ?? "")
        ? 2000
        : false,
  });

  const generationsQuery = useQuery({
    queryKey: ["generations", projectId],
    queryFn: () => api.listGenerations(projectId!),
    enabled: !!projectId,
  });

  const latestRenderQuery = useQuery({
    queryKey: ["render", projectId],
    queryFn: () => api.latestRender(projectId!),
    enabled: !!projectId,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });

  const render = latestRenderQuery.data;

  // Polls the render's own log file for a live percent-complete estimate
  // and log tail. Only active while a render is actually running, so it's
  // a no-op the rest of the time.
  const progressQuery = useQuery({
    queryKey: ["render-progress", render?.id],
    queryFn: () => api.renderProgress(projectId!, render!.id),
    enabled: !!projectId && !!render?.id && render.status === "running",
    refetchInterval: (query) => (query.state.data !== undefined && render?.status === "running" ? 1500 : false),
  });

  const latestGeneration = generationsQuery.data?.[0];
  const project = projectQuery.data;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["generations", projectId] });
    queryClient.invalidateQueries({ queryKey: ["render", projectId] });
  };

  const generateMutation = useMutation({
    mutationFn: () => api.generate(projectId!),
    onSuccess: invalidateAll,
    onError: (error) => console.error("Generation failed:", error),
  });

  const renderMutation = useMutation({
    mutationFn: () => api.startRender(projectId!),
    onSuccess: invalidateAll,
    onError: (error) => console.error("Failed to start render:", error),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelRender(projectId!),
    onSuccess: invalidateAll,
  });

  const repairMutation = useMutation({
    mutationFn: (errorOutput: string) => api.repair(projectId!, errorOutput),
    onSuccess: invalidateAll,
  });

  if (!project) {
    return (
      <div className="p-10 text-muted flex items-center gap-2">
        <Loader2 className="animate-spin" size={16} /> Loading project…
      </div>
    );
  }

  const isBusy = ["planning", "generating_code", "validating", "rendering"].includes(project.status);

  return (
    <div className="px-10 py-10 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <div className="flex gap-2 mt-2">
            <Badge>{MODE_LABELS[project.mode]}</Badge>
            <Badge variant="default">{AUDIENCE_LABELS[project.audience]}</Badge>
            <Badge
              variant={project.status === "completed" ? "success" : project.status === "failed" ? "danger" : "warning"}
            >
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {!latestGeneration ? (
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
              Generate with Gemini
            </Button>
          ) : project.status === "rendering" ? (
            <Button variant="destructive" onClick={() => cancelMutation.mutate()}>
              <Square size={16} /> Stop
            </Button>
          ) : (
            <Button onClick={() => renderMutation.mutate()} disabled={renderMutation.isPending}>
              {renderMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              Render
            </Button>
          )}
        </div>
      </div>

      {(isBusy || project.status === "failed") && (
        <StageTracker status={project.status} percent={progressQuery.data?.percent ?? null} />
      )}

      {(generateMutation.isError || renderMutation.isError) && (
        <Card className="mb-6 border-red-500/40">
          <p className="text-sm font-medium text-red-400 mb-1">
            {generateMutation.isError ? "Generation failed" : "Couldn't start the render"}
          </p>
          <p className="text-sm text-red-300/90">
            {((generateMutation.error || renderMutation.error) as Error)?.message}
          </p>
        </Card>
      )}

      <Tabs
        tabs={[
          { id: "preview", label: "Preview" },
          { id: "notes", label: "Notes" },
          { id: "code", label: "Manim Code" },
          { id: "logs", label: "Render Logs" },
          { id: "details", label: "Project Details" },
        ]}
      >
        {(active) => {
          if (active === "preview") {
            return (
              <Card>
                {render?.status === "succeeded" && render.output_video_path ? (
                  <div className="space-y-4">
                    <video
                      controls
                      className="w-full rounded-xl border border-border"
                      src={api.videoUrl(projectId!, render.id)}
                    />
                    <div className="flex gap-2">
                      <a href={api.videoUrl(projectId!, render.id)} download>
                        <Button variant="outline" size="sm">
                          <Download size={14} /> Download MP4
                        </Button>
                      </a>
                    </div>
                  </div>
                ) : render?.status === "running" ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted">
                      Rendering in progress
                      {progressQuery.data?.percent !== undefined && progressQuery.data?.percent !== null
                        ? ` — ${Math.round(progressQuery.data.percent)}% of the current animation`
                        : "…"}
                      . Check the Render Logs tab for live output.
                    </p>
                  </div>
                ) : render?.status === "failed" || render?.status === "timed_out" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-red-400">{render.error_message ?? "Render failed."}</p>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const logs = render.logs_path ? await fetch(api.logsUrl(projectId!, render.id)).then((r) => r.text()) : "";
                        setRepairError(logs);
                        repairMutation.mutate(logs);
                      }}
                      disabled={repairMutation.isPending}
                    >
                      {repairMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                      Repair with AI
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    No render yet. Generate code, then click Render to produce a preview.
                  </p>
                )}
              </Card>
            );
          }
          if (active === "notes") {
            return (
              <Card className="prose prose-invert max-w-none prose-sm">
                {latestGeneration ? (
                  <ReactMarkdown>{latestGeneration.notes_markdown}</ReactMarkdown>
                ) : (
                  <p className="text-sm text-muted">Notes appear here after generation.</p>
                )}
              </Card>
            );
          }
          if (active === "code") {
            return (
              <Card>
                {latestGeneration ? (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(latestGeneration.generated_manim_code)}
                      >
                        <Copy size={14} /> Copy
                      </Button>
                    </div>
                    <pre className="text-xs font-mono bg-black/40 rounded-xl p-4 overflow-x-auto max-h-[560px] overflow-y-auto">
                      {latestGeneration.generated_manim_code}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted">Generated Manim source will appear here.</p>
                )}
              </Card>
            );
          }
          if (active === "logs") {
            return (
              <Card>
                {render?.logs_path ? (
                  <RenderLogsViewer projectId={projectId!} renderId={render.id} isRunning={render.status === "running"} />
                ) : (
                  <p className="text-sm text-muted">No render logs yet - start a render to see live output here.</p>
                )}
              </Card>
            );
          }
          return (
            <Card className="text-sm space-y-2">
              <Row label="Resolution" value={project.resolution} />
              <Row label="FPS" value={String(project.fps)} />
              <Row label="Aspect ratio" value={project.aspect_ratio} />
              <Row label="Target duration" value={`${project.duration_target}s`} />
              <Row label="Quality preset" value={project.quality_preset} />
              <Row label="Created" value={new Date(project.created_at).toLocaleString()} />
            </Card>
          );
        }}
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function RenderLogsViewer({
  projectId,
  renderId,
  isRunning,
}: {
  projectId: string;
  renderId: string;
  isRunning: boolean;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const { data } = useQuery({
    queryKey: ["logs", renderId],
    queryFn: () => fetch(api.logsUrl(projectId, renderId)).then((r) => r.text()),
    // Tails the log file live while the render is in progress. This is the
    // piece that was completely missing before: logs_path used to only be
    // set on the Render row after the whole render finished, so this query
    // never had anything to fetch until it was already too late to be useful.
    refetchInterval: isRunning ? 1500 : false,
  });

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [data]);

  return (
    <pre
      ref={preRef}
      className="text-xs font-mono bg-black/40 rounded-xl p-4 overflow-x-auto max-h-[560px] overflow-y-auto whitespace-pre-wrap"
    >
      {data || (isRunning ? "Waiting for the first log output from Manim…" : "No output.")}
    </pre>
  );
}
