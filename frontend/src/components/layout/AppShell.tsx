import { Clock, LayoutDashboard, Settings as SettingsIcon, Sparkles, Sun, Moon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeContext, type ThemeName } from "@/lib/theme";
import { AmbientField } from "@/components/layout/AmbientField";
import { LogoCube } from "@/components/layout/LogoCube";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/studio", label: "Create Studio", icon: Sparkles },
  { to: "/history", label: "History Library", icon: Clock },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    return (localStorage.getItem("transpiler-theme") as ThemeName) || "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("transpiler-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      <AmbientField theme={theme} />
      <div className="flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-border/60 p-5 flex flex-col gap-6 glass-panel rounded-none">
          <div className="flex items-center gap-2 px-1">
            <LogoCube size={36} />
            <span className="font-semibold text-lg tracking-tight">Transpiler</span>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-accent-indigo/15 text-accent-indigo"
                      : "text-muted hover:text-foreground hover:bg-panel hover:translate-x-0.5"
                  )
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent-indigo"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon size={18} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-2 text-xs text-muted hover:text-foreground px-3 py-2 rounded-xl hover:bg-panel w-full transition-colors"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <p className="text-[11px] text-muted px-3 pt-2 leading-relaxed">
              Rendering happens 100% locally on this PC. Nothing is uploaded by default.
            </p>
          </div>
        </aside>

        <main className="flex-1 relative overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </ThemeContext.Provider>
  );
}
