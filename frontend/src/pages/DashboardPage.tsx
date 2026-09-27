import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { HeroScene } from "@/components/layout/HeroScene";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { MODE_LABELS, STATUS_LABELS } from "@/lib/utils";

function ReadinessRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 size={16} className="text-accent-emerald" />
        ) : (
          <XCircle size={16} className="text-red-400" />
        )}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-xs text-muted">{ok ? detail || "Ready" : "Not detected"}</span>
    </div>
  );
}

export function DashboardPage() {
  const { data: status } = useQuery({ queryKey: ["system-status"], queryFn: api.systemStatus });
  const { data: projects } = useQuery({ queryKey: ["projects", "recent"], queryFn: () => api.listProjects() });

  return (
    <div className="relative">
      <HeroScene />
      <div className="relative z-10 px-10 py-14 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge className="mb-4">AI Mathematical Animation Studio</Badge>
          <h1 className="text-5xl font-semibold tracking-tight leading-tight mb-4">
            Turn a math idea into a
            <br />
            <span className="bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan bg-clip-text text-transparent">
              beautiful local animation.
            </span>
          </h1>
          <p className="text-muted max-w-xl mb-8">
            Describe a concept, curve, proof, or 3D shape. Transpiler drafts Manim code with
            Gemini and renders it entirely on your own PC — nothing leaves your machine.
          </p>
          <Link to="/studio">
            <Button size="lg">
              Create animation <ArrowRight size={18} />
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <Card className="md:col-span-2">
            <h2 className="font-semibold mb-4">Recent projects</h2>
            {!projects || projects.length === 0 ? (
              <p className="text-sm text-muted">
                No projects yet. Start your first animation in the Create Studio.
              </p>
            ) : (
              <div className="space-y-2">
                {projects.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-panel transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted">{MODE_LABELS[p.mode]}</p>
                    </div>
                    <Badge variant={p.status === "completed" ? "success" : p.status === "failed" ? "danger" : "default"}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold mb-4">Local system readiness</h2>
            <ReadinessRow ok={!!status?.gemini_key_configured} label="Gemini API key" />
            <ReadinessRow ok={!!status?.manim_installed} label="Manim" detail={status?.manim_version} />
            <ReadinessRow ok={!!status?.ffmpeg_installed} label="FFmpeg" detail={status?.ffmpeg_version} />
            <ReadinessRow ok={!!status?.latex_installed} label="LaTeX" detail={status?.latex_version} />
            <Link to="/settings">
              <Button variant="outline" size="sm" className="mt-4 w-full">
                Open Settings
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
