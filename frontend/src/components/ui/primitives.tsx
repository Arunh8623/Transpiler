import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-panel p-6", className)} {...props} />;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "danger" }) {
  const styles = {
    default: "bg-accent-indigo/15 text-accent-indigo border-accent-indigo/30",
    success: "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30",
    warning: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
    danger: "bg-red-500/15 text-red-400 border-red-500/30",
  }[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles,
        className
      )}
      {...props}
    />
  );
}

// NOTE: forwardRef is required here - react-hook-form's register()/setValue()/
// Controller need a real DOM node ref for uncontrolled inputs. Without it,
// React silently drops the ref (function components can't receive refs
// unless wrapped), so typed/programmatic values never reliably reach the
// visible input.
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-border bg-panel/60 px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo/50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full rounded-xl border border-border bg-panel/60 px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo/50 resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
