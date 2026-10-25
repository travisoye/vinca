import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatZecFromZatoshis } from "@/lib/format";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck,
  FileKey,
  KeyRound,
  Layers,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

interface StepInfo {
  readonly title: string;
  readonly description: string;
}

const DEMO_STEPS: readonly StepInfo[] = [
  {
    title: "1. Incoming viewing key preflight",
    description: "Evaluate incoming viewing authority before importing. Testnet and regtest only; no spending keys.",
  },
  {
    title: "2. Local browser note inspection",
    description: "Decrypt incoming notes in a browser worker. Private keys and decrypted amounts never leave your device.",
  },
  {
    title: "3. On-demand memo privacy boundary",
    description: "Memos are never fetched automatically. Explicit acknowledgement is required before querying a transaction.",
  },
  {
    title: "4. Capability overlap & duplicate detection",
    description: "Identify shared diversifiers and identical decryption scalars before sharing with auditors or third parties.",
  },
  {
    title: "5. Context access vs record snapshots",
    description: "Understand the critical distinction between continuing key access and fixed keyless record disclosures.",
  },
];

export function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [memoRevealed, setMemoRevealed] = useState(false);

  const step = DEMO_STEPS[currentStep];

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Demo isolation banner */}
      <div className="border-b border-border bg-background">
        <div className="site-container flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary text-primary">
              Interactive walkthrough
            </Badge>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Separate sample workspace · Deterministic demonstration · Does not mutate your private vault
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app">Exit to dashboard</Link>
          </Button>
        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="site-container page-space flex-1">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <PageShell
              title="Sample workspace walkthrough"
              description="Explore Vinca's core workflow and privacy principles using bundled deterministic fixtures."
              phase={3}
            />
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-background p-1.5 text-xs">
              {DEMO_STEPS.map((s, idx) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`size-7 rounded-full font-medium transition-colors ${
                    currentStep === idx
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Current Step Card */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Step {currentStep + 1} of {DEMO_STEPS.length}
                  </span>
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                </div>
                <Badge variant="secondary">Demo Simulation</Badge>
              </div>
              <CardDescription className="text-sm">{step.description}</CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Step 1: Preflight */}
              {currentStep === 0 && (
                <div className="space-y-5 text-sm">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2 font-medium">
                      <FileKey className="size-4 text-primary" />
                      <span>Decoded UIVK Components:</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded border border-border bg-muted/40 p-3">
                        <span className="text-xs text-muted-foreground">Retained Pools:</span>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">Orchard & Ironwood (Native)</p>
                      </div>
                      <div className="rounded border border-border bg-muted/40 p-3">
                        <span className="text-xs text-muted-foreground">Declared Unretained:</span>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">Sapling (Explicitly omitted)</p>
                      </div>
                    </div>
                  </div>

                  <Alert variant="info">
                    <ShieldCheck className="size-4" />
                    <AlertTitle>Strict Boundary Enforcement</AlertTitle>
                    <AlertDescription>
                      Vinca inspects incoming authority only. If a user attempts to import full viewing keys (UFVKs),
                      spending keys, or mainnet keys, preflight rejects the file before any key touches browser storage.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Step 2: Note Decryption */}
              {currentStep === 1 && (
                <div className="space-y-5 text-sm">
                  <p className="text-muted-foreground">
                    In Vinca, compact note trial-decryption runs in a dedicated browser WebAssembly worker.
                    The relay sends public block actions; your browser decrypts notes locally.
                  </p>

                  <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-medium">Decrypted Note #1</span>
                      <Badge variant="outline">orchard</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">Integer Zatoshis:</span>
                        <p className="font-mono font-semibold">123456789</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Formatted ZEC (BigInt):</span>
                        <p className="font-mono font-semibold text-primary">{formatZecFromZatoshis("123456789")} ZEC</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Block Height:</span>
                        <p className="font-mono">2,700,142</p>
                      </div>
                    </div>
                  </div>

                  <Alert variant="warning">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>No Floating-Point Math · No Spendable Balance Claims</AlertTitle>
                    <AlertDescription>
                      All monetary operations use <code>BigInt</code> arithmetic on decimal strings.
                      Received amounts are labelled as incoming totals, never spendable balances.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Step 3: Memo Privacy Boundary */}
              {currentStep === 2 && (
                <div className="space-y-5 text-sm">
                  <p className="text-muted-foreground">
                    Compact blocks do not contain encrypted memo payloads. To inspect a memo, the full transaction must be obtained.
                    Vinca treats this as an explicit privacy event.
                  </p>

                  <div className="rounded-lg border border-border bg-card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-primary" />
                        <span className="font-medium">Receipt Memo: Output #1</span>
                      </div>
                      <Badge variant="outline">tx a1f4c9... : 0</Badge>
                    </div>

                    <div className="mt-4">
                      {memoRevealed ? (
                        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs font-mono">
                          <p className="font-semibold text-primary">Decrypted Memo Payload:</p>
                          <p>"Invoice #9410 — Infrastructure tooling grant payment (Q3)."</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Alert variant="warning">
                            <ShieldAlert className="size-4" />
                            <AlertTitle>Transaction-Interest Privacy Disclosure</AlertTitle>
                            <AlertDescription>
                              Querying the relay for this full transaction reveals your interest in tx hash <code>a1f4c9...</code>.
                              Your viewing key is never transmitted.
                            </AlertDescription>
                          </Alert>
                          <Button variant="default" size="sm" onClick={() => setMemoRevealed(true)}>
                            Simulate explicit memo request
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Overlap Detection */}
              {currentStep === 3 && (
                <div className="space-y-5 text-sm">
                  <p className="text-muted-foreground">
                    Wallets can derive multiple diversified addresses from the same incoming viewing key.
                    Vinca compares keys to reveal when two contexts share the same underlying capability.
                  </p>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Layers className="size-5" />
                      <h4 className="font-semibold">Capability Overlap Detected: 100% Shared Decryption Access</h4>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      <strong>Context A ("Alpha testnet")</strong> and <strong>Context B ("Duplicate import")</strong> have identical incoming decryption scalars.
                      Even though they were imported with different labels, any payment to either address is decrypted by both.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 5: Deliberate Disclosure */}
              {currentStep === 4 && (
                <div className="space-y-5 text-sm">
                  <p className="text-muted-foreground">
                    When sharing information with an auditor, partner, or accountant, choose between continuing access or fixed records:
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 font-semibold">
                        <KeyRound className="size-4 text-amber-500" />
                        <span>Context-Access Package</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Includes viewing key material. The recipient has continuing access to past and future transactions.
                      </p>
                      <Badge variant="outline" className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                        Irrevocable · Continuing access
                      </Badge>
                    </div>

                    <div className="rounded-lg border border-primary bg-primary/5 p-4">
                      <div className="flex items-center gap-2 font-semibold text-primary">
                        <FileCheck className="size-4" />
                        <span>Record Snapshot</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Keyless export of selected records. The recipient learns nothing about past or future transactions outside the snapshot.
                      </p>
                      <Badge variant="secondary" className="mt-3 text-xs">
                        Keyless · Exporter assertion
                      </Badge>
                    </div>
                  </div>

                  <Alert variant="info">
                    <CheckCircle2 className="size-4" />
                    <AlertTitle>Walkthrough Complete</AlertTitle>
                    <AlertDescription>
                      You have completed the walkthrough! You can now navigate to the full dashboard to explore the workbench.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-between border-t border-border pt-4">
              <Button
                variant="outline"
                disabled={currentStep === 0}
                onClick={() => {
                  setCurrentStep((prev) => Math.max(0, prev - 1));
                  setMemoRevealed(false);
                }}
              >
                <ArrowLeft className="size-4" />
                Previous step
              </Button>

              {currentStep < DEMO_STEPS.length - 1 ? (
                <Button
                  variant="default"
                  onClick={() => {
                    setCurrentStep((prev) => Math.min(DEMO_STEPS.length - 1, prev + 1));
                    setMemoRevealed(false);
                  }}
                >
                  Next step
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button asChild variant="default">
                  <Link to="/app">
                    Open active dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
