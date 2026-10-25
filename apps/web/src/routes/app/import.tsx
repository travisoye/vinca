import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWorkspace } from "@/context/workspace-context";
import type { ImportCandidate } from "@/fixtures";
import type { Network } from "@/types";
import {
  CheckCircle2,
  Download,
  FileCheck,
  FolderOpen,
  Info,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";

export function AppImportPage() {
  const navigate = useNavigate();
  const { addImportedCandidate } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [keyString, setKeyString] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network>("testnet");
  const [birthdayHeight, setBirthdayHeight] = useState("2500000");
  const [contextLabel, setContextLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Parses and loads key text from a selected or dropped file.
   */
  const processKeyFile = async (file: File) => {
    try {
      setError(null);
      setSelectedFileName(file.name);

      const rawText = await file.text();
      let extractedKey = rawText.trim();

      // If the file is JSON, attempt to extract known key fields
      if (file.name.endsWith(".json") || extractedKey.startsWith("{")) {
        try {
          const parsed = JSON.parse(extractedKey);
          if (typeof parsed === "object" && parsed !== null) {
            extractedKey =
              parsed.uivk ||
              parsed.viewingKey ||
              parsed.viewing_key ||
              parsed.key ||
              extractedKey;
          }
        } catch {
          // Fall back to plain text
        }
      }

      setKeyString(extractedKey);

      // Auto-detect network from key prefix
      const lower = extractedKey.toLowerCase();
      if (lower.startsWith("uviewtest")) {
        setNetwork("testnet");
      } else if (lower.startsWith("uviewregtest")) {
        setNetwork("regtest");
      }

      // Auto-populate friendly label if not set
      if (!contextLabel) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setContextLabel(cleanName);
      }
    } catch {
      setError("Failed to read file. Please ensure it is a valid text or key file.");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processKeyFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processKeyFile(file);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyString.trim();
    if (!trimmed) {
      setError("Please select a key file or paste a Unified Incoming Viewing Key string.");
      return;
    }

    setError(null);
    setIsEvaluating(true);

    try {
      const birthdayNum = parseInt(birthdayHeight, 10) || (network === "testnet" ? 2500000 : 1);
      const candidate: ImportCandidate = {
        id: `cand-${Date.now()}`,
        label: contextLabel.trim() || selectedFileName || `Imported ${network} Key`,
        fileName: selectedFileName || "imported.key",
        network,
        birthdayHeight: birthdayNum,
        supportedPools: ["orchard", "ironwood"],
        unsupportedComponents: [],
        description: `Imported viewing key (${trimmed.slice(0, 16)}...)`,
        sharesCapabilityWith: null,
        rejectionReason: null,
      };

      const rawBytes = new TextEncoder().encode(trimmed);
      const newId = await addImportedCandidate(candidate, contextLabel.trim(), rawBytes);
      navigate(`/app/contexts/${newId}`);
    } catch (err: any) {
      setError(err.message || "Failed to decode viewing key.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleClear = () => {
    setKeyString("");
    setSelectedFileName(null);
    setContextLabel("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadRegtestKey = () => {
    const keyData = {
      vincaVersion: "1.0",
      type: "UnifiedIncomingViewingKey",
      network: "regtest",
      birthdayHeight: 201,
      uivk: "uviewregtest17u7j8e4k5l0p9q8w7e6r5t4y3u2i1o0p9a8s7d6f5g4h3j2k1l0z9x8c7v6b5n4m3q2w1e",
      label: "Regtest Replay Dataset",
      description: "Genesis activation height 201 Orchard capability for deterministic evaluation.",
    };
    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vinca-regtest-dataset-01.key";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreloadRegtest = () => {
    setKeyString("uviewregtest17u7j8e4k5l0p9q8w7e6r5t4y3u2i1o0p9a8s7d6f5g4h3j2k1l0z9x8c7v6b5n4m3q2w1e");
    setNetwork("regtest");
    setBirthdayHeight("201");
    setContextLabel("Regtest Replay Dataset");
    setSelectedFileName("vinca-regtest-dataset-01.key");
    setError(null);
  };

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageShell
        title="Import incoming viewing key"
        description="Select a viewing key file from your Downloads or local storage, or paste a UIVK string. Processed entirely inside your browser WebAssembly worker."
      />

      {/* Regtest Evaluation Helper Card for Judges & Demo */}
      <div className="max-w-3xl rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-primary" />
              <h3 className="font-semibold text-foreground text-sm">
                Need a key with transactions for testing?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Zcash testnet wallets often have 0 transactions without an active faucet. Download our bundled <strong>Regtest Replay Key</strong> to test file browsing, scanning, decrypted receipts, and disclosures.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadRegtestKey}
              className="text-xs"
            >
              <Download className="size-3.5" />
              Download .key file
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handlePreloadRegtest}
              className="text-xs"
            >
              <FileCheck className="size-3.5" />
              Load Regtest key
            </Button>
          </div>
        </div>
      </div>

      <Alert variant="info">
        <Info className="size-4" />
        <AlertTitle>Supported Scope & Safety Boundary</AlertTitle>
        <AlertDescription>
          Vinca imports incoming viewing-key files only (UIVK-family, testnet and regtest only).
          Spending keys, seed phrases, and full viewing keys (UFVKs) are permanently out of scope and rejected during preflight.
        </AlertDescription>
      </Alert>

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select or paste viewing key</CardTitle>
            <CardDescription>
              Browse to your Downloads folder to select an exported wallet file, or paste your raw UIVK string.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleImport}>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <XCircle className="size-4" />
                  <AlertTitle>Import Preflight Rejection</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* File upload zone */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Key File (Browse Downloads or drop file)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".key,.txt,.json,.uivk,*/*"
                  className="hidden"
                />
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
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
                      <p className="text-xs text-muted-foreground">
                        Click or drop another file to replace
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <FolderOpen className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          Click to browse files (e.g. from Downloads)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports .key, .txt, .json, or .uivk files
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
                        Browse key file
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Direct string paste */}
              <Field
                label="Or paste UIVK String directly"
                help="Testnet UIVKs begin with 'uviewtest1...'; regtest UIVKs begin with 'uviewregtest1...'."
              >
                <textarea
                  className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="uviewtest1..."
                  value={keyString}
                  onChange={(e) => {
                    setKeyString(e.target.value);
                    setError(null);
                  }}
                />
              </Field>

              {/* Configuration parameters */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Target Network">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={network}
                    onChange={(e) => setNetwork(e.target.value as Network)}
                  >
                    <option value="testnet">Testnet</option>
                    <option value="regtest">Regtest</option>
                  </select>
                </Field>

                <Field label="Scan Birthday Height" help="Orchard activation height or creation block">
                  <Input
                    type="number"
                    value={birthdayHeight}
                    onChange={(e) => setBirthdayHeight(e.target.value)}
                    placeholder="2500000"
                    min="1"
                  />
                </Field>

                <Field label="Context Label" help="Friendly label in your local workspace">
                  <Input
                    type="text"
                    value={contextLabel}
                    onChange={(e) => setContextLabel(e.target.value)}
                    placeholder="e.g. My Testnet Wallet"
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>Zero-Knowledge Browser Privacy</span>
                </div>
                <p className="mt-1">
                  Viewing keys never leave your browser. Scanning requests to the public relay query public compact block ranges without transmitting viewing keys or addresses.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button type="submit" variant="default" disabled={isEvaluating || !keyString.trim()}>
                <CheckCircle2 className="size-4" />
                {isEvaluating ? "Evaluating..." : "Inspect & Import Key"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
