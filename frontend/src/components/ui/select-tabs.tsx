import { cn } from "@/lib/utils";
import { forwardRef, useState } from "react";

// forwardRef matters here too: this Select is driven via react-hook-form's
// <Controller render={({ field }) => <Select {...field} />} />, and `field`
// includes a ref RHF uses for focus/validation. Without forwardRef, React
// drops that ref before it reaches the underlying <select>.
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-border bg-panel/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo/50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Tabs({
  tabs,
  defaultTab,
  children,
}: {
  tabs: { id: string; label: string }[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              active === t.id
                ? "border-accent-indigo text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
