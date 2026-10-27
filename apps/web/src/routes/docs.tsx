import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Key,
  Shield,
  FileCode,
  Cpu,
  Network,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Terminal,
  ArrowRight,
  Lock,
  Database,
  Search,
  FileText,
  Info,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Table of Contents & Navigation Model
// ---------------------------------------------------------------------------

interface DocSectionMeta {
  id: string;
  label: string;
  category: string;
  badge?: string;
}

const TOC_SECTIONS: readonly DocSectionMeta[] = [
  { id: "about", label: "What Vinca is", category: "Overview" },
  { id: "processing-model", label: "Local processing model", category: "Overview" },
  { id: "security-model", label: "Security & trust guarantees", category: "Overview" },
  { id: "import-formats", label: "Import formats (ZIP 316)", category: "Key Formats" },
  { id: "components-handling", label: "Retained vs declared pools", category: "Key Formats" },
  { id: "wallet-exports", label: "Verified wallet export steps", category: "Wallet Guides" },
  { id: "integration-contract", label: "Public integration contract", category: "Export Protocols" },
  { id: "anti-substitution", label: "Anti-substitution guarantee", category: "Export Protocols" },
  { id: "sdk-interfaces", label: "SDK & service interfaces", category: "Architecture" },
  { id: "networks", label: "Networks and coverage", category: "Network Policy" },
  { id: "limitations", label: "Known limitations", category: "Network Policy" },
] as const;

const CATEGORIES = [
  { name: "Overview", icon: BookOpen },
  { name: "Key Formats", icon: Key },
  { name: "Wallet Guides", icon: Terminal },
  { name: "Export Protocols", icon: FileText },
  { name: "Architecture", icon: Cpu },
  { name: "Network Policy", icon: Network },
] as const;

// ---------------------------------------------------------------------------
// Helper: Interactive Copyable Code Block
// ---------------------------------------------------------------------------

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

