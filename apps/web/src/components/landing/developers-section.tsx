/*
  Developer-facing contract preview and architecture overview. Implementation
  status stays explicit so planned protocol services do not look like a shipped SDK.
*/
import { ArrowRight, Braces, Code2, Cpu, Radio } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const architectureRows = [
  {
    name: "React dashboard",
    icon: Braces,
    status: "Available preview",
    body: "Typed interfaces and fixture adapters connect the screens today. Service boundaries keep presentation separate from inspection and disclosure.",
  },
  {
    name: "Rust inspection core",
    icon: Cpu,
    status: "Planned integration",
    body: "Incoming-key decoding, receiver validation and note inspection are planned behind a narrow API, compiled as a browser WebAssembly worker.",
  },
  {
    name: "Public-data relay",
    icon: Radio,
    status: "Planned integration",
    body: "The planned transport serves public chain data, not private workspace material. Viewing keys, labels, amounts and decrypted memos stay outside its API.",
  },
] as const;

const contractSnippet = `interface VincaContextPort {
  listContexts(): Promise<readonly ContextSummary[]>;
  getContext(id: string): Promise<ContextSummary | null>;
  listReceipts(contextId: string): Promise<readonly Receipt[]>;
}`;

function DevelopersSection() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section
      id="developers"
      aria-labelledby="developers-heading"
      className="section-space scroll-mt-24 border-t border-border bg-background"
    >
      <div className="site-container space-y-8">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0 space-y-6">
            <div className="eyebrow">
              <Code2 className="size-4 text-primary" aria-hidden="true" />
              For developers
            </div>
            <h2
              id="developers-heading"
              className="section-title"
            >
              A toolkit around the interface.
            </h2>
            <p className="body-copy max-w-lg">
              Build around clear contracts, not a hosted black box. Vinca separates the dashboard,
              inspection core and public-data transport so each integration can preserve the same
              privacy boundary.
            </p>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              The current preview uses typed service ports and bundled fixture adapters. The
              Rust/WebAssembly core and public-data relay remain planned integrations, not a
              published SDK.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg">
                <a href="/docs#integration-contract">
                  Read the developer docs
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/app">
                  View the sample inventory
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          <motion.figure
            className="min-w-0"
            initial={reduceMotion ? false : { opacity: 0, x: 40, y: 12 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.75, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="surface-inverse min-w-0 overflow-hidden rounded-xl border border-border shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 text-xs">
                <div className="flex min-w-0 items-center gap-2 font-mono text-muted-foreground">
                  <Braces className="size-4 shrink-0" aria-hidden="true" />
                  <span className="break-all">src/adapters/types.ts</span>
                </div>
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
                  TypeScript
                </span>
              </div>
              <div className="px-6 pt-6 font-mono text-xs text-muted-foreground">
                // Context service contract
              </div>
              <pre tabIndex={0} aria-label="Context service contract" className="max-w-full overflow-x-auto px-6 pb-6 pt-3 font-mono text-sm leading-relaxed">
                <code>{contractSnippet}</code>
              </pre>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-muted/30 px-6 py-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                  Fixture-backed preview
                </span>
                <span>Real adapters arrive in later phases</span>
              </div>
            </div>
            <figcaption className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Source excerpt, not a standalone SDK example. The current adapters return sample
              data without parsing keys or contacting a relay.
            </figcaption>
          </motion.figure>
        </div>

        <div className="grid gap-6 rounded-xl border border-border bg-muted/40 p-6 md:grid-cols-3">
          {architectureRows.map((row, index) => (
            <motion.div
              key={row.name}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.65, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={cn("min-w-0 space-y-3", index > 0 && "md:border-l md:border-border md:pl-6")}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <row.icon className="size-4 text-primary" aria-hidden="true" />
                {row.status}
              </div>
              <h3 className="text-lg font-medium leading-tight tracking-tight">{row.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{row.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { DevelopersSection };
