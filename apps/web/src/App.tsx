import { Link, Route, Routes } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppLayout, PublicLayout } from "@/components/layout/layouts";
import { LandingPage } from "@/routes/landing";
import { DocsPage } from "@/routes/docs";
import { PrivacyPage } from "@/routes/privacy";
import { TermsPage } from "@/routes/terms";
import { AppDashboardPage } from "@/routes/app/dashboard";
import { AppImportPage } from "@/routes/app/import";
import { ContextDetailPage } from "@/routes/app/context-detail";
import { ComparePage } from "@/routes/app/compare";
import { DisclosuresPage } from "@/routes/app/disclosures";
import { SettingsPage } from "@/routes/app/settings";
import { DemoPage } from "@/routes/demo";
import { DocPage } from "@/routes/doc-page";
import { WorkspaceProvider } from "@/context/workspace-context";

/**
 * Planned route structure (prd.md phases 2-3). Public and dashboard layouts
 * both carry the persistent preview notice. No route path or parameter ever
 * carries key material (prd.md phase 3 note).
 */
function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Route>

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<AppDashboardPage />} />
        <Route path="import" element={<AppImportPage />} />
        <Route path="contexts/:contextId" element={<ContextDetailPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="disclosures" element={<DisclosuresPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Separate sample workspace; does not touch the user's private workspace. */}
      <Route path="/demo" element={<DemoPage />} />

      <Route path="*" element={<PublicLayout />}>
        <Route
          path="*"
          element={
            <DocPage
              title="Page not found"
              description="The address you followed does not exist. Use the navigation above to reach the dashboard or documentation."
            >
              <Button asChild className="self-start">
                <Link to="/">Return to home</Link>
              </Button>
            </DocPage>
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <WorkspaceProvider>
      <AppRoutes />
    </WorkspaceProvider>
  );
}

export default App;