function CodeBlock({ code, language = "bash", filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-border bg-muted/60 transition-colors hover:border-primary/30">
      {filename || language ? (
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/90 px-4 py-2 text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary/70" />
            <span className="text-foreground/90 font-medium">{filename || language}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="uppercase tracking-wider text-[10px] text-muted-foreground">{language}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-foreground transition-all hover:bg-background/80 active:scale-95"
              aria-label="Copy code to clipboard"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-primary" />
                  <span className="text-primary font-semibold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-muted-foreground" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
      <div className="relative p-4">
        <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-foreground/90">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Docs Page Component (3-Column Layout)
// ---------------------------------------------------------------------------

export function DocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("about");

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      for (let i = TOC_SECTIONS.length - 1; i >= 0; i--) {
        const section = document.getElementById(TOC_SECTIONS[i].id);
        if (section && section.offsetTop <= scrollPos) {
          setActiveId(TOC_SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return TOC_SECTIONS;
    const q = searchQuery.toLowerCase();
    return TOC_SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveId(id);
    }
  };

  return (
    <div className="w-full min-w-0 bg-background">
      {/* Top Banner / Header Breadcrumb */}
      <div className="border-b border-border/80 bg-muted/20 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1536px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">Home</Link>
            <ChevronRight className="size-3" />
            <span className="font-medium text-foreground">Documentation</span>
            <ChevronRight className="size-3" />
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">v1.0 Specification</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Testnet & Regtest Active
            </span>
            <Button size="sm" variant="subtle" asChild className="h-8 text-xs">
              <Link to="/app">Open Workbench</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 3-Column Layout Container */}
      <div className="mx-auto max-w-[1536px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_280px]">

          {/* ================================================================= */}
          {/* COLUMN 1 (LEFT): Sticky Navigation Sidebar & Topic Tree           */}
          {/* ================================================================= */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-6 overflow-y-auto pr-3">
              {/* Search / Filter box */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/50 py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {/* Categorized Topic List */}
              <nav aria-label="Documentation Categories" className="flex flex-col gap-5 text-sm">
                {CATEGORIES.map((cat) => {
                  const items = filteredSections.filter((s) => s.category === cat.name);
                  if (items.length === 0) return null;
                  const Icon = cat.icon;

                  return (
                    <div key={cat.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Icon className="size-3.5 text-primary" />
                        <span>{cat.name}</span>
                        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                          {items.length}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5 pl-2 border-l border-border/80">
                        {items.map((item) => {
                          const isActive = activeId === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => scrollToSection(item.id)}
                              className={cn(
                                "flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors",
                                isActive
                                  ? "bg-primary/10 font-semibold text-primary"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              )}
                            >
                              <span className="truncate">{item.label}</span>
                              {isActive ? (
                                <ChevronRight className="size-3 shrink-0 text-primary" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>

              {/* Quick links footer inside sidebar */}
              <div className="mt-auto rounded-xl border border-border/80 bg-muted/30 p-4 text-xs space-y-2">
                <p className="font-medium text-foreground">Interactive Tools</p>
                <div className="flex flex-col gap-1 text-muted-foreground">
                  <Link to="/app" className="flex items-center justify-between hover:text-primary">
                    <span>Full Dashboard</span>
                    <ExternalLink className="size-3" />
                  </Link>
                  <Link to="/demo" className="flex items-center justify-between hover:text-primary">
                    <span>Fixture Sandbox</span>
                    <ExternalLink className="size-3" />
                  </Link>
                  <Link to="/privacy" className="flex items-center justify-between hover:text-primary">
                    <span>Privacy Policy</span>
                    <ExternalLink className="size-3" />
                  </Link>
                  <Link to="/terms" className="flex items-center justify-between hover:text-primary">
                    <span>Terms of Use</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* ================================================================= */}
          {/* COLUMN 2 (CENTER): Rich, Comprehensive Technical Documentation    */}
          {/* ================================================================= */}
          <main className="min-w-0 flex-1 space-y-16 pb-24">

            {/* Document Header */}
            <header className="space-y-4 border-b border-border pb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <BookOpen className="size-3.5" />
                Vinca Disclosure Architecture
              </div>
              <h1 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Documentation
              </h1>
              <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
                How Vinca works for wallet authors, payment gateway developers, and auditors:
                importable viewing formats, verified wallet export procedures, the local WebAssembly
                processing model, and zero-knowledge integration contracts.
              </p>

              {/* Key Specs Highlights Bar */}
              <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Standard</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">ZIP 316 UIVK</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Execution</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">Client WASM</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Storage</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">AES-256-GCM</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Chains</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">Testnet / Regtest</div>
                </div>
              </div>
            </header>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 1: What Vinca is                                      */}
            {/* ------------------------------------------------------------- */}
            <section id="about" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    What Vinca is
                  </h2>
                  <p className="text-xs text-muted-foreground">Scope, capabilities, and system boundaries</p>
                </div>
              </div>

              <div className="prose prose-sm max-w-none text-muted-foreground space-y-4 leading-relaxed">
                <p>
                  Vinca is a read-only disclosure toolkit. It helps you understand the incoming viewing
                  capability attached to a Zcash account, inspect what that capability has received, and
                  decide between sharing continuing context access or a fixed set of records.
                </p>
                <p>
                  Vinca is not a wallet. It never signs transactions, never holds spending material, and
                  your external wallet keeps all authority over the account that created it. No private
                  workspace database exists on any server, and no server-side key processing or
                  cloud sync is ever performed.
                </p>
              </div>

              {/* Capability Matrix */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-border/80 bg-card/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="size-4 text-primary" />
                      What Vinca Does
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-primary font-bold">1.</span>
                      <span>Decodes ZIP 316 Unified Incoming Viewing Keys (UIVK) locally in WebAssembly.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-primary font-bold">2.</span>
                      <span>Inspects received notes across verified testnet and regtest block intervals.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-primary font-bold">3.</span>
                      <span>Allows deliberate, selective disclosure of encrypted transaction memos.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-primary font-bold">4.</span>
                      <span>Generates authenticated, tamper-proof disclosure packages with AEAD envelopes.</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <AlertTriangle className="size-4 text-destructive" />
                      What Vinca Never Does
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-destructive font-bold">✕</span>
                      <span>Never accepts spending keys, seeds, mnemonic phrases, or Full Viewing Keys.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-destructive font-bold">✕</span>
                      <span>Never signs or broadcasts outgoing transactions or transfers funds.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-destructive font-bold">✕</span>
                      <span>Never stores keys on a remote backend or transmits keys over network wires.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-destructive font-bold">✕</span>
                      <span>Never operates on mainnet (strictly locked to testnet and regtest).</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 2: Local Processing Model                             */}
            {/* ------------------------------------------------------------- */}
            <section id="processing-model" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Cpu className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    Local processing model
                  </h2>
                  <p className="text-xs text-muted-foreground">WebAssembly sandboxing, memory hygiene, and storage</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Parsing, validation and note inspection run entirely in your browser, with the protocol core
                  compiled to WebAssembly and executed inside an isolated Web Worker. Private workspace records
                  are encrypted with AES-256-GCM AEAD (PBKDF2-derived keys) before reaching IndexedDB storage.
                </p>
                <p>
                  The public-data relay serves chain data such as block ranges, tree state and whole
                  transactions that you deliberately request. Requests for a matching transaction are
                  treated as a deliberate disclosure step with its own acknowledgement, rather than an
                  automatic part of scanning.
                </p>
              </div>

              {/* Architecture Pipeline Flow Diagram */}
              <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-xs">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Data Isolation & Cryptographic Pipeline
                </h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-border/70 bg-background/80 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <Key className="size-4" />
                      <span>1. Ingestion & Opaque Handle</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Raw UIVK string is imported via client-side input. Rust core validates receivers and holds the
                      scalar in memory. The UI thread only receives an opaque numeric handle (e.g. <code className="font-mono text-primary">handle: u32</code>).
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-background/80 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <Cpu className="size-4" />
                      <span>2. Sandboxed Note Trial-Decrypt</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Compact blocks fetched from the relay are passed into the WASM worker. Orchard note commitments
                      are trial-decrypted inside the sandbox without exposing plaintext to telemetry or network.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-background/80 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <Lock className="size-4" />
                      <span>3. Encrypted Vault Persistence</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Discovered receipts are serialized and encrypted using AES-256-GCM (600,000 PBKDF2 iterations)
                      before committing to IndexedDB. Vault locks automatically after inactivity or explicit lock.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 3: Security & Trust Guarantees                        */}
            {/* ------------------------------------------------------------- */}
            <section id="security-model" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    Security & trust guarantees
                  </h2>
                  <p className="text-xs text-muted-foreground">Zero key exfiltration and explicit user disclosure</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-foreground text-sm">
                    <Lock className="size-4 text-primary" />
                    Zero Key Exfiltration
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Viewing keys never enter URL route paths, query parameters, window titles, console traces, or
                    analytics. Rust WASM zeroizes scalar memory buffers immediately upon <code className="font-mono text-primary">destroyHandle()</code>.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-foreground text-sm">
                    <Info className="size-4 text-primary" />
                    Two-Stage Memo Disclosure
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Scanning compact blocks detects note values and commitments. Plaintext memo fields require an
                    explicit user confirmation before any full-transaction query. The generated WASM package
                    decrypts the selected memo locally and preserves its ZIP-302 format and raw bytes. Synthetic
                    transaction tests pass; the hosted browser flow has not yet been verified.
                  </p>
                </div>
              </div>

              <Alert variant="warning">
                <AlertTitle>Recipient Permanence Notice</AlertTitle>
                <AlertDescription>
                  When you export a <strong>context-access package</strong>, you are handing over the incoming viewing capability.
                  Because viewing keys are symmetric cryptographic secrets, recipients can inspect past and future matching receipts
                  forever. Zcash protocol does not support viewing key revocation without spending funds to a new address.
                </AlertDescription>
              </Alert>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 4: Import Formats (ZIP 316)                           */}
            {/* ------------------------------------------------------------- */}
            <section id="import-formats" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Key className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    Import formats
                  </h2>
                  <p className="text-xs text-muted-foreground">ZIP 316 Unified Incoming Viewing Keys and validation</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Import accepts incoming viewing-key files from compatible external wallets, covering the
                  supported native Orchard-family formats. During import Vinca validates receivers, network
                  metadata and the birthday, and states plainly which components are retained and which are
                  declared but not retained.
                </p>
                <p>
                  Birth phrases, spending keys, full viewing keys and wallet connection protocols are
                  rejected by design. If a file carries more authority than Vinca accepts, Vinca says so
                  instead of narrowing it silently.
                </p>
              </div>

              {/* Pool Matrix */}
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-foreground">
                  Pool & Receiver Handling Policy
                </div>
                <div className="divide-y divide-border text-xs">
                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <span className="font-semibold text-foreground">Orchard Receiver (Type 0x03)</span>
                      <p className="text-muted-foreground text-[11px]">Native halo2/Pallas curve shielded pool</p>
                    </div>
                    <Badge variant="secondary">Retained & Inspected</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <span className="font-semibold text-foreground">Sapling Receiver (Type 0x02)</span>
                      <p className="text-muted-foreground text-[11px]">Declared in UIVK multi-component container</p>
                    </div>
                    <Badge variant="muted">Declared Unretained</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <span className="font-semibold text-foreground">Full Viewing Keys (FVK / UFVK)</span>
                      <p className="text-muted-foreground text-[11px]">Carries outgoing viewing authority (OVKA)</p>
                    </div>
                    <Badge variant="destructive">Strictly Rejected</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <span className="font-semibold text-foreground">Spending Keys & Seeds</span>
                      <p className="text-muted-foreground text-[11px]">Mnemonic seed phrases, spending authority</p>
                    </div>
                    <Badge variant="destructive">Strictly Rejected</Badge>
                  </div>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 5: Retained vs Declared Pools                         */}
            {/* ------------------------------------------------------------- */}
            <section id="components-handling" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-medium tracking-tight text-foreground">
                Retained vs declared pools
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                ZIP 316 specifies that a Unified Viewing Key may bundle multiple pool items (e.g., both Orchard and
                Sapling incoming viewing keys). Vinca retains the native Orchard component for shielded note trial-decryption.
                Any declared Sapling components are recorded in the context manifest as <code className="font-mono text-primary font-semibold">declaredUnretained</code>.
                They are never silently dropped, ensuring transparency during audit.
              </p>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 6: Verified Wallet Export Steps                       */}
            {/* ------------------------------------------------------------- */}
            <section id="wallet-exports" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Terminal className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    Verified wallet export steps
                  </h2>
                  <p className="text-xs text-muted-foreground">Step-by-step export guides for Zallet, Ywallet, and Zashi</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                Vinca never connects to external wallets over network sockets or browser extensions.
                To inspect an account in Vinca, export an incoming viewing key (UIVK) as an ordinary
                text or JSON file from a compatible wallet version:
              </p>

              {/* Wallet Guide Tabs */}
              <Tabs defaultValue="zallet" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                  <TabsTrigger value="zallet">Zallet CLI</TabsTrigger>
                  <TabsTrigger value="ywallet">Ywallet</TabsTrigger>
                  <TabsTrigger value="zashi">Zashi</TabsTrigger>
                </TabsList>

                <TabsContent value="zallet" className="space-y-4 pt-2">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">Zallet (CLI / RPC v0.1.0-beta.3+)</h4>
                      <Badge variant="secondary">Recommended</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Run the CLI export command requesting the incoming viewing key for testnet or regtest:
                    </p>
                    <CodeBlock
                      code="Export the account's Unified Incoming Viewing Key using your wallet's documented export procedure."
                      language="bash"
                      filename="Terminal Command"
                    />
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p>✓ Exports a standard ZIP 316 UIVK with Orchard and Sapling components.</p>
                      <p>✓ Vinca retains the Orchard component and logs Sapling as declared unretained.</p>
                      <p>✓ Testnet UIVK prefixes are <code className="font-mono text-primary font-semibold">uivktest1...</code> (ZIP-316 revision 0) or <code className="font-mono text-primary font-semibold">uvitest1...</code> (revision 2).</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ywallet" className="space-y-4 pt-2">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">Ywallet (Desktop & Mobile)</h4>
                      <Badge variant="muted">GUI Guide</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Follow these precise steps in the Ywallet interface:
                    </p>
                    <div className="mt-3 space-y-2 rounded-lg border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-foreground">Step 1:</span>
                        <span>Open <strong>Account Settings</strong> (gear icon in the top right).</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-foreground">Step 2:</span>
                        <span>Select <strong>Export</strong> &rarr; <strong>View-Only Keys</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-foreground">Step 3:</span>
                        <span>
                          Choose <strong>"Incoming Viewing Key (UIVK)"</strong>. Do <em>not</em> select "Full Viewing Key"
                          or "Spending Key", as Vinca will reject them during preflight.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-foreground">Step 4:</span>
                        <span>Save the exported key string to a file or paste directly into the Vinca Import view.</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="zashi" className="space-y-4 pt-2">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">Zashi (Testnet builds)</h4>
                      <Badge variant="muted">Mobile Guide</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Exporting from official Zashi testnet builds:
                    </p>
                    <div className="mt-3 space-y-2 rounded-lg border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-foreground">Step 1:</span>
                        <span>Navigate to <strong>Settings</strong> &rarr; <strong>Advanced</strong> &rarr; <strong>Export Keys</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-foreground">Step 2:</span>
                        <span>Select and copy the <strong>Unified Incoming Viewing Key</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-foreground">Step 3:</span>
                        <span>
                          Verify that the exported UIVK begins with <code className="font-mono text-primary font-semibold">uivktest1</code> (ZIP-316 revision 0) or <code className="font-mono text-primary font-semibold">uvitest1</code> (revision 2).
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 7: Public Integration Contract                        */}
            {/* ------------------------------------------------------------- */}
            <section id="integration-contract" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    Public integration contract
                  </h2>
                  <p className="text-xs text-muted-foreground">The three authenticated encrypted file specifications</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Vinca exchanges only ordinary encrypted files, so external tools can process exports
                  without talking to this website. Three file kinds make up the integration contract, and
                  each one carries its kind inside authenticated metadata so files cannot be substituted:
                </p>

                <div className="grid gap-4 sm:grid-cols-3 pt-2">
                  <Card className="border-border/80 bg-card/60">
                    <CardHeader className="pb-2">
                      <Badge variant="secondary" className="w-fit text-[11px]">Continuing Access</Badge>
                      <CardTitle className="text-sm font-semibold text-foreground mt-2">
                        context-access-package:
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <p>
                        An incoming viewing capability plus explicit metadata and coverage records. Its holder
                        can inspect matching past and future receipts. Irrevocable once exported.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 bg-card/60">
                    <CardHeader className="pb-2">
                      <Badge variant="muted" className="w-fit text-[11px]">Static Records</Badge>
                      <CardTitle className="text-sm font-semibold text-foreground mt-2">
                        record-snapshot:
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <p>
                        Selected received records and optional memo fields, never a key. Recipients must treat
                        its private amounts as exporter-provided claims rather than cryptographic proof.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 bg-card/60">
                    <CardHeader className="pb-2">
                      <Badge variant="muted" className="w-fit text-[11px]">Disaster Recovery</Badge>
                      <CardTitle className="text-sm font-semibold text-foreground mt-2">
                        workspace-backup:
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <p>
                        An encrypted snapshot of the local workspace and its read-only inventory. It recovers
                        records, never wallet spending authority. Requires pass-phrase to unlock.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <p className="mt-3">
                  Across all three kinds, amounts are integer zatoshis transported as exact decimal
                  strings, networks are limited to testnet and reproducible regtest, and
                  every file states its schema version so later revisions can be interpreted safely.
                </p>
              </div>

              {/* Schema JSON Example */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Example Authenticated File Structure (JSON Schema v1.0)
                </h4>
                <CodeBlock
                  code={`{
  "vincaFileKind": "context-access-package",
  "vincaSchemaVersion": "1.0",
  "contextId": "ctx-alpha-orchard",
  "saltHex": "a4f910d57e82b719483011cd48512903",
  "kdfIterations": 600000,
  "envelope": {
    "nonceHex": "e1f9801d4a02c918237190ae",
    "ciphertextHex": "68af380d90e21a8f...[AES-256-GCM AEAD]...",
    "tagHex": "bc1982701f41da020914"
  },
  "createdAtUtc": "2026-10-25T07:00:00.000Z"
}`}
                  language="json"
                  filename="context-access-package.vinca.json"
                />
              </div>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 8: Anti-Substitution Guarantee                       */}
            {/* ------------------------------------------------------------- */}
            <section id="anti-substitution" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-medium tracking-tight text-foreground">
                Anti-substitution guarantee
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                To prevent attackers from substituting a static <code className="font-mono text-primary font-semibold">record-snapshot</code> for a
                live <code className="font-mono text-primary font-semibold">context-access-package</code> (or vice versa), the <code className="font-mono text-primary font-semibold">vincaFileKind</code> identifier
                is injected into the Authenticated Additional Data (AAD) of the AES-256-GCM AEAD cipher during encryption.
                Modifying the envelope type causes immediate AEAD tag verification failure (<code className="font-mono text-destructive">AUTHENTICATION_TAG_MISMATCH</code>).
              </p>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 9: SDK & Service Interfaces                           */}
            {/* ------------------------------------------------------------- */}
            <section id="sdk-interfaces" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileCode className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    SDK & service interfaces
                  </h2>
                  <p className="text-xs text-muted-foreground">Decoupled port contracts separating computation, storage, and chain access</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                Vinca defines three decoupled port contracts separating computation, persistence, and
                chain data. These TypeScript contracts mirror the Rust WASM worker and relay interfaces:
              </p>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                    <Cpu className="size-4 text-primary" />
                    <span>VincaWorkerPort (WebAssembly Worker)</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Direct RPC facade communicating with the sandboxed Web Worker:
                  </p>
                  <CodeBlock
                    code={`export interface VincaWorkerPort {
  decodeUivk(rawBytes: Uint8Array, network: Network): Promise<WorkerDecodedKeyResult>;
  scanRange(handle: OpaqueKeyHandle, range: CoverageRange, compactBlocks: Uint8Array): Promise<WorkerScanResult>;
  decryptMemo(handle: OpaqueKeyHandle, txBytes: Uint8Array, receipt: Receipt): Promise<WorkerDecryptedMemoResult>;
  destroyHandle(handle: OpaqueKeyHandle): Promise<void>;
}`}
                    language="typescript"
                    filename="adapters/types.ts"
                  />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                    <Database className="size-4 text-primary" />
                    <span>VincaVaultPort (IndexedDB Encrypted Storage)</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hardware-accelerated WebCrypto AES-GCM local vault operations:
                  </p>
                  <CodeBlock
                    code={`export interface VincaVaultPort {
  initializeVault(passphrase: string): Promise<void>;
  unlockVault(passphrase: string): Promise<boolean>;
  saveEncryptedContext(context: ContextSummary, payload: Uint8Array): Promise<void>;
  exportRecoveryBackup(passphrase: string): Promise<RecoveryBackupBundle>;
  importRecoveryBackup(bundle: RecoveryBackupBundle, passphrase: string): Promise<RecoveryRestoreResult>;
}`}
                    language="typescript"
                    filename="adapters/types.ts"
                  />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                    <Network className="size-4 text-primary" />
                    <span>VincaRelayPort (Public Chain Relay HTTP Facade)</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Axum/Tokio HTTP client fetching sanitized lightwalletd chain blocks:
                  </p>
                  <CodeBlock
                    code={`export interface VincaRelayPort {
  checkHealth(): Promise<RelayHealthReport>;
  getTipHeight(network: Network): Promise<number>;
  fetchCompactBlocks(network: Network, range: CoverageRange): Promise<Uint8Array>;
  fetchTransaction(network: Network, txIdHex: string): Promise<Uint8Array>;
}`}
                    language="typescript"
                    filename="adapters/types.ts"
                  />
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 10: Networks and Coverage                            */}
            {/* ------------------------------------------------------------- */}
            <section id="networks" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Network className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    Networks and coverage
                  </h2>
                  <p className="text-xs text-muted-foreground">Supported test networks, contiguous intervals, and gap reporting</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Vinca works against testnet and reproducible regtest profiles and rejects mainnet
                  encodings, profiles and endpoints. Each context records a birthday as a scan starting
                  point and expresses coverage as contiguous block ranges, keeping gaps and unsupported
                  periods visible rather than presenting a complete history.
                </p>
                <p>
                  A birthday bound or a scan range limits what Vinca itself has inspected. It never limits
                  what a holder of an exported capability can inspect elsewhere.
                </p>
              </div>

              {/* Coverage Gaps Visualizer Card */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Explicit Coverage Gaps Policy
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Unlike traditional wallets that gloss over missing scan ranges, Vinca explicitly tags coverage intervals.
                  If a node failure or worker restart occurs, the gap is exposed as an uninspected interval (e.g. <code className="font-mono text-primary font-semibold">2705000–2709999</code>)
                  instead of silently presenting false zero-balances.
                </p>
                <div className="flex items-center gap-2 font-mono text-[11px] bg-muted/60 p-3 rounded-lg border border-border">
                  <span className="text-emerald-500 font-semibold">[2700000..2704999]</span>
                  <span className="text-muted-foreground">&rarr;</span>
                  <span className="rounded bg-destructive/15 px-2 py-0.5 text-destructive font-semibold">GAP: 2705000..2709999</span>
                  <span className="text-muted-foreground">&rarr;</span>
                  <span className="text-emerald-500 font-semibold">[2710000..2715000]</span>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------- */}
            {/* SECTION 11: Known Limitations                                */}
            {/* ------------------------------------------------------------- */}
            <section id="limitations" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
                    Known limitations
                  </h2>
                  <p className="text-xs text-muted-foreground">Design boundaries, safety thresholds, and recovery caveats</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Live scanning and local note inspection run directly in the browser against testnet and
                  regtest chains. Mainnet viewing keys and network endpoints remain permanently disabled
                  by design.
                </p>
                <p>
                  The generated WASM package exposes full-transaction memo decryption, and offline transaction
                  import uses the same local verification path without contacting the relay. Synthetic transaction
                  vectors and focused tests pass. The complete browser flow remains unverified because the local
                  browser could not access the hosted relay; no user key or transaction was used.
                </p>
                <p>
                  Recovery depends on your own encrypted exports rather than any hosted copy of the
                  workspace. Treat the loss of a device without a recovery file as permanent.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
                  <h5 className="font-semibold text-foreground">Filters are Not Cryptographic</h5>
                  <p className="text-muted-foreground leading-relaxed">
                    UI filters (e.g., date ranges, minimum amount) only filter the local presentation view. If you export a
                    viewing key, the recipient gains cryptographic power to inspect all notes regardless of UI filters.
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
                  <h5 className="font-semibold text-foreground">Snapshots are Not Payment Proof</h5>
                  <p className="text-muted-foreground leading-relaxed">
                    Amounts and memos in a <code className="font-mono text-primary">record-snapshot</code> are assertions made by the exporter.
                    Recipients must not treat them as independently verified cryptographic proof without live chain inspection.
                  </p>
                </div>
              </div>
            </section>

            {/* Bottom Navigation CTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-foreground">Ready to try Vinca?</h3>
                <p className="text-xs text-muted-foreground">
                  Explore sample testnet viewing keys or unlock your browser workspace.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" asChild>
                  <Link to="/demo">Launch Demo Sandbox</Link>
                </Button>
                <Button asChild>
                  <Link to="/app">
                    Open Workbench
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>

          </main>

          {/* ================================================================= */}
          {/* COLUMN 3 (RIGHT): Sticky Table of Contents & Quick Reference Card */}
          {/* ================================================================= */}
          <aside className="hidden xl:block">
            <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-6 overflow-y-auto pl-3">

              {/* On This Page TOC */}
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                  <Hash className="size-3.5 text-primary" />
                  <span>On this page</span>
                </div>
                <nav className="mt-4 flex flex-col gap-1 text-xs">
                  {TOC_SECTIONS.map((item) => {
                    const isActive = activeId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-left transition-colors truncate",
                          isActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Quick Reference Box */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 text-xs shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Protocol Snapshot</span>
                  <Badge variant="secondary" className="text-[10px]">Active</Badge>
                </div>

                <div className="divide-y divide-border/60 text-[11px]">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Schema Version:</span>
                    <span className="font-mono font-medium text-foreground">v1.0 (Strict)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Cipher:</span>
                    <span className="font-mono font-medium text-foreground">AES-256-GCM</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">KDF:</span>
                    <span className="font-mono font-medium text-foreground">PBKDF2 (600k)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Key Standard:</span>
                    <span className="font-mono font-medium text-foreground">ZIP 316 UIVK</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Networks:</span>
                    <span className="font-mono font-medium text-foreground">Testnet / Regtest</span>
                  </div>
                </div>
              </div>

              {/* Security Checklist Widget */}
              <div className="rounded-2xl border border-border/80 bg-muted/40 p-5 text-xs space-y-2.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5 text-primary" />
                  Security Assurances
                </span>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-primary shrink-0" />
                    <span>Keys never touch disk in plaintext</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-primary shrink-0" />
                    <span>Isolated Web Worker sandbox</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-primary shrink-0" />
                    <span>Zero telemetry or analytics</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-primary shrink-0" />
                    <span>Anti-substitution AAD tags</span>
                  </li>
                </ul>
              </div>

            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
