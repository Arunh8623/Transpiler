import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Film, Search, Star, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select-tabs";
import { api } from "@/lib/api";
import { MODE_LABELS, STATUS_LABELS } from "@/lib/utils";
import type { Project } from "@/types/api";

type SortKey = "newest" | "oldest" | "mode" | "status";

function ProjectThumbnail({ project }: { project: Project }) {
  const { data: render } = useQuery({
    queryKey: ["render-thumb", project.id],
    queryFn: () => api.latestRender(project.id),
  });

  const hasThumbnail = render?.status === "succeeded" && !!render.thumbnail_path;

  return (
    <div className="aspect-video rounded-xl bg-black/40 border border-border overflow-hidden flex items-center justify-center text-xs text-muted">
      {hasThumbnail ? (
        <img
          src={api.thumbnailUrl(project.id, render!.id)}
          alt={project.title}
          className="w-full h-full object-cover"
        />
      ) : render?.status === "succeeded" ? (
        // Render succeeded before thumbnail generation existed, or ffmpeg
        // wasn't available at render time - still offer the video itself.
        <div className="flex flex-col items-center gap-1 text-muted">
          <Film size={18} />
          <span>Preview available</span>
        </div>
      ) : (
        <span>No preview yet</span>
      )}
    </div>
  );
}

export function HistoryLibraryPage() {
  const [q, setQ] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", q, onlyFavorites],
    queryFn: () => api.listProjects({ q: q || undefined, favorite: onlyFavorites || undefined }),
  });

  const sorted = useMemo(() => {
    if (!projects) return [];
    const copy = [...projects];
    switch (sortKey) {
      case "oldest":
        return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "mode":
        return copy.sort((a, b) => a.mode.localeCompare(b.mode));
      case "status":
        return copy.sort((a, b) => a.status.localeCompare(b.status));
      case "newest":
      default:
        return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [projects, sortKey]);

  const toggleFavorite = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => api.updateProject(id, { favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api.duplicateProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setPendingDeleteId(null);
    },
    onError: (error) => console.error("Failed to delete project:", error),
  });

  return (
    <div className="px-10 py-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">History Library</h1>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search by title or prompt…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-44">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="mode">By mode</option>
          <option value="status">By status</option>
        </Select>
        <Button
          variant={onlyFavorites ? "default" : "outline"}
          onClick={() => setOnlyFavorites((s) => !s)}
        >
          <Star size={16} /> Favorites
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : sorted.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No projects match. Create one from the Create Studio.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="flex flex-col gap-3 hover:shadow-glow transition-shadow duration-300">
                <Link to={`/projects/${p.id}`}>
                  <ProjectThumbnail project={p} />
                </Link>
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/projects/${p.id}`} className="font-medium text-sm hover:text-accent-indigo line-clamp-2">
                    {p.title}
                  </Link>
                  <button onClick={() => toggleFavorite.mutate({ id: p.id, favorite: !p.favorite })}>
                    <Star size={16} className={p.favorite ? "fill-accent-amber text-accent-amber" : "text-muted"} />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge>{MODE_LABELS[p.mode]}</Badge>
                  <Badge variant={p.status === "completed" ? "success" : p.status === "failed" ? "danger" : "default"}>
                    {STATUS_LABELS[p.status]}
                  </Badge>
                </div>

                {pendingDeleteId === p.id ? (
                  <div className="flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                    <span className="text-xs text-red-400">Delete this project permanently?</span>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteProject.mutate(p.id)}
                        disabled={deleteProject.isPending}
                      >
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => duplicate.mutate(p.id)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Copy size={12} /> Duplicate
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(p.id)}
                        className="flex items-center gap-1 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
