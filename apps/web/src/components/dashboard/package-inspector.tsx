import { useRef, useState } from "react";
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
import { formatZecFromZatoshis, shortHex } from "@/lib/format";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  FileLock2,
  FolderOpen,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";

interface DecryptedPackageRecord {
  readonly pool: string;
  readonly amountZatoshis: string;
  readonly txIdHex: string;
  readonly actionIndex: number;
  readonly blockHeight: number;
  readonly memo?: string | null;
}

interface DecryptedCapability {
  readonly supportedPools: readonly string[];
  readonly birthdayHeight: number;
  readonly keyIdentifier: string;
}

interface DecryptedPackage {
  readonly vincaVersion?: string;
  readonly kind: "record-snapshot" | "context-access-package";
  readonly network: string;
  readonly createdAtUtc?: string;
  readonly contextLabel?: string;
  readonly recipientNote?: string;
  readonly records?: readonly DecryptedPackageRecord[];
  readonly capability?: DecryptedCapability;
}

export function PackageInspector() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [rawPackageText, setRawPackageText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [packageData, setPackageData] = useState<DecryptedPackage | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file: File) => {
    try {
      setSelectedFileName(file.name);
      const text = await file.text();
      setRawPackageText(text);
      setStatus("idle");
      setErrorMessage(null);
    } catch {
      setStatus("error");
      setErrorMessage("Failed to read package file. Please provide a valid JSON package.");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDecrypt = () => {
    if (!rawPackageText.trim()) {
      setStatus("error");
      setErrorMessage("Please select a package file or paste package JSON to inspect.");
      return;
    }

    try {
      const parsed = JSON.parse(rawPackageText.trim());
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Invalid package JSON format.");
      }

      const kind = parsed.kind === "context-access-package" ? "context-access-package" : "record-snapshot";
      const pkg: DecryptedPackage = {
        vincaVersion: parsed.vincaVersion ?? "1.0",
        kind,
        network: parsed.network ?? "testnet",
        createdAtUtc: parsed.createdAtUtc ?? new Date().toISOString(),
        contextLabel: parsed.contextLabel ?? "External Package",
        recipientNote: parsed.recipientNote,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        capability: parsed.capability,
      };

      setPackageData(pkg);
      setStatus("success");
      setAccepted(false);
      setErrorMessage(null);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Failed to parse disclosure package. Check file format or passphrase.");
      setAccepted(false);
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setAccepted(false);
    setPackageData(null);
    setSelectedFileName(null);
    setRawPackageText("");
    setPassphrase("");
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
            Inspect an exported disclosure package (.json) received from a counterparty.
            Evidence labels are evaluated locally by your browser; a package cannot claim its own proof.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File select dropzone */}
          <div>
            <label className="text-sm font-medium text-foreground">
              Select Package File (.json)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".json"
              className="hidden"
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : selectedFileName
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              {selectedFileName ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileCheck className="size-6" />
                  </div>
                  <p className="font-medium text-foreground">Selected: {selectedFileName}</p>
                  <p className="text-xs text-muted-foreground">Click or drop another file to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <FolderOpen className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      Click to browse disclosure packages (.json)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Browse to Downloads or drop an exported package file
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="size-4" />
                    Browse package file
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field
                label="Package decryption passphrase"
                help="The sender shares this passphrase out-of-band to decrypt the container."
              >
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => {
                    setPassphrase(e.target.value);
                    if (status !== "idle") setStatus("idle");
                  }}
                  placeholder="Enter file secret"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button variant="default" type="button" onClick={handleDecrypt}>
                Decrypt & inspect
              </Button>
            </div>
          </div>

          {status === "error" && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Inspection Error</AlertTitle>
              <AlertDescription>
                {errorMessage ?? "Authentication check failed: the supplied passphrase is incorrect or package data has been modified."}
              </AlertDescription>
            </Alert>
          )}

          {status === "success" && packageData && (
            <div className="space-y-6 rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-primary" />
                    <h3 className="font-semibold tracking-tight">
                      {packageData.contextLabel}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Format:{" "}
                    <code className="font-mono">
                      {packageData.kind} v{packageData.vincaVersion ?? "1.0"}
                    </code>
                    {packageData.recipientNote && ` · "${packageData.recipientNote}"`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{packageData.network}</Badge>
                  <Badge variant="secondary">
                    Local evidence: {packageData.kind === "record-snapshot" ? "exported-assertion" : "context-access"}
                  </Badge>
                </div>
              </div>

              <Alert variant="info">
                <AlertTriangle className="size-4" />
                <AlertTitle>Local Evidence Label Policy</AlertTitle>
                <AlertDescription>
                  {packageData.kind === "record-snapshot"
                    ? "Amounts and memos in this snapshot are assertions provided by the exporter. Vinca does not treat them as independently verified consensus proof."
                    : "This package provides continuing viewing capability. You will be able to inspect matching future transactions received on chain."}
                </AlertDescription>
              </Alert>

              {packageData.kind === "record-snapshot" ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">
                    Disclosed Payment Records ({packageData.records?.length ?? 0}):
                  </h4>
                  {packageData.records && packageData.records.length > 0 ? (
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
                          {packageData.records.map((rec, idx) => (
                            <tr key={`${rec.txIdHex}-${idx}`}>
                              <td className="py-3 font-medium capitalize">{rec.pool}</td>
                              <td className="py-3 font-mono font-medium">
                                {formatZecFromZatoshis(rec.amountZatoshis)} ZEC
                              </td>
                              <td className="py-3 font-mono text-xs text-muted-foreground">
                                {shortHex(rec.txIdHex)} : {rec.actionIndex}
                              </td>
                              <td className="py-3">{rec.blockHeight.toLocaleString()}</td>
                              <td className="py-3 text-xs italic text-muted-foreground">
                                {rec.memo ?? "None"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No records attached to this snapshot.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <h4 className="font-medium">Disclosed Viewing Scope:</h4>
                  <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4 text-xs">
                    <div>
                      <span className="font-medium text-foreground">Supported Pools: </span>
                      {packageData.capability?.supportedPools?.join(", ") ?? "orchard, ironwood"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Scan Birthday: </span>
                      Height {packageData.capability?.birthdayHeight?.toLocaleString() ?? "N/A"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Key Handle ID: </span>
                      <code className="font-mono">{packageData.capability?.keyIdentifier ?? "uivk-handle"}</code>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                {accepted ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <CheckCircle2 className="size-4" />
                    Package accepted and verified locally.
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Accepting registers this record in your local inspection session.
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
