/**
 * Static isometric cube logo styled after Manim's 3D Cube mobject render:
 * three visible faces, translucent flat color per face, white outlined
 * edges. Plain SVG on purpose - it's a static mark, so there's no reason
 * to spin up a WebGL canvas for it.
 */
export function LogoCube({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ filter: "drop-shadow(0 3px 8px rgba(14,165,233,0.35))" }}
      aria-hidden="true"
    >
      <g strokeLinejoin="round">
        {/* top face */}
        <path d="M50,18 L81,35 L50,52 L19,35 Z" fill="#93C5FD" fillOpacity="0.92" stroke="#F0F9FF" strokeWidth="2.4" />
        {/* left face */}
        <path d="M50,52 L19,35 L19,66 L50,83 Z" fill="#38BDF8" fillOpacity="0.92" stroke="#F0F9FF" strokeWidth="2.4" />
        {/* right face */}
        <path d="M50,52 L81,35 L81,66 L50,83 Z" fill="#0369A1" fillOpacity="0.94" stroke="#F0F9FF" strokeWidth="2.4" />
      </g>
    </svg>
  );
}
