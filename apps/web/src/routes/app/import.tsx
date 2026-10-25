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
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { useWorkspace } from "@/context/workspace-context";
import { fixtureImportCandidates, type ImportCandidate } from "@/fixtures";
import {
  AlertTriangle,
  CheckCircle2,
  FileKey,
  FolderOpen,
  Info,
  ShieldAlert,
  XCircle,
} from "lucide-react";

export function AppImportPage() {
  const navigate = useNavigate();
  const { addImportedCandidate, contexts } = useWorkspace();
  const [selectedCandidate, setSelectedCandidate] = useState<ImportCandidate | null>(
    fixtureImportCandidates[0] ?? null,
  );
  const [customLabel, setCustomLabel] = useState("");

  const handleSelect = (cand: ImportCandidate) => {
    setSelectedCandidate(cand);
    setCustomLabel(cand.label);
  };

  const handleConfirm = async () => {
    if (!selectedCandidate || selectedCandidate.rejectionReason) return;
    const newId = await addImportedCandidate(selectedCandidate, customLabel);
    navigate(`/app/contexts/${newId}`);
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
          description="Evaluate incoming viewing capabilities before importing them into your browser vault. Arbitrary file access is disabled in preview mode."
          phase={3}
        />

        <Alert variant="info">
          <Info className="size-4" />
          <AlertTitle>Supported Scope & Safety Boundary</AlertTitle>
          <AlertDescription>
            Vinca imports incoming viewing-key files only (UIVK-family, testnet and regtest only).
            Spending keys, seed phrases, and full viewing keys (UFVKs) are permanently out of scope and rejected during preflight.
          </AlertDescription>
        </Alert>

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
                    onClick={() => handleSelect(cand)}
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
                          value={customLabel}
                          onChange={(e) => setCustomLabel(e.target.value)}
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
                      setCustomLabel("");
                    }}
                  >
                    Clear selection
                  </Button>
                  <Button
                    variant="default"
                    disabled={isRejected}
                    onClick={handleConfirm}
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
      </div>
    </WorkspaceGate>
  );
}
