import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { useWorkspace } from "@/context/workspace-context";
import { formatZecFromZatoshis, shortHex, sumZatoshis } from "@/lib/format";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const { contexts, receipts } = useWorkspace();

  const primaryParam = searchParams.get("primary");
  const [contextAId, setContextAId] = useState<string>(
    primaryParam && contexts.some((c) => c.id === primaryParam)
      ? primaryParam
      : contexts[0]?.id ?? "",
  );
  const [contextBId, setContextBId] = useState<string>(
    contexts.length > 1
      ? contexts.find((c) => c.id !== (primaryParam ?? contexts[0]?.id))?.id ?? contexts[1]?.id ?? ""
      : "",
  );

  const contextA = contexts.find((c) => c.id === contextAId) ?? null;
  const contextB = contexts.find((c) => c.id === contextBId) ?? null;

  const receiptsA = contextA ? receipts.filter((r) => r.contextId === contextA.id) : [];
  const receiptsB = contextB ? receipts.filter((r) => r.contextId === contextB.id) : [];

  // Check overlap
  const isSame = Boolean(contextA && contextB && contextA.id === contextB.id);
  const isOverlapping = Boolean(
    contextA &&
      contextB &&
      (contextA.overlappingContextIds.includes(contextB.id) ||
        contextB.overlappingContextIds.includes(contextA.id)),
  );

  // Find shared transaction IDs
  const sharedTxIds = contextA && contextB
    ? receiptsA.filter((ra) => receiptsB.some((rb) => rb.txIdHex === ra.txIdHex))
    : [];

  return (
    <WorkspaceGate>
      <div className="flex min-w-0 flex-col gap-8">
        <PageShell
          title="Compare viewing contexts"
          description="Evaluate capability overlap, receiver scope differences, and duplicate receipts before sharing viewing access."
        />

        {/* Selection Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Context A Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Primary Context (A)</CardTitle>
              <CardDescription>Select the first viewing capability to compare</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={contextAId}
                onChange={(e) => setContextAId(e.target.value)}
              >
                {contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.network} · {c.supportedPools.join("+")})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Context B Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comparison Context (B)</CardTitle>
              <CardDescription>Select the second viewing capability to compare against</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={contextBId}
                onChange={(e) => setContextBId(e.target.value)}
              >
                <option value="">-- Choose a context --</option>
                {contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.network} · {c.supportedPools.join("+")})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Evaluation State */}
        {!contextA || !contextB ? (
          <EmptyState
            title="Incomplete comparison selection"
            description="Please choose two contexts above to run side-by-side capability analysis."
            size="compact"
          />
        ) : isSame ? (
          <Alert variant="info">
            <AlertTriangle className="size-4" />
            <AlertTitle>Identical Context Selected</AlertTitle>
            <AlertDescription>
              You have selected the same context for both sides. Choose a different comparison context in the second dropdown to compare distinct capabilities.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Overlap Summary Alert */}
            {isOverlapping ? (
              <Alert variant="warning">
                <ShieldAlert className="size-4" />
                <AlertTitle>Capability Overlap Detected (Duplicate Incoming Authority)</AlertTitle>
                <AlertDescription>
                  <strong>"{contextA.label}"</strong> and <strong>"{contextB.label}"</strong> share incoming decryption scalars.
                  They decrypt the same underlying incoming transactions on {contextA.network}.
                  Exporting either context discloses incoming viewing access to both.
                </AlertDescription>
              </Alert>
            ) : contextA.network !== contextB.network ? (
              <Alert variant="info">
                <ShieldCheck className="size-4" />
                <AlertTitle>Disjoint Networks: Independent Capabilities</AlertTitle>
                <AlertDescription>
                  These contexts belong to different networks ({contextA.network} vs {contextB.network}).
                  They share no keys, diversifiers, or decrypted notes.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertTitle>Independent Viewing Capabilities</AlertTitle>
                <AlertDescription>
                  No overlapping decryption scalars or shared diversifiers were detected between these two contexts.
                </AlertDescription>
              </Alert>
            )}

            {/* Side-by-Side Comparison Matrix */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Context A Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{contextA.label}</CardTitle>
                    <Badge variant="outline">{contextA.network}</Badge>
                  </div>
                  <CardDescription>Internal ID: {contextA.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium capitalize">{contextA.status}</span>

                    <span className="text-muted-foreground">Birthday Height:</span>
                    <span className="font-mono">{contextA.birthdayHeight.toLocaleString()}</span>

                    <span className="text-muted-foreground">Supported Pools:</span>
                    <span className="font-medium capitalize">{contextA.supportedPools.join(", ")}</span>

                    <span className="text-muted-foreground">Declared Unretained:</span>
                    <span>{contextA.unsupportedComponents.join(", ") || "None"}</span>

                    <span className="text-muted-foreground">Last Scanned:</span>
                    <span className="font-mono">{contextA.coverage.lastScannedHeight?.toLocaleString() ?? "None"}</span>

                    <span className="text-muted-foreground">Coverage Gaps:</span>
                    <span>{contextA.coverage.gaps.length > 0 ? `${contextA.coverage.gaps.length} gaps` : "None"}</span>
                  </div>

                  <div>
                    <h4 className="font-medium">Decrypted Receipts ({receiptsA.length}):</h4>
                    <p className="mt-1 font-mono text-lg font-bold text-primary">
                      {formatZecFromZatoshis(sumZatoshis(receiptsA.map((r) => r.amountZatoshis)))} ZEC
                    </p>
                  </div>

                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={`/app/contexts/${contextA.id}`}>
                      View context detail
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Context B Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{contextB.label}</CardTitle>
                    <Badge variant="outline">{contextB.network}</Badge>
                  </div>
                  <CardDescription>Internal ID: {contextB.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium capitalize">{contextB.status}</span>

                    <span className="text-muted-foreground">Birthday Height:</span>
                    <span className="font-mono">{contextB.birthdayHeight.toLocaleString()}</span>

                    <span className="text-muted-foreground">Supported Pools:</span>
                    <span className="font-medium capitalize">{contextB.supportedPools.join(", ")}</span>

                    <span className="text-muted-foreground">Declared Unretained:</span>
                    <span>{contextB.unsupportedComponents.join(", ") || "None"}</span>

                    <span className="text-muted-foreground">Last Scanned:</span>
                    <span className="font-mono">{contextB.coverage.lastScannedHeight?.toLocaleString() ?? "None"}</span>

                    <span className="text-muted-foreground">Coverage Gaps:</span>
                    <span>{contextB.coverage.gaps.length > 0 ? `${contextB.coverage.gaps.length} gaps` : "None"}</span>
                  </div>

                  <div>
                    <h4 className="font-medium">Decrypted Receipts ({receiptsB.length}):</h4>
                    <p className="mt-1 font-mono text-lg font-bold text-primary">
                      {formatZecFromZatoshis(sumZatoshis(receiptsB.map((r) => r.amountZatoshis)))} ZEC
                    </p>
                  </div>

                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={`/app/contexts/${contextB.id}`}>
                      View context detail
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Matching Notes / Overlapping Transactions Table */}
            {sharedTxIds.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Layers className="size-5 text-amber-500" />
                    <CardTitle className="text-base">Identical Received Notes Decrypted by Both Contexts</CardTitle>
                  </div>
                  <CardDescription>
                    These receipts correspond to the exact same outputs on chain, matched through shared incoming capability.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sharedTxIds.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">{r.pool}</Badge>
                          <span className="font-mono font-semibold">
                            {formatZecFromZatoshis(r.amountZatoshis)} ZEC
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            tx {shortHex(r.txIdHex)} : {r.actionIndex}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Block {r.blockHeight.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </WorkspaceGate>
  );
}
