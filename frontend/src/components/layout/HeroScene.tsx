import { Float, Line } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { useTheme } from "@/lib/theme";

function ParametricRibbon({ color }: { color: string }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t <= 200; t++) {
      const u = (t / 200) * Math.PI * 4;
      pts.push(
        new THREE.Vector3(Math.cos(u) * (1.4 + Math.sin(u * 0.5) * 0.3), Math.sin(u) * 1.4, Math.sin(u * 2) * 0.6)
      );
    }
    return pts;
  }, []);

  return (
    <Float speed={1.1} rotationIntensity={0.4} floatIntensity={0.8}>
      <Line points={points} color={color} lineWidth={1.6} transparent opacity={0.7} />
    </Float>
  );
}

function WireSphere({ color, opacity }: { color: string; opacity: number }) {
  return (
    <Float speed={0.8} rotationIntensity={0.6} floatIntensity={0.6}>
      <mesh position={[2.6, -0.7, -1.2]}>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
      </mesh>
    </Float>
  );
}

function GridPlane({ color1, color2 }: { color1: string; color2: string }) {
  return <gridHelper args={[14, 28, color1, color2]} position={[0, -2.2, 0]} rotation={[0, 0, 0]} />;
}

export function HeroScene() {
  const theme = useTheme();
  const isDark = theme === "dark";

  // Dark-mode-only colors (dark greys) go invisible against a light
  // background - every color below has a theme-appropriate counterpart.
  const ribbonColor = isDark ? "#8B5CF6" : "#6D28D9";
  const sphereColor = isDark ? "#22D3EE" : "#0891B2";
  const sphereOpacity = isDark ? 0.4 : 0.5;
  const gridColor1 = isDark ? "#334155" : "#C7D2FE";
  const gridColor2 = isDark ? "#1E293B" : "#E0E7FF";

  return (
    <div className="absolute inset-0 -z-10 opacity-90">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
        <ambientLight intensity={isDark ? 0.6 : 0.9} />
        <directionalLight position={[3, 3, 4]} intensity={isDark ? 0.8 : 1.1} />
        <ParametricRibbon color={ribbonColor} />
        <WireSphere color={sphereColor} opacity={sphereOpacity} />
        <GridPlane color1={gridColor1} color2={gridColor2} />
      </Canvas>
    </div>
  );
}
