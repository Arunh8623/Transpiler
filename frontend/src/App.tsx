import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { CreateStudioPage } from "@/pages/CreateStudioPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { HistoryLibraryPage } from "@/pages/HistoryLibraryPage";
import { ProjectWorkspacePage } from "@/pages/ProjectWorkspacePage";
import { SettingsPage } from "@/pages/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="/studio" element={<CreateStudioPage />} />
              <Route path="/history" element={<HistoryLibraryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

