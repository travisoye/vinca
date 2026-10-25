/*
  Component tests for the phase-1 design-system primitives. Written under the
  validation freeze and NOT executed (prd.md validation policy).
*/
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";

describe("Button", () => {
  it("fires onClick and can render a disabled state", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Do nothing
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Do nothing" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("exposes pill-shaped variants from the template's design language", () => {
    expect(buttonVariants({ variant: "outline" })).toContain("rounded-full");
    expect(buttonVariants({ variant: "hero" })).toContain("text-white");
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary");
  });

  it("renders a link when asChild is used with an anchor", () => {
    render(
      <Button asChild>
        <a href="/app">Go work</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Go work" })).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders variant classes", () => {
    render(<Badge variant="warning">mixed components</Badge>);
    const badge = screen.getByText("mixed components");
    expect(badge).toHaveTextContent("mixed components");
  });
});

describe("Alert", () => {
  it("marks itself as an alert region with an accessible title", () => {
    render(<Alert variant="warning" title="Overlapping capability" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Overlapping capability");
  });
});

describe("Field", () => {
  it("associates help text and an error with the field", () => {
    render(
      <Field label="Workspace passphrase" error="That passphrase is not the sample one.">
        <Input type="password" />
      </Field>,
    );
    expect(screen.getByText("Workspace passphrase")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That passphrase is not the sample one.",
    );
  });
});

describe("EmptyState", () => {
  it("renders title, description, icon and action", () => {
    render(
      <EmptyState icon={Sparkles} title="No disclosures yet" description="Prepare one to see it here.">
        <Button size="sm">Prepare</Button>
      </EmptyState>,
    );
    expect(screen.getByText("No disclosures yet")).toBeInTheDocument();
    expect(screen.getByText("Prepare one to see it here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare" })).toBeInTheDocument();
  });
});
