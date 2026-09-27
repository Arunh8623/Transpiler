import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, Input, Textarea } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select-tabs";
import { api } from "@/lib/api";
import { AUDIENCE_LABELS, MODE_LABELS, QUALITY_LABELS } from "@/lib/utils";
import type { AspectRatio, Mode, QualityPreset, Role } from "@/types/api";

const schema = z.object({
  prompt: z.string().min(10, "Describe your animation in a bit more detail."),
  mode: z.string(),
  audience: z.string(),
  quality_preset: z.string(),
  aspect_ratio: z.string(),
  duration_target: z.coerce.number().min(5).max(180),
  camera_style: z.string().optional(),
  background_color: z.string().optional(),
  renderer: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EXAMPLE_PROMPTS = [
  "Explain the chain rule visually with a composed function and a moving tangent line.",
  "Animate the unit circle generating sine and cosine waves side by side.",
  "Create a 45-second animation of a paraboloid sliced by horizontal planes, showing contour curves.",
  "Show why the derivative of x^2 is 2x using a shrinking secant line.",
  "Visualize a 3D gradient vector field on a saddle surface with an orbiting camera.",
];

export function CreateStudioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { register, handleSubmit, control, setValue, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      prompt: "",
      mode: "explain_concept" as Mode,
      audience: "college_student" as Role,
      quality_preset: "standard" as QualityPreset,
      aspect_ratio: "16:9" as AspectRatio,
      duration_target: 45,
      background_color: "#0B0F1A",
      renderer: "cairo",
    },
  });

  const mode = watch("mode");
  const is3D = mode === "model_3d";

  const createProject = useMutation({
    mutationFn: (values: FormValues) =>
      api.createProject({
        prompt: values.prompt,
        mode: values.mode as Mode,
        audience: values.audience as Role,
        quality_preset: values.quality_preset as QualityPreset,
        aspect_ratio: values.aspect_ratio as AspectRatio,
        duration_target: values.duration_target,
        camera_style: is3D ? values.camera_style : undefined,
        background_color: values.background_color,
        renderer: values.renderer as "cairo" | "opengl",
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${project.id}`);
    },
    onError: (error) => {
      // Logged so a silent-looking failure (e.g. backend not running) is
      // actually diagnosable from DevTools instead of "nothing happens".
      console.error("Failed to create project:", error);
    },
  });

  const onSubmit = (values: FormValues) => createProject.mutate(values);
  const onInvalid = () => {
    console.warn("Form did not pass validation - see formState.errors below the fields.");
  };

  return (
    <div className="px-10 py-12 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-1">Create Studio</h1>
      <p className="text-muted mb-8">Describe what you want to see. We'll plan, generate, validate, and render it locally.</p>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        <Card>
          <label className="text-sm font-medium mb-2 block">What should the animation explain?</label>
          <Textarea rows={4} placeholder="e.g. Explain the chain rule visually..." {...register("prompt")} />
          {formState.errors.prompt && (
            <p className="text-xs text-red-400 mt-1">{formState.errors.prompt.message}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setValue("prompt", p, { shouldValidate: true })}
                className="text-xs text-muted border border-border rounded-full px-3 py-1.5 hover:border-accent-indigo/50 hover:text-foreground transition-colors"
              >
                {p.length > 46 ? p.slice(0, 46) + "…" : p}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <label className="text-sm font-medium mb-2 block">Creation mode</label>
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Select {...field}>
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Card>

          <Card>
            <label className="text-sm font-medium mb-2 block">Audience</label>
            <Controller
              control={control}
              name="audience"
              render={({ field }) => (
                <Select {...field}>
                  {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Card>

          <Card>
            <label className="text-sm font-medium mb-2 block">Quality preset</label>
            <Controller
              control={control}
              name="quality_preset"
              render={({ field }) => (
                <Select {...field}>
                  {Object.entries(QUALITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            />
            {watch("quality_preset") === "cinematic" && (
              <p className="text-xs text-accent-amber mt-2">
                Cinematic quality can take significantly longer to render locally.
              </p>
            )}
          </Card>

          <Card>
            <label className="text-sm font-medium mb-2 block">Aspect ratio</label>
            <Controller
              control={control}
              name="aspect_ratio"
              render={({ field }) => (
                <Select {...field}>
                  <option value="16:9">16:9 — Widescreen</option>
                  <option value="9:16">9:16 — Vertical</option>
                  <option value="1:1">1:1 — Square</option>
                </Select>
              )}
            />
          </Card>
        </div>

        <Card>
          <label className="text-sm font-medium mb-2 block">Target duration (seconds)</label>
          <Input type="number" min={5} max={180} {...register("duration_target")} className="max-w-[160px]" />
        </Card>

        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-sm text-accent-indigo hover:underline"
        >
          {showAdvanced ? "Hide advanced controls" : "Show advanced controls"}
        </button>

        {showAdvanced && (
          <Card className="space-y-4">
            {is3D && (
              <div>
                <label className="text-sm font-medium mb-2 block">3D camera style</label>
                <Controller
                  control={control}
                  name="camera_style"
                  render={({ field }) => (
                    <Select {...field}>
                      <option value="orbit">Orbit</option>
                      <option value="slow_rotate">Slow rotate</option>
                      <option value="fixed">Fixed</option>
                      <option value="top_down">Top-down</option>
                      <option value="custom">Custom</option>
                    </Select>
                  )}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Renderer</label>
              <Controller
                control={control}
                name="renderer"
                render={({ field }) => (
                  <Select {...field}>
                    <option value="cairo">Cairo (default, most reliable)</option>
                    <option value="opengl">OpenGL (faster, requires GPU support)</option>
                  </Select>
                )}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Background color</label>
              <Input type="color" {...register("background_color")} className="h-10 w-20 p-1" />
            </div>
          </Card>
        )}

        <Button type="submit" size="lg" disabled={createProject.isPending}>
          {createProject.isPending ? "Creating project…" : "Start project"}
        </Button>
        {createProject.isError && (
          <Card className="border-red-500/50 bg-red-500/5">
            <p className="text-sm font-medium text-red-400 mb-1">Couldn't create the project</p>
            <p className="text-sm text-red-300/90">{(createProject.error as Error).message}</p>
            <p className="text-xs text-muted mt-2">
              If this says "Failed to fetch", the backend isn't running or isn't reachable at
              http://127.0.0.1:8000 - check the "Transpiler Backend" terminal window.
            </p>
          </Card>
        )}
      </form>
    </div>
  );
}
