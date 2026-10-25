import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sampleRecipientPackages, SAMPLE_PASSPHRASE } from "@/fixtures";
import { formatZecFromZatoshis, shortHex } from "@/lib/format";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  FileLock2,
  KeyRound,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export function PackageInspector() {
  const [selectedSample, setSelectedSample] = useState<"cap" | "snapshot" | "malformed">("snapshot");
  const [passphrase, setPassphrase] = useState(SAMPLE_PASSPHRASE);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [accepted, setAccepted] = useState(false);

  const handleDecrypt = () => {
    if (selectedSample === "malformed") {
      setStatus("error");
      setAccepted(false);
      return;
    }
    if (passphrase !== SAMPLE_PASSPHRASE) {
      setStatus("error");
      setAccepted(false);
      return;
    }
    setStatus("success");
    setAccepted(false);
  };

  const handleReset = () => {
    setStatus("idle");
    setAccepted(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileLock2 className="size-5 text-primary" />
            <CardTitle>Recipient Inspection Workflow</CardTitle>
          </div>
          <CardDescription>
            Decrypt and inspect an encrypted disclosure package received from an external party.
            Evidence labels are assigned locally by your browser; a package cannot claim its own proof.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Choose a sample encrypted package to inspect:</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedSample("snapshot");
                  handleReset();
                }}
                className={`flex flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                  selectedSample === "snapshot"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <FileCheck className="size-4 text-primary" />
                  <span>Record snapshot</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected records without viewing keys. 2 payments + invoice memo.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedSample("cap");
                  handleReset();
                }}
                className={`flex flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                  selectedSample === "cap"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <KeyRound className="size-4 text-primary" />
                  <span>Context-access package</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Incoming viewing capability. Enables continuing inspection of receipts.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedSample("malformed");
                  handleReset();
                }}
                className={`flex flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                  selectedSample === "malformed"
                    ? "border-destructive bg-destructive/5 ring-1 ring-destructive"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  <span>Corrupted package</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Simulates a tampered file or wrong decryption secret.
                </p>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field
                label="Package decryption passphrase"
                help="The sender shares this passphrase out-of-band to unlock the AEAD container."
              >
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => {
                    setPassphrase(e.target.value);
                    if (status !== "idle") setStatus("idle");
                  }}
                  placeholder="Enter file passphrase"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setPassphrase(SAMPLE_PASSPHRASE)}
              >
                Insert sample passphrase
              </Button>
              <Button variant="default" type="button" onClick={handleDecrypt}>
                Decrypt & inspect
              </Button>
            </div>
          </div>

          {status === "error" && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Decryption Failed</AlertTitle>
              <AlertDescription>
                {selectedSample === "malformed"
                  ? sampleRecipientPackages.malformed.error
                  : "Authentication check failed: the supplied passphrase is incorrect or the package data has been modified."}
              </AlertDescription>
            </Alert>
          )}

          {status === "success" && (
            <div className="space-y-6 rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-primary" />
                    <h3 className="font-semibold tracking-tight">
                      {selectedSample === "snapshot"
                        ? sampleRecipientPackages.validSnapshot.label
                        : sampleRecipientPackages.validContextAccess.label}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Format:{" "}
                    <code className="font-mono">
                      {selectedSample === "snapshot"
                        ? "record-snapshot v1 (authenticated AEAD)"
                        : "context-access-package v1 (authenticated AEAD)"}
                    </code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">testnet</Badge>
                  <Badge variant="secondary">
                    Local evidence: {selectedSample === "snapshot" ? "exported-assertion" : "fixture-sample"}
                  </Badge>
                </div>
              </div>

              <Alert variant="info">
                <AlertTriangle className="size-4" />
                <AlertTitle>Local Evidence Label Policy</AlertTitle>
                <AlertDescription>
                  {selectedSample === "snapshot"
                    ? "Amounts and memos in this snapshot are assertions provided by the exporter. Vinca does not treat them as independently verified payment proof."
                    : "This package provides continuing viewing capability. You will be able to inspect matching future transactions received on chain."}
                </AlertDescription>
              </Alert>

              {selectedSample === "snapshot" ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Disclosed Payment Records (2):</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2">Pool</th>
                          <th className="py-2">Amount (ZEC)</th>
                          <th className="py-2">Tx ID : Action</th>
                          <th className="py-2">Block</th>
                          <th className="py-2">Memo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sampleRecipientPackages.validSnapshot.records.map((rec) => (
                          <tr key={rec.id}>
                            <td className="py-3 font-medium capitalize">{rec.pool}</td>
                            <td className="py-3 font-mono font-medium">
                              {formatZecFromZatoshis(rec.amountZatoshis)} ZEC
                            </td>
                            <td className="py-3 font-mono text-xs text-muted-foreground">
                              {shortHex(rec.txIdHex)} : {rec.actionIndex}
                            </td>
                            <td className="py-3">{rec.blockHeight.toLocaleString()}</td>
                            <td className="py-3 text-xs italic text-muted-foreground">
                              {rec.memoText ?? "None"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <h4 className="font-medium">Disclosed Viewing Scope:</h4>
                  <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4 text-xs">
                    <div>
                      <span className="font-medium text-foreground">Supported Pools: </span>
                      {sampleRecipientPackages.validContextAccess.pools.join(", ")}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Scan Birthday: </span>
                      Height {sampleRecipientPackages.validContextAccess.birthdayHeight.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Opaque Key ID: </span>
                      <code className="font-mono">{sampleRecipientPackages.validContextAccess.keyIdentifier}</code>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Sender Note: </span>
                      {sampleRecipientPackages.validContextAccess.exporterNote}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                {accepted ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <CheckCircle2 className="size-4" />
                    Package accepted and saved to local session.
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Accepting registers this record in your local inspection history.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Close inspection
                  </Button>
                  {!accepted && (
                    <Button variant="default" size="sm" onClick={() => setAccepted(true)}>
                      Accept package
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
