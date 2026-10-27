import { useState } from "react";
import { Link } from "react-router-dom";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { useWorkspace } from "@/context/workspace-context";
import { formatZecFromZatoshis, shortHex, sumZatoshis } from "@/lib/format";
import {
  ArrowRight,
  Eye,
  Plus,
  Scale,
  Layers,
  Coins,
  History,
  AlertTriangle,
} from "lucide-react";

export function AppDashboardPage() {
  const { contexts, receipts } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(contexts[0]?.id ?? null);

  const context = contexts.find((entry) => entry.id === selectedId) ?? null;
  const contextReceipts = context ? receipts.filter((r) => r.contextId === context.id) : [];

  // Totals calculations using exact BigInt zatoshis
  const testnetReceipts = receipts.filter((r) => r.network === "testnet");
  const testnetOrchardReceipts = testnetReceipts.filter((r) => r.pool === "orchard");
  const testnetIronwoodReceipts = testnetReceipts.filter((r) => r.pool === "ironwood");
  const regtestReceipts = receipts.filter((r) => r.network === "regtest");

  const testnetOrchardZatoshis = sumZatoshis(testnetOrchardReceipts.map((r) => r.amountZatoshis));
  const testnetIronwoodZatoshis = sumZatoshis(testnetIronwoodReceipts.map((r) => r.amountZatoshis));
  const regtestZatoshis = sumZatoshis(regtestReceipts.map((r) => r.amountZatoshis));
  const totalAllZatoshis = sumZatoshis(receipts.map((r) => r.amountZatoshis));

  return (
    <WorkspaceGate>
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <PageShell
            title="Workspace overview"
            description="Inspect imported incoming viewing contexts, examine received notes, and monitor scan coverage."
          />
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline">
              <Link to="/app/compare">
                <Scale className="size-4" />
                Compare
              </Link>
            </Button>
            <Button asChild variant="default">
              <Link to="/app/import">
                <Plus className="size-4" />
                Import key
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick metrics grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Active Contexts</CardDescription>
              <CardTitle className="text-2xl">{contexts.filter((c) => c.status === "active").length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {contexts.filter((c) => c.status === "archived").length} archived in vault
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Total Received (All)</CardDescription>
              <CardTitle className="text-2xl font-mono">
                {formatZecFromZatoshis(totalAllZatoshis)} <span className="text-sm font-sans font-normal text-muted-foreground">ZEC</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Across {receipts.length} decrypted notes (not a spendable balance)
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Networks Covered</CardDescription>
              <CardTitle className="text-2xl">Testnet & Regtest</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Mainnet encodings permanently rejected
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">Evidence Status</CardDescription>
              <CardTitle className="text-2xl">Live Local Scan</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Locally inspected via relay · Zero key transmission
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList aria-label="Workspace views">
            <TabsTrigger value="inventory">
              <Layers className="size-4" />
              Context inventory ({contexts.length})
            </TabsTrigger>
            <TabsTrigger value="totals">
              <Coins className="size-4" />
              Incoming totals
            </TabsTrigger>
            <TabsTrigger value="scans">
              <History className="size-4" />
              Scan summaries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="flex min-w-0 flex-col gap-6">
            {contexts.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <EmptyState
                  title="No viewing contexts in vault"
                  description="Import a testnet or regtest Unified Incoming Viewing Key (UIVK) to start inspecting notes."
                  action={
                    <Button asChild className="mt-4">
                      <Link to="/app/import">
                        <Plus className="size-4" />
                        Import incoming viewing key
                      </Link>
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card className="overflow-hidden">
              <Table aria-label="Context inventory table" className="min-w-[48rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Context Label</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Pools</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead className="text-right">Receipts</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contexts.map((entry) => {
                    const active = entry.id === selectedId;
                    return (
                      <TableRow
                        key={entry.id}
                        data-state={active ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(entry.id)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              to={`/app/contexts/${entry.id}`}
                              className="font-medium underline underline-offset-4 hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {entry.label}
                            </Link>
                            {entry.overlappingContextIds.length > 0 && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                Overlaps with {entry.overlappingContextIds.length} context
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.network}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs capitalize text-muted-foreground">
                            {entry.supportedPools.join(", ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.status === "active" ? "secondary" : "muted"}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {entry.coverage.stale ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              stale (gap at {entry.coverage.gaps.map((g) => `${g.startHeight}–${g.endHeight}`).join(", ")})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              complete to {entry.coverage.lastScannedHeight}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{entry.receiptCount}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant={active ? "default" : "outline"}
                            size="sm"
                            aria-label={`Preview receipts for ${entry.label}`}
                            aria-pressed={active}
                            aria-controls="context-receipts-preview"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(entry.id);
                            }}
                          >
                            <Eye className="size-3.5" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
            )}

            {/* Receipt Preview Region */}
            <div id="context-receipts-preview" role="region" aria-label="Context receipt preview" aria-live="polite">
              {context ? (
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{context.label}</CardTitle>
                        <CardDescription>
                          Birthday {context.birthdayHeight.toLocaleString()} · Pools{" "}
                          {context.supportedPools.join(", ")}
                          {context.unsupportedComponents.length > 0 &&
                            ` · Declared unretained: ${context.unsupportedComponents.join(", ")}`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/app/contexts/${context.id}`}>
                            Open full workbench
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {contextReceipts.length > 0 ? (
                      <div className="space-y-3">
                        {contextReceipts.map((receipt) => (
                          <div
                            key={receipt.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge variant="outline" className="capitalize">
                                {receipt.pool}
                              </Badge>
                              <span className="font-mono font-semibold tabular-nums">
                                {formatZecFromZatoshis(receipt.amountZatoshis)} ZEC
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                tx {shortHex(receipt.txIdHex)} : {receipt.actionIndex}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Block {receipt.blockHeight.toLocaleString()}</span>
                              <Badge variant="muted" className="text-xs">
                                {receipt.evidence}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No receipts recorded"
                        description="No decrypted receipts found for this context."
                        size="compact"
                      />
                    )}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState
                  title="Select a context"
                  description="Choose a context from the inventory table above to preview receipts."
                  size="compact"
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="totals" className="flex flex-col gap-6">
            <Alert variant="info">
              <AlertTriangle className="size-4" />
              <AlertTitle>Disclosure Boundary: Incoming Sums vs Balances</AlertTitle>
              <AlertDescription>
                These totals represent the exact sum of incoming decrypted notes in this local workspace.
                They are <strong>not spendable balances</strong>, do not verify whether notes have since been spent,
                and carry no live-chain validation badge.
              </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Testnet Received Totals</CardTitle>
                    <Badge variant="outline">testnet</Badge>
                  </div>
                  <CardDescription>Breakdown by native Orchard-family pool</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <p className="font-medium">Orchard Pool</p>
                      <p className="font-mono text-xs text-muted-foreground">{testnetOrchardZatoshis} zatoshis</p>
                    </div>
                    <span className="font-mono text-lg font-semibold">
                      {formatZecFromZatoshis(testnetOrchardZatoshis)} ZEC
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <p className="font-medium">Ironwood Pool</p>
                      <p className="font-mono text-xs text-muted-foreground">{testnetIronwoodZatoshis} zatoshis</p>
                    </div>
                    <span className="font-mono text-lg font-semibold">
                      {formatZecFromZatoshis(testnetIronwoodZatoshis)} ZEC
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="font-medium text-foreground">Total Testnet Received</span>
                    <span className="font-mono text-xl font-bold text-primary">
                      {formatZecFromZatoshis(sumZatoshis([testnetOrchardZatoshis, testnetIronwoodZatoshis]))} ZEC
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Regtest Received Totals</CardTitle>
                    <Badge variant="outline">regtest</Badge>
                  </div>
                  <CardDescription>Offline inspection dataset receipts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <p className="font-medium">Orchard Pool</p>
                      <p className="font-mono text-xs text-muted-foreground">{regtestZatoshis} zatoshis</p>
                    </div>
                    <span className="font-mono text-lg font-semibold">
                      {formatZecFromZatoshis(regtestZatoshis)} ZEC
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="font-medium text-foreground">Total Regtest Received</span>
                    <span className="font-mono text-xl font-bold text-primary">
                      {formatZecFromZatoshis(regtestZatoshis)} ZEC
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scans" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scan & Coverage Diagnostics</CardTitle>
                <CardDescription>
                  Contiguous block intervals inspected by browser workers. Gaps occur if scanning is interrupted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {contexts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                      <div className="font-medium">{c.label}</div>
                      <Badge variant={c.coverage.stale ? "outline" : "secondary"}>
                        {c.coverage.stale ? "Stale Coverage" : "Up-to-date"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">Birthday Height: </span>
                        <span className="font-mono">{c.birthdayHeight.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Scanned Height: </span>
                        <span className="font-mono">{c.coverage.lastScannedHeight?.toLocaleString() ?? "None"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Chain Tip Height: </span>
                        <span className="font-mono">{c.coverage.tipHeight?.toLocaleString() ?? "Unknown"}</span>
                      </div>
                    </div>

                    {c.coverage.reorgNotice && (
                      <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                        <strong>Reorganisation rollback: </strong>
                        {c.coverage.reorgNotice.reason} (rewound to block #{c.coverage.reorgNotice.rollbackHeight.toLocaleString()})
                      </div>
                    )}

                    {c.coverage.gaps.length > 0 && (
                      <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                        <strong>Unscanned Interval: </strong>
                        Heights {c.coverage.gaps.map((g) => `${g.startHeight.toLocaleString()}–${g.endHeight.toLocaleString()}`).join(", ")} were not inspected.
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceGate>
  );
}
