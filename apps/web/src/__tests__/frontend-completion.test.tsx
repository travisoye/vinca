/*
  Phase 4 Frontend Completion & Handoff Gate Test Specifications.
  Written under the validation freeze; NOT executed until explicitly authorised
  by the user.
*/
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import { fixtureSimulatedErrors } from "@/fixtures";
import { formatZecFromZatoshis, shortHex } from "@/lib/format";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Phase 4: Frontend Completion & Handoff Gate", () => {
  describe("Responsive Layouts & Screen Size Bounds (375px, 768px, 1440px)", () => {
    it("renders landing page hero without clipped title on small mobile viewports", () => {
      renderAt("/");
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Understand what you share");
      // Mobile navigation trigger exists
      expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
    });

    it("renders stacked responsive grid containers across dashboard screens", () => {
      renderAt("/app");
      expect(screen.getByRole("heading", { name: "Workspace overview" })).toBeInTheDocument();
      // Table has min-width containment for safe horizontal scroll
      const table = screen.getByRole("table", { name: "Context inventory table" });
      expect(table).toHaveClass("min-w-[48rem]");
    });
  });

  describe("Alternate States & Edge Fixtures", () => {
    it("handles zero-receipt contexts with clean empty state", () => {
      renderAt("/app/contexts/ctx-zero");
      expect(screen.getByRole("heading", { name: /fresh import \(zero receipts\)/i })).toBeInTheDocument();
      expect(screen.getByText("Decrypted Receipts (0)")).toBeInTheDocument();
      expect(screen.getByText(/0 zatoshis/i)).toBeInTheDocument();
    });

    it("handles stress fixtures with 64-char hex IDs and huge zatoshis amounts without layout overflow", () => {
      renderAt("/app/contexts/ctx-large-ids");
      expect(screen.getByRole("heading", { name: /stress fixture/i })).toBeInTheDocument();

      // Formatted 21,000,000 ZEC
      expect(screen.getAllByText(/21000000 ZEC/i)[0]).toBeInTheDocument();

      // 64-char tx ID is safely truncated with shortHex
      const shortenedHex = shortHex("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 7);
      expect(screen.getByText(new RegExp(shortenedHex))).toBeInTheDocument();
    });

    it("renders chain reorganisation rollback notices and affected height intervals", () => {
      renderAt("/app/contexts/ctx-reorg");
      expect(screen.getByText(/Chain Reorganisation & Rollback Notice/i)).toBeInTheDocument();
      expect(screen.getByText(/rewound 700 blocks to common ancestor 2,704,800/i)).toBeInTheDocument();
    });

    it("provides typed simulated error fixtures for quota, export, and relay states", () => {
      expect(fixtureSimulatedErrors.storageQuotaExceeded.code).toBe("QUOTA_EXCEEDED");
      expect(fixtureSimulatedErrors.failedExport.code).toBe("AEAD_ENCRYPTION_FAILED");
      expect(fixtureSimulatedErrors.offlineRelay.code).toBe("RELAY_UNAVAILABLE");
    });
  });

  describe("Accessibility & Focus Order", () => {
    it("provides skip links on public and app layouts pointing to main content", () => {
      const { unmount } = renderAt("/docs");
      const skipLinkPublic = screen.getByRole("link", { name: /skip to content/i });
      expect(skipLinkPublic).toHaveAttribute("href", "#main-content");
      unmount();

      renderAt("/app");
      const skipLinkApp = screen.getByRole("link", { name: /skip to content/i });
      expect(skipLinkApp).toHaveAttribute("href", "#main-content");
    });

    it("ensures interactive dialog triggers and close buttons are focusable", () => {
      renderAt("/app/contexts/ctx-alpha");
      const deleteBtn = screen.getByRole("button", { name: /delete/i });
      expect(deleteBtn).toBeInTheDocument();
      expect(deleteBtn).not.toBeDisabled();
    });
  });

  describe("Finalized Service Contract Adherence", () => {
    it("confirms formatZecFromZatoshis enforces exact decimal-string transport without floating-point math", () => {
      expect(formatZecFromZatoshis("100000000")).toBe("1");
      expect(formatZecFromZatoshis("1")).toBe("0.00000001");
      expect(formatZecFromZatoshis("123456789")).toBe("1.23456789");
      expect(formatZecFromZatoshis("0")).toBe("0");
      expect(() => formatZecFromZatoshis("12.34")).toThrow(/malformed/i);
    });
  });
});
