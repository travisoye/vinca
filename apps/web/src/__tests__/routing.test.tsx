/*
  Routing tests for the phase-1 route shells. Written under the validation
  freeze and NOT executed (prd.md validation policy); phase 9 records actual
  run results.
*/
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("route structure", () => {
  it("renders the landing hero shell at /", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Understand what you share",
    );
    // Hero actions point at the intended destinations.
    const links = screen.getAllByRole("link", { name: /Open dashboard/i });
    expect(links[0]).toHaveAttribute("href", "/app");
  });

  it("shows documentation page and public layout footer", () => {
    renderAt("/docs");
    expect(screen.getByRole("heading", { name: "Documentation" })).toBeInTheDocument();
    expect(screen.getAllByText(/What Vinca is/i)[0]).toBeInTheDocument();
  });

  it("renders the dashboard shell at /app with workspace status", () => {
    renderAt("/app");
    expect(screen.getByRole("heading", { name: "Workspace overview" })).toBeInTheDocument();
    expect(screen.getByText(/Workspace: unlocked \(live\)/i)).toBeInTheDocument();
    // Dashboard nav leads to the planned routes.
    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute("href", "/app/import");
    expect(screen.getByRole("link", { name: "Disclosures" })).toHaveAttribute(
      "href",
      "/app/disclosures",
    );
  });

  it("renders a separate demo shell with its sample banner", () => {
    renderAt("/demo");
    expect(
      screen.getByText(/separate sample workspace/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /sample workspace walkthrough/i })).toBeInTheDocument();
  });

  it("renders a not-found page inside the public layout", () => {
    renderAt("/no-such-page");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
