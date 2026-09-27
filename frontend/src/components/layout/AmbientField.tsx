import { Sparkles } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ThemeName } from "@/lib/theme";

/**
 * Fixed, full-viewport, pointer-events-none backdrop mounted once in
 * AppShell (not per-page) so it persists smoothly across route changes
 * instead of remounting. Colors/opacity are tuned per theme - the same
 * particle color that reads as an elegant glow on a near-black background
 * turns into a washed-out smear on a light one if left unchanged, which
 * was part of why light mode looked off before.
 */
export function AmbientField({ theme }: { theme: ThemeName }) {
  const color = theme === "dark" ? "#818CF8" : "#4F46E5";
  const opacity = theme === "dark" ? 0.55 : 0.3;

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} gl={{ alpha: true }}>
        <Sparkles count={90} scale={[16, 10, 8]} size={2.2} speed={0.25} color={color} opacity={opacity} />
      </Canvas>
    </div>
  );
}
