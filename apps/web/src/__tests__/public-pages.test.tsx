/*
  Public-route, navigation, copy-presence and accessibility tests (prd.md
  phase 2). Written under the validation freeze; execution stays deferred.
*/
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import {
  CLOSING_COPY,
  CONTEXT_ACCESS_EXPLANATION,
  HERO_COPY,
  SNAPSHOT_EXPLANATION,
  WORKFLOW_COPY,
} from "@/lib/copy";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("landing page sequence (prd.md phase 2)", () => {
  it("renders all seven planned sections with their anchors", () => {
    renderAt("/");
    for (const id of ["product", "how-it-works", "disclosures", "developers", "faq"]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(screen.getByRole("heading", { name: /inspect before you disclose/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /three deliberate steps/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /compare what a recipient actually gets/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /a toolkit around the interface/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /custody, scope, evidence and recovery/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: CLOSING_COPY.title })).toBeInTheDocument();
  });

  it("renders the Features3 product layout with a dashboard action", () => {
    renderAt("/");
    const product = screen.getByRole("region", { name: "Inspect before you disclose." });
    expect(product).toHaveAttribute("id", "product");
    const content = within(product);
    const benefits = content.getByRole("list", { name: "Product benefits" });
    expect(within(benefits).getAllByRole("listitem")).toHaveLength(4);
    expect(content.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/app");

    const preview = content.getByRole("group", {
      name: "Sample inspection preview using bundled fixture data",
    });
    for (const title of ["Context overview", "Coverage breakdown", "Received records"]) {
      expect(within(preview).getByRole("heading", { name: title })).toBeInTheDocument();
    }
  });

  it("labels the product preview and exposes accurate sample coverage", () => {
    renderAt("/");
    const preview = within(screen.getByRole("group", {
      name: "Sample inspection preview using bundled fixture data",
    }));
    expect(preview.getByText("Sample preview")).toBeInTheDocument();
    expect(preview.getByText("sapling declared, not retained")).toBeInTheDocument();
    expect(preview.getByText(/coverage is stale/i)).toBeInTheDocument();
    expect(preview.getByRole("meter", { name: "Sample scan coverage" }))
      .toHaveAttribute("aria-valuenow", "50");
    expect(preview.getByText("1.23456789 ZEC")).toBeInTheDocument();
    expect(preview.getByText("25 ZEC")).toBeInTheDocument();
  });

  it("compares both sharing formats with their distinct access scopes", () => {
    renderAt("/");
    const sharing = within(screen.getByRole("region", {
      name: "Compare what a recipient actually gets.",
    }));
    const context = within(sharing.getByRole("article", { name: "Context access" }));
    const snapshot = within(sharing.getByRole("article", { name: "Record snapshot" }));
    expect(context.getByText(CONTEXT_ACCESS_EXPLANATION)).toBeInTheDocument();
    expect(snapshot.getByText(SNAPSHOT_EXPLANATION)).toBeInTheDocument();
    expect(context.getByText("Imported key + validation metadata")).toBeInTheDocument();
    expect(context.getByText("Matching earlier and later receipts")).toBeInTheDocument();
    expect(snapshot.getByText("No viewing key")).toBeInTheDocument();
    expect(snapshot.getByText("Future activity stays outside the file")).toBeInTheDocument();
  });

  it("keeps disclosure limitations visible and links to the export documentation", () => {
    renderAt("/");
    const sharing = within(screen.getByRole("region", {
      name: "Compare what a recipient actually gets.",
    }));
    expect(sharing.getByText(/cannot revoke a copy the recipient already holds/)).toBeInTheDocument();
    expect(sharing.getByText(/not independently verified payment proof/)).toBeInTheDocument();
    expect(sharing.getByText(/never through a Vinca upload or sharing link/)).toBeInTheDocument();
    expect(sharing.getByRole("link", { name: "Read the export formats" }))
      .toHaveAttribute("href", "/docs");
  });

  it("carries the required hero copy baseline", () => {
    renderAt("/");
    expect(screen.getByText(HERO_COPY.badge)).toBeInTheDocument();
    expect(screen.getByText(HERO_COPY.description)).toBeInTheDocument();
    expect(screen.getByText(HERO_COPY.bottomSentence)).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1 });
    // Hero words are split into staggered spans; assert on normalized content.
    expect(heading).toHaveTextContent(HERO_COPY.line1);
    expect(heading).toHaveTextContent(HERO_COPY.line2);
  });

  it("carries the required workflow and disclosure copy", () => {
    renderAt("/");
    expect(screen.getByText(WORKFLOW_COPY.paragraph)).toBeInTheDocument();
    expect(screen.getByText(CONTEXT_ACCESS_EXPLANATION)).toBeInTheDocument();
    expect(screen.getByText(SNAPSHOT_EXPLANATION)).toBeInTheDocument();
  });

  it("keeps hero actions pinned to their planned destinations", () => {
    renderAt("/");
    const heroPrimary = screen.getAllByRole("link", { name: "Open dashboard" })[0];
    expect(heroPrimary).toHaveAttribute("href", "/app");
    const heroSecondary = screen.getByRole("link", { name: "Explore the workflow" });
    expect(heroSecondary).toHaveAttribute("href", "#how-it-works");
  });

  it("removed fictitious awards and inactive controls", () => {
    renderAt("/");
    expect(screen.queryByText(/award-winning/i)).toBeNull();
    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^EN$/ })).toBeNull();
  });
});

