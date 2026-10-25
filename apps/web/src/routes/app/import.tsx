import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { useWorkspace } from "@/context/workspace-context";
import { fixtureImportCandidates, type ImportCandidate } from "@/fixtures";
import type { Network } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  FileKey,
  FolderOpen,
  Info,
  KeyRound,
  ShieldAlert,
  XCircle,
} from "lucide-react";

export function AppImportPage() {
  const navigate = useNavigate();
  const { addImportedCandidate, contexts, mode } = useWorkspace();

  // Tab mode: live input vs catalog (defaults to catalog in demo mode, live in live mode)
  const [activeTab, setActiveTab] = useState<"live" | "catalog">(mode === "demo" ? "catalog" : "live");

  // Live input state
  const [liveKeyString, setLiveKeyString] = useState("");
  const [liveNetwork, setLiveNetwork] = useState<Network>("testnet");
  const [liveBirthday, setLiveBirthday] = useState("2500000");
  const [liveLabel, setLiveLabel] = useState("");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Catalog candidate state
  const [selectedCandidate, setSelectedCandidate] = useState<ImportCandidate | null>(
    fixtureImportCandidates[0] ?? null,
  );
  const [catalogLabel, setCatalogLabel] = useState(fixtureImportCandidates[0]?.label ?? "");

  const handleSelectCandidate = (cand: ImportCandidate) => {
    setSelectedCandidate(cand);
    setCatalogLabel(cand.label);
  };

  const handleConfirmCatalog = async () => {
    if (!selectedCandidate || selectedCandidate.rejectionReason) return;
    const newId = await addImportedCandidate(selectedCandidate, catalogLabel);
    navigate(`/app/contexts/${newId}`);
  };

  const handleLiveImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = liveKeyString.trim();
    if (!trimmed) {
      setLiveError("Please enter a Unified Incoming Viewing Key string.");
      return;
    }

    setLiveError(null);
    setIsEvaluating(true);

    try {
      const birthdayNum = parseInt(liveBirthday, 10) || 2500000;
      const candidate: ImportCandidate = {
        id: `cand-${Date.now()}`,
        label: liveLabel.trim() || `Live ${liveNetwork} UIVK`,
        fileName: "live-imported.key",
        network: liveNetwork,
        birthdayHeight: birthdayNum,
        supportedPools: ["orchard", "ironwood"],
        unsupportedComponents: [],
        description: `Imported via live input string (${trimmed.slice(0, 16)}...)`,
        sharesCapabilityWith: null,
        rejectionReason: null,
      };

      const rawBytes = new TextEncoder().encode(trimmed);
      const newId = await addImportedCandidate(candidate, liveLabel.trim(), rawBytes);
      navigate(`/app/contexts/${newId}`);
    } catch (err: any) {
      setLiveError(err.message || "Failed to decode viewing key");
    } finally {
      setIsEvaluating(false);
    }
  };

  const isRejected = Boolean(selectedCandidate?.rejectionReason);

  // Check if selected candidate overlaps with any existing context
  const existingOverlap = selectedCandidate?.sharesCapabilityWith
    ? contexts.find((c) => c.id === selectedCandidate.sharesCapabilityWith)
    : null;

  return (
    <WorkspaceGate>
      <div className="flex min-w-0 flex-col gap-8">
        <PageShell
          title="Import incoming viewing key"
          description="Evaluate and import incoming viewing capabilities into your encrypted browser vault. Processed locally in WebAssembly."
        />

        <Alert variant="info">
          <Info className="size-4" />
          <AlertTitle>Supported Scope & Safety Boundary</AlertTitle>
          <AlertDescription>
            Vinca imports incoming viewing-key files only (UIVK-family, testnet and regtest only).
            Spending keys, seed phrases, and full viewing keys (UFVKs) are permanently out of scope and rejected during preflight.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "live" | "catalog")} className="w-full">
          <TabsList aria-label="Import methods">
            <TabsTrigger value="live">
              <KeyRound className="size-4" />
              Live UIVK String / File
            </TabsTrigger>
            <TabsTrigger value="catalog">
              <FileKey className="size-4" />
              Key Catalog & Fixtures
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-6">
            <Card className="max-w-3xl">
              <CardHeader>
                <CardTitle className="text-lg">Live Unified Incoming Viewing Key</CardTitle>
                <CardDescription>
                  Paste your testnet or regtest UIVK string. Your key is decoded entirely in browser WebAssembly memory and never transmitted to the network.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLiveImport}>
                <CardContent className="space-y-5">
                  {liveError && (
                    <Alert variant="destructive">
                      <XCircle className="size-4" />
                      <AlertTitle>Import Preflight Rejection</AlertTitle>
                      <AlertDescription>{liveError}</AlertDescription>
                    </Alert>
                  )}

                  <Field
                    label="UIVK Key String"
                    help="Testnet UIVKs begin with 'uviewtest1...'; regtest UIVKs begin with 'uviewregtest1...'."
                  >
                    <textarea
                      className="flex min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="uviewtest1..."
                      value={liveKeyString}
                      onChange={(e) => {
                        setLiveKeyString(e.target.value);
                        setLiveError(null);
                      }}
                      required
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Target Network">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={liveNetwork}
                        onChange={(e) => setLiveNetwork(e.target.value as Network)}
                      >
                        <option value="testnet">Testnet</option>
                        <option value="regtest">Regtest</option>
                      </select>
                    </Field>

                    <Field label="Scan Birthday Height" help="Orchard activation height or wallet creation height">
                      <Input
                        type="number"
                        value={liveBirthday}
                        onChange={(e) => setLiveBirthday(e.target.value)}
                        placeholder="2500000"
                        min="1"
                      />
                    </Field>

                    <Field label="Vault Context Label" help="Friendly label in your local workspace">
                      <Input
                        type="text"
                        value={liveLabel}
                        onChange={(e) => setLiveLabel(e.target.value)}
                        placeholder="e.g. Testnet Alpha Key"
                      />
                    </Field>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Client-Side Privacy Guarantee</p>
                    <p className="mt-1">
                      Viewing keys never leave your browser. Scanning requests to the public relay query public compact block ranges without transmitting viewing keys or addresses.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLiveKeyString("");
                      setLiveError(null);
                    }}
                  >
                    Clear input
                  </Button>
                  <Button type="submit" variant="default" disabled={isEvaluating}>
                    <CheckCircle2 className="size-4" />
                    {isEvaluating ? "Evaluating..." : "Inspect & Import Key"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="catalog" className="mt-6">
            <div className="grid gap-8 lg:grid-cols-12">
              {/* Key Selection Catalog */}
              <div className="space-y-4 lg:col-span-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Select a sample key file
                </h3>

                <div className="space-y-3">
                  {fixtureImportCandidates.map((cand) => {
                    const active = selectedCandidate?.id === cand.id;
                    const rejected = Boolean(cand.rejectionReason);

                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => handleSelectCandidate(cand)}
                        className={`w-full rounded-lg border p-4 text-left transition-all ${
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileKey className={`size-4 ${rejected ? "text-destructive" : "text-primary"}`} />
                            <span className="font-medium text-foreground">{cand.label}</span>
                          </div>
                          <Badge variant={rejected ? "destructive" : "outline"} className="text-xs">
                            {rejected ? "Rejected" : cand.network}
                          </Badge>
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{cand.fileName}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{cand.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preflight & Scope Preview Panel */}
              <div className="lg:col-span-7">
                {selectedCandidate ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg">Import Preflight & Scope Preview</CardTitle>
                        <Badge variant={isRejected ? "destructive" : "secondary"}>
                          {isRejected ? "Validation Rejected" : "Valid Incoming Key"}
                        </Badge>
                      </div>
                      <CardDescription>
                        Inspecting decoded components for <code className="font-mono">{selectedCandidate.fileName}</code>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      {isRejected ? (
                        <Alert variant="destructive">
                          <XCircle className="size-4" />
                          <AlertTitle>Preflight Policy Rejection</AlertTitle>
                          <AlertDescription>{selectedCandidate.rejectionReason}</AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-xs text-muted-foreground">Target Network:</span>
                              <p className="font-semibold capitalize">{selectedCandidate.network}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Scan Birthday Height:</span>
                              <p className="font-mono font-semibold">{selectedCandidate.birthdayHeight.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Retained Pools:</span>
                              <p className="font-medium capitalize">{selectedCandidate.supportedPools.join(", ")}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Key Format:</span>
                              <p className="font-medium">Unified Incoming Viewing Key (UIVK)</p>
                            </div>
                          </div>

                          {/* Component warning */}
                          {selectedCandidate.unsupportedComponents.length > 0 && (
                            <Alert variant="warning">
                              <AlertTriangle className="size-4" />
                              <AlertTitle>Declared Components Not Retained</AlertTitle>
                              <AlertDescription>
                                This key declares components for <strong>{selectedCandidate.unsupportedComponents.join(", ")}</strong>.
                                Vinca only retains native Orchard-family components (Orchard and Ironwood) for browser inspection.
                                Other components are explicitly omitted rather than silently dropped.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Capability overlap warning */}
                          {existingOverlap && (
                            <Alert variant="warning">
                              <ShieldAlert className="size-4" />
                              <AlertTitle>Capability Overlap Detected</AlertTitle>
                              <AlertDescription>
                                This key shares incoming decryption scalars with existing context <strong>"{existingOverlap.label}"</strong>.
                                Transactions received via diversified addresses under this authority will decrypt identical notes.
                              </AlertDescription>
                            </Alert>
                          )}

                          <Field
                            label="Context Label in Local Vault"
                            help="Choose a recognizable label. This label does not prove account ownership."
                          >
                            <Input
                              value={catalogLabel}
                              onChange={(e) => setCatalogLabel(e.target.value)}
                              placeholder="e.g. Developer Testnet Account"
                            />
                          </Field>
                        </>
                      )}
                    </CardContent>

                    <CardFooter className="flex justify-between border-t border-border pt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCandidate(null);
                          setCatalogLabel("");
                        }}
                      >
                        Clear selection
                      </Button>
                      <Button
                        variant="default"
                        disabled={isRejected}
                        onClick={handleConfirmCatalog}
                      >
                        <CheckCircle2 className="size-4" />
                        Confirm import
                      </Button>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <FolderOpen className="size-12 stroke-1" />
                    <p className="mt-4 font-medium text-foreground">No key file selected</p>
                    <p className="mt-1 text-sm">Choose a sample key file from the list to preview its preflight properties.</p>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceGate>
  );
}
