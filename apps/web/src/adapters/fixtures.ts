/*
  Fixture-only presentation adapters (prd.md phase 1).

  - Deterministic: no random values, no network calls, no timers.
  - The workspace state is in-memory and resets on reload; nothing is persisted.
  - The unlock check compares against the publicly documented sample passphrase
    so the wrong-passphrase state can be exercised. This is not a real vault,
    collects no real secret, and no output of it is ever presented as a verified
    protocol result.
*/

import { fixtureContexts, fixtureReceipts, SAMPLE_PASSPHRASE } from "@/fixtures";
import type {
  ContextSummary,
  DisclosureKind,
  DisclosurePreview,
  DisclosurePreviewRequest,
  DisclosureWarning,
  Receipt,
  WorkspacePhase,
} from "@/types";
import type { VincaPorts, VincaContextPort, VincaDisclosurePort, VincaWorkspacePort } from "./types";

class FixtureWorkspacePort implements VincaWorkspacePort {
  private phase_: WorkspacePhase = "no-vault";

  async phase(): Promise<WorkspacePhase> {
    return this.phase_;
  }

  async unlock(passphrase: string): Promise<"unlocked" | "wrong-passphrase"> {
    if (passphrase !== SAMPLE_PASSPHRASE) {
      return "wrong-passphrase";
    }
    this.phase_ = "unlocked";
    return "unlocked";
  }

  async lock(): Promise<void> {
    this.phase_ = this.phase_ === "no-vault" ? "no-vault" : "locked";
  }
}

class FixtureContextPort implements VincaContextPort {
  async listContexts(): Promise<readonly ContextSummary[]> {
    return fixtureContexts;
  }

  async getContext(id: string): Promise<ContextSummary | null> {
    return fixtureContexts.find((context) => context.id === id) ?? null;
  }

  async listReceipts(contextId: string): Promise<readonly Receipt[]> {
    return fixtureReceipts.filter((receipt) => receipt.contextId === contextId);
  }
}

class FixtureDisclosurePort implements VincaDisclosurePort {
  async preview(request: DisclosurePreviewRequest): Promise<DisclosurePreview> {
    const context = fixtureContexts.find((entry) => entry.id === request.contextId);
    if (!context) {
      throw new Error(`Unknown context: ${request.contextId}`);
    }

    const selected = fixtureReceipts.filter((receipt) =>
      request.selectedReceiptIds.includes(receipt.id),
    );

    return buildSamplePreview({
      kind: request.kind,
      contextId: request.contextId,
      selectedReceiptIds: selected.map((receipt) => receipt.id),
      includesViewingKey: request.kind === "context-access-package",
      includesMemos: request.includeMemos && selected.some((r) => r.memo.state === "available"),
    });
  }
}

function buildSamplePreview(input: {
  kind: DisclosureKind;
  contextId: string;
  selectedReceiptIds: string[];
  includesViewingKey: boolean;
  includesMemos: boolean;
}): DisclosurePreview {
  const warnings: DisclosureWarning[] = [];

  if (input.kind === "context-access-package") {
    warnings.push(
      {
        code: "continuing-access",
        message:
          "The recipient can inspect other receipts matching this capability, including later payments.",
      },
      {
        code: "irrevocable-holder-copy",
        message:
          "Archiving, deleting the file or changing a passphrase cannot revoke a key someone already holds.",
      },
      {
        code: "filter-not-cryptographic",
        message:
          "A pool, address or date filter in this dialogue is presentation only, not a cryptographic restriction on the exported key.",
      },
    );
  } else {
    if (input.selectedReceiptIds.length === 0) {
      warnings.push({
        code: "empty-selection",
        message: "No records are selected, so the snapshot would contain nothing.",
      });
    }
    warnings.push({
      code: "private-amount-not-proof",
      message:
        "Amounts and memos in a snapshot are exporter-provided information. Recipients should not treat them as independently verified payment proof.",
    });
    if (input.includesMemos) {
      warnings.push({
        code: "memo-included",
        message: "The snapshot includes the memo fields of the selected records.",
      });
    }
  }

  return {
    kind: input.kind,
    contextId: input.contextId,
    selectedReceiptIds: input.selectedReceiptIds,
    includesViewingKey: input.includesViewingKey,
    includesMemos: input.includesMemos,
    warnings,
  };
}

/** Shared fixture port set for the whole presentation build. */
export function createFixturePorts(): VincaPorts {
  return {
    workspace: new FixtureWorkspacePort(),
    contexts: new FixtureContextPort(),
    disclosures: new FixtureDisclosurePort(),
  };
}