describe("navigation", () => {
  it("opens and closes the working hero mobile menu", () => {
    renderAt("/");
    const toggle = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(toggle);
    const menu = document.getElementById("hero-mobile-menu");
    expect(menu).not.toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(menu as HTMLElement).getByText("Privacy")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(document.getElementById("hero-mobile-menu")).toBeNull();
  });

  it("keeps the public header destinations verified on non-landing pages", () => {
    renderAt("/docs");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Demo" })).toHaveAttribute("href", "/demo");
  });

  it("does not render a duplicate header on the landing page", () => {
    renderAt("/");
    // The hero supplies the only navbar on "/".
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
    expect(document.querySelectorAll("header")).toHaveLength(0);
  });
});

describe("documentation pages", () => {
  it("documents the public integration contract with all three file kinds", () => {
    renderAt("/docs");
    expect(screen.getByRole("heading", { name: "Public integration contract" })).toBeInTheDocument();
    expect(screen.getByText(/context-access-package:/)).toBeInTheDocument();
    expect(screen.getByText(/record-snapshot:/)).toBeInTheDocument();
    expect(screen.getByText(/workspace-backup:/)).toBeInTheDocument();
  });

  it("states the network policy", () => {
    renderAt("/docs");
    expect(screen.getAllByText(/testnet and reproducible regtest/)[0]).toBeInTheDocument();
  });

  it("explains memo retrieval as explicit on the privacy page", () => {
    renderAt("/privacy");
    expect(
      screen.getByText(/Scanning alone never fetches matching transactions/),
    ).toBeInTheDocument();
  });

  it("states continuing-access permanence on the terms page", () => {
    renderAt("/terms");
    expect(screen.getByRole("heading", { name: "Disclosure limits" })).toBeInTheDocument();
    expect(
      screen.getByText(/does not revoke anything a recipient already holds/),
    ).toBeInTheDocument();
  });
});

describe("accessibility of public content", () => {
  it("uses a meaningful hero image alt text", () => {
    renderAt("/");
    const heroImage = screen.getByRole("img");
    expect(heroImage).toHaveAccessibleName(/aerial landscape/i);
  });

  it("exposes the FAQ as native disclosure widgets with real answers", () => {
    renderAt("/");
    const faq = document.getElementById("faq");
    expect(faq).not.toBeNull();
    const items = faq!.querySelectorAll("details");
    expect(items.length).toBe(5);
    items.forEach((item) => {
      const summary = item.querySelector("summary");
      expect(summary?.textContent?.trim().length).toBeGreaterThan(0);
      expect(item.querySelector("p")?.textContent?.trim().length).toBeGreaterThan(0);
    });
  });
});
