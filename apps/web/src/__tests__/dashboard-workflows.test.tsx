/*
  Dashboard & Sample Workflow Tests (PRD Phase 3).
  Written under the validation freeze; NOT executed until explicitly authorised
  by the user.
*/
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import {
  MemoPrivacyDialog,
  MemoViewer,
  OfflineMemoImportDialog,
} from "@/components/dashboard/memo-dialog";
import type { MemoData } from "@/adapters/types";
import type { Receipt } from "@/types";

const memoDialogReceipt: Receipt = {
  id: "receipt-memo-test",
  contextId: "context-memo-test",
  network: "testnet",
  pool: "orchard",
  txIdHex: "0123456789abcdef".repeat(4),
  actionIndex: 0,
  recipientAddress: null,
  amountZatoshis: "0",
  blockHeight: 1,
  observedUtc: null,
  evidence: "locally-inspected",
  memo: { state: "not-requested" },
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App initialMode="demo" />
    </MemoryRouter>,
  );
}

describe("Phase 3 Dashboard & Sample Workflows", () => {
  describe("Dashboard overview (/app)", () => {
    it("renders workspace overview with context inventory table and preview buttons", () => {
      renderAt("/app");
      expect(screen.getByRole("heading", { name: "Workspace overview" })).toBeInTheDocument();
      expect(screen.getAllByText("Alpha testnet account")[0]).toBeInTheDocument();
      expect(screen.getByText("Regtest replay dataset")).toBeInTheDocument();

      // Table has preview buttons
      const previewButtons = screen.getAllByRole("button", { name: /preview receipts for/i });
      expect(previewButtons.length).toBeGreaterThan(0);
    });

    it("displays incoming totals broken down by pool and network, never as balances", () => {
      renderAt("/app");
      const totalsTab = screen.getByRole("tab", { name: /incoming totals/i });
      fireEvent.mouseDown(totalsTab, { button: 0 });

      expect(screen.getByText(/Testnet Received Totals/i)).toBeInTheDocument();
      expect(screen.getByText(/Regtest Received Totals/i)).toBeInTheDocument();
      expect(screen.getByText(/not spendable balances/i)).toBeInTheDocument();
    });

    it("renders scan diagnostics and coverage gaps", () => {
      renderAt("/app");
      const scansTab = screen.getByRole("tab", { name: /scan summaries/i });
      fireEvent.mouseDown(scansTab, { button: 0 });

      expect(screen.getByText(/Scan & Coverage Diagnostics/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Unscanned Interval/i)[0]).toBeInTheDocument();
    });
  });

  describe("Import workflow (/app/import)", () => {
    it("renders fixture key catalog and safety scope boundaries", () => {
      renderAt("/app/import");
      expect(screen.getByRole("heading", { name: "Import incoming viewing key" })).toBeInTheDocument();
      expect(screen.getByText(/Incoming viewing-key files only/i)).toBeInTheDocument();
      expect(screen.getByText("Alpha testnet UIVK file")).toBeInTheDocument();
      expect(screen.getByText("Mainnet viewing key file")).toBeInTheDocument();
    });

    it("evaluates preflight and rejects mainnet keys with explicit notice", () => {
      renderAt("/app/import");
      const mainnetButton = screen.getByText("Mainnet viewing key file");
      fireEvent.click(mainnetButton);

      expect(screen.getByText(/Mainnet keys are permanently rejected/i)).toBeInTheDocument();
      const confirmButton = screen.getByRole("button", { name: /confirm import/i });
      expect(confirmButton).toBeDisabled();
    });

    it("previews valid UIVK components, declared unretained pools, and birthday height", () => {
      renderAt("/app/import");
      const alphaButton = screen.getByText("Alpha testnet UIVK file");
      fireEvent.click(alphaButton);

      expect(screen.getByText(/Valid Incoming Key/i)).toBeInTheDocument();
      expect(screen.getByText(/Declared Components Not Retained/i)).toBeInTheDocument();
      expect(screen.getByText("2,700,000")).toBeInTheDocument();
      const confirmButton = screen.getByRole("button", { name: /confirm import/i });
      expect(confirmButton).toBeEnabled();
    });
  });

  describe("Context detail workbench (/app/contexts/:contextId)", () => {
    it("renders context metadata, pool scope, and exact zatoshis receipts", () => {
      renderAt("/app/contexts/ctx-alpha");
      expect(screen.getByRole("heading", { name: "Alpha testnet account" })).toBeInTheDocument();
      expect(screen.getByText("Decrypted Receipts (4)")).toBeInTheDocument();
      expect(screen.getByText(/1.23456789 ZEC/i)).toBeInTheDocument();
    });

    it("triggers explicit transaction-interest privacy disclosure dialog for memo retrieval", () => {
      renderAt("/app/contexts/ctx-alpha");
      const requestMemoButtons = screen.getAllByRole("button", { name: /request memo/i });
      fireEvent.click(requestMemoButtons[0]);

      expect(screen.getByText("Transaction-Interest Disclosure")).toBeInTheDocument();
      expect(screen.getByText(/Fetching the full transaction containing output/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /acknowledge & fetch memo/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /use offline import/i })).toBeInTheDocument();
    });

    it("keeps the memo disclosure open and shows the decryption error", async () => {
      const onOpenChange = vi.fn();
      const onMemoFetched = vi.fn();
      const onConfirmFetch = vi
        .fn()
        .mockRejectedValue(new Error("Memo decryption is unavailable."));

      render(
        <MemoPrivacyDialog
          receipt={memoDialogReceipt}
          open
          onOpenChange={onOpenChange}
          onConfirmFetch={onConfirmFetch}
          onMemoFetched={onMemoFetched}
          onOpenOfflineImport={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /acknowledge & fetch memo/i }));

      expect(await screen.findByText("Memo decryption is unavailable.")).toBeInTheDocument();
      expect(screen.getByText("Transaction-Interest Disclosure")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(onMemoFetched).not.toHaveBeenCalled();
    });

    it("opens memo text and closes the disclosure only after a successful fetch", async () => {
      const memoData: MemoData = {
        format: "text",
        text: "Memo content from the worker",
        rawBytesHex: "00".repeat(512),
      };
      let resolveFetch!: (memo: MemoData) => void;
      const onOpenChange = vi.fn();
      const onMemoFetched = vi.fn();
      const onConfirmFetch = vi.fn(
        () =>
          new Promise<MemoData>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      render(
        <MemoPrivacyDialog
          receipt={memoDialogReceipt}
          open
          onOpenChange={onOpenChange}
          onConfirmFetch={onConfirmFetch}
          onMemoFetched={onMemoFetched}
          onOpenOfflineImport={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /acknowledge & fetch memo/i }));
      expect(
        screen.getByRole("button", { name: /fetching and decrypting/i }),
      ).toBeDisabled();
      expect(onOpenChange).not.toHaveBeenCalled();

      resolveFetch(memoData);
      await waitFor(() =>
        expect(onMemoFetched).toHaveBeenCalledWith(memoData),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("imports bounded raw transaction hex without invoking relay callbacks", async () => {
      const memoData: MemoData = {
        format: "no-memo",
        text: "",
        rawBytesHex: "f6" + "00".repeat(511),
      };
      const onConfirmImport = vi.fn().mockResolvedValue(memoData);
      const onOpenChange = vi.fn();
      render(
        <OfflineMemoImportDialog
          receipt={memoDialogReceipt}
          open
          onOpenChange={onOpenChange}
          onConfirmImport={onConfirmImport}
        />,
      );

      fireEvent.change(screen.getByRole("textbox", { name: /raw transaction hex/i }), {
        target: { value: "05000080" },
      });
      fireEvent.click(screen.getByRole("button", { name: /import and decrypt/i }));

      await waitFor(() => {
        expect(onConfirmImport).toHaveBeenCalledTimes(1);
        expect(onConfirmImport).toHaveBeenCalledWith(
          memoDialogReceipt.id,
          new Uint8Array([5, 0, 0, 128]),
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("rejects malformed offline transaction input before calling the importer", async () => {
      const onConfirmImport = vi.fn();
      render(
        <OfflineMemoImportDialog
          receipt={memoDialogReceipt}
          open
          onOpenChange={vi.fn()}
          onConfirmImport={onConfirmImport}
        />,
      );

      fireEvent.change(screen.getByRole("textbox", { name: /raw transaction hex/i }), {
        target: { value: '{"hex":"05000080"}' },
      });
      fireEvent.click(screen.getByRole("button", { name: /import and decrypt/i }));

      expect(await screen.findByText(/Paste only an even-length raw transaction hex/i)).toBeInTheDocument();
      expect(onConfirmImport).not.toHaveBeenCalled();
    });

    it("renders untrusted text without interpreting it as HTML", () => {
      const memo: MemoData = {
        format: "text",
        text: "<script>alert(1)</script>\nsecond line",
        rawBytesHex: "00".repeat(512),
      };
      render(
        <MemoViewer memo={memo} receipt={memoDialogReceipt} onClose={vi.fn()} />,
      );

      expect(screen.getByRole("dialog").textContent).toContain(memo.text);
      expect(document.querySelector("script")).toBeNull();
    });

    it.each([
      ["no-memo", "No memo present"],
      ["arbitrary-bytes", "Arbitrary bytes"],
      ["future-format", "Future memo format"],
      ["legacy-nontext", "Legacy non-text memo"],
    ] as const)("shows %s distinctly and preserves its raw bytes", (format, label) => {
      const memo: MemoData = {
        format,
        text: "",
        rawBytesHex: "f6" + "00".repeat(511),
      };
      render(
        <MemoViewer memo={memo} receipt={memoDialogReceipt} onClose={vi.fn()} />,
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(memo.rawBytesHex).toBeDefined();
      expect(screen.getByRole("dialog").textContent).toContain(memo.rawBytesHex);
    });

    it("renders empty text distinctly from a no-memo sentinel", () => {
      const memo: MemoData = {
        format: "text",
        text: "",
        rawBytesHex: "00".repeat(512),
      };
      render(
        <MemoViewer memo={memo} receipt={memoDialogReceipt} onClose={vi.fn()} />,
      );

      expect(screen.getByText("This text memo is empty.")).toBeInTheDocument();
      expect(screen.queryByText("No memo is present in this transaction output.")).toBeNull();
    });

    it("renders archive and deletion dialogs with non-revocation boundaries", () => {
      renderAt("/app/contexts/ctx-alpha");
      const archiveButton = screen.getByRole("button", { name: /^archive$/i });
      fireEvent.click(archiveButton);
      expect(screen.getByText(/Viewing Key Boundary Notice/i)).toBeInTheDocument();
      expect(screen.getByText(/the viewing key on chain/i)).toBeInTheDocument();
    });
  });

  describe("Context comparison (/app/compare)", () => {
    it("compares two contexts and detects duplicate capability overlap", () => {
      renderAt("/app/compare");
      expect(screen.getByRole("heading", { name: "Compare viewing contexts" })).toBeInTheDocument();

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "ctx-alpha" } });
      fireEvent.change(selects[1], { target: { value: "ctx-duplicate" } });

      expect(screen.getByText(/Capability Overlap Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/Identical Received Notes Decrypted by Both Contexts/i)).toBeInTheDocument();
    });
  });

  describe("Disclosures and package export (/app/disclosures)", () => {
    it("distinguishes context-access packages from keyless record snapshots", () => {
      renderAt("/app/disclosures");
      expect(screen.getByRole("heading", { name: "Disclosures & Package Export" })).toBeInTheDocument();

      // Default is Record Snapshot
      expect(screen.getByText(/Record Snapshot \(Recommended\)/i)).toBeInTheDocument();
      expect(screen.getByText(/without any viewing key/i)).toBeInTheDocument();

      // Click Context-Access Package
      const capOption = screen.getByText("Context-Access Package");
      fireEvent.click(capOption);

      expect(screen.getByText(/Continuing Access & Irrevocability Warnings/i)).toBeInTheDocument();
      expect(screen.getByText(/irrevocable/i)).toBeInTheDocument();
      expect(screen.getByText(/Filters are not cryptographic/i)).toBeInTheDocument();
    });

    it("mounts the recipient inspection workflow", () => {
      renderAt("/app/disclosures");
      const inspectTab = screen.getByRole("tab", { name: /recipient inspection/i });
      fireEvent.mouseDown(inspectTab, { button: 0 });

      expect(screen.getByText("Recipient Inspection Workflow")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /decrypt & inspect/i })).toBeInTheDocument();
    });

    it("shows local disclosure history", () => {
      renderAt("/app/disclosures");
      const historyTab = screen.getByRole("tab", { name: /export history/i });
      fireEvent.mouseDown(historyTab, { button: 0 });

      expect(screen.getByText("Local Disclosure History")).toBeInTheDocument();
      expect(screen.getAllByText("Alpha testnet account")[0]).toBeInTheDocument();
    });
  });

  describe("Settings & recovery (/app/settings)", () => {
    it("renders recovery export/import, and storage diagnostics", () => {
      renderAt("/app/settings");
      expect(screen.getByRole("heading", { name: "Vault settings & recovery" })).toBeInTheDocument();
      expect(screen.getByText("Local Storage Diagnostics")).toBeInTheDocument();
      expect(screen.getByText("Encrypted Workspace Recovery Snapshot")).toBeInTheDocument();
      expect(screen.getByText(/No spending authority/i)).toBeInTheDocument();
    });
  });

  describe("Demo deterministic walkthrough (/demo)", () => {
    it("renders isolated walkthrough banner and step 1", () => {
      renderAt("/demo");
      expect(screen.getByRole("heading", { name: "Sample workspace walkthrough" })).toBeInTheDocument();
      expect(screen.getByText(/Interactive walkthrough/i)).toBeInTheDocument();
      expect(screen.getByText("1. Incoming viewing key preflight")).toBeInTheDocument();

      // Advance to step 2
      const nextButton = screen.getByRole("button", { name: /next step/i });
      fireEvent.click(nextButton);
      expect(screen.getByText("2. Local browser note inspection")).toBeInTheDocument();
    });
  });
});
