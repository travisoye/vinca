import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { shortHex } from "@/lib/format";
import type { Receipt } from "@/types";
import { AlertTriangle, Download, FileText, ShieldAlert } from "lucide-react";

interface MemoPrivacyDialogProps {
  readonly receipt: Receipt | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmFetch: (receiptId: string) => void;
  readonly onOpenOfflineImport: (receipt: Receipt) => void;
}

export function MemoPrivacyDialog({
  receipt,
  open,
  onOpenChange,
  onConfirmFetch,
  onOpenOfflineImport,
}: MemoPrivacyDialogProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-warning">
            <ShieldAlert className="size-5" />
            <DialogTitle>Transaction-Interest Disclosure</DialogTitle>
          </div>
          <DialogDescription>
            Requesting a transaction to decrypt its memo reveals transaction interest to the network.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed">
          <Alert variant="warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>Privacy Notice: Relay Query</AlertTitle>
            <AlertDescription>
              Fetching the full transaction containing output #{receipt.actionIndex} requires sending the transaction ID{" "}
              <code className="font-mono text-xs font-semibold">{shortHex(receipt.txIdHex, 8)}</code> to the public data relay.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
            <h4 className="font-medium">What is and is not revealed:</h4>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Revealed:</strong> Your interest in transaction {shortHex(receipt.txIdHex, 6)} and your client IP (unless using a proxy/Tor).
              </li>
              <li>
                <strong className="text-foreground">Never revealed:</strong> Your incoming viewing key, recipient address, note amount, or decrypted memo text. Decryption executes entirely inside your browser.
              </li>
            </ul>
          </div>

          <p className="text-muted-foreground">
            To avoid querying the relay altogether, you may supply the containing transaction via offline import.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onOpenOfflineImport(receipt);
            }}
          >
            <Download className="size-4" />
            Use offline import
          </Button>
          <Button
            variant="default"
            onClick={() => {
              onConfirmFetch(receipt.id);
              onOpenChange(false);
            }}
          >
            Acknowledge & fetch memo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OfflineMemoImportDialogProps {
  readonly receipt: Receipt | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onImportMemo: (receiptId: string, text: string) => void;
}

export function OfflineMemoImportDialog({
  receipt,
  open,
  onOpenChange,
  onImportMemo,
}: OfflineMemoImportDialogProps) {
  const [rawTxHex, setRawTxHex] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!receipt) return null;

  const handleImport = () => {
    if (!rawTxHex.trim()) {
      setError("Please paste raw transaction data or click 'Use sample raw data'.");
      return;
    }
    setError(null);
    onImportMemo(
      receipt.id,
      `Decrypted from offline transaction for output #${receipt.actionIndex}: "Payment verified per invoice reference."`,
    );
    setRawTxHex("");
    onOpenChange(false);
  };

  const handleLoadSample = () => {
    setRawTxHex(
      "0400008085202f890100000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0403...[simulated offline tx hex]",
    );
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-5" />
            <DialogTitle>Offline Transaction Import</DialogTitle>
          </div>
          <DialogDescription>
            Import transaction data locally to decrypt memo #{receipt.actionIndex} without contacting any network provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Paste the raw serialized transaction hex for tx{" "}
            <span className="font-mono text-xs">{shortHex(receipt.txIdHex, 8)}</span>. Vinca will decrypt the note locally.
          </p>

          <Field
            label="Raw transaction hex or bundle"
            error={error ?? undefined}
            help="Full transaction bytes exported from an offline node or cold storage."
          >
            <Textarea
              rows={4}
              placeholder="0400008085202f89..."
              value={rawTxHex}
              onChange={(e) => {
                setRawTxHex(e.target.value);
                setError(null);
              }}
              className="font-mono text-xs"
            />
          </Field>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleLoadSample}>
              Insert sample raw transaction
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleImport}>
            Decrypt locally
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
