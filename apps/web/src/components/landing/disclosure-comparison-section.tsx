/*
  A shared comparison panel makes ongoing capability and fixed records visually
  distinct while preserving the disclosure explanations and scope cautions.
*/
import { ArrowRight, Ban, Files, KeyRound, LockKeyhole, Split, TriangleAlert } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CONTEXT_ACCESS_EXPLANATION, SNAPSHOT_EXPLANATION } from "@/lib/copy";
import { cn } from "@/lib/utils";

const columns = [
  {
    id: "context-access-package",
    title: "Context access",
    eyebrow: "Follow an account",
    badge: "Continuing access",
    icon: KeyRound,
    continuing: true,
    explanation: CONTEXT_ACCESS_EXPLANATION,
    caption: "Matching incoming payments can remain visible.",
    facts: [
      { label: "Viewing key", value: "Imported key + validation metadata" },
      { label: "Visible records", value: "Matching earlier and later receipts" },
      { label: "Coverage", value: "History recorded at export time" },
    ],
    cautions: [
      "Archiving, deletion, file expiry or a new passphrase cannot revoke a copy the recipient already holds",
      "A date, pool or address filter in the dialogue is not a cryptographic restriction",
    ],
  },
  {
    id: "record-snapshot",
    title: "Record snapshot",
    eyebrow: "Share specific entries",
    badge: "Keyless record snapshot",
    icon: Files,
    continuing: false,
    explanation: SNAPSHOT_EXPLANATION,
    caption: "Selected records, without access to later payments.",
    facts: [
      { label: "Viewing key", value: "No viewing key" },
      { label: "Visible records", value: "Only the entries you select" },
      { label: "After export", value: "Future activity stays outside the file" },
    ],
    cautions: [
      "Private amounts and memos are exporter-provided information, not independently verified payment proof",
      "Identity of any person behind the file is never verified by its encryption",
    ],
  },
] as const;

function DisclosureComparisonSection() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section
      id="disclosures"
      aria-labelledby="disclosures-heading"
      aria-describedby="disclosure-explainer"
      className="section-space scroll-mt-24 border-t border-border bg-muted/40"
    >
      <div className="site-container space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="min-w-0 max-w-2xl space-y-6">
            <div className="eyebrow">
              <Split className="size-3.5 text-primary" aria-hidden="true" />
              Two kinds of sharing
            </div>
            <h2
              id="disclosures-heading"
              className="section-title"
            >
              Compare what a recipient actually gets.
            </h2>
          </div>
          <p className="body-copy max-w-sm">
            Choose between ongoing incoming access and a fixed set of records. Both leave your
            browser as encrypted files you share yourself.
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            {columns.map((column, colIdx) => (
              <motion.article
                key={column.id}
                aria-labelledby={`${column.id}-heading`}
                initial={reduceMotion ? false : { opacity: 0, x: colIdx === 0 ? -36 : 36 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: colIdx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className={cn("flex min-w-0 flex-col p-6", column.continuing && "bg-primary/[0.04]")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{column.eyebrow}</p>
                    <CardTitle id={`${column.id}-heading`} className="text-xl">
                      {column.title}
                    </CardTitle>
                  </div>
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-lg border",
                      column.continuing
                        ? "border-primary/15 bg-primary/10 text-primary"
                        : "border-border bg-muted text-foreground",
                    )}
                  >
                    <column.icon className="size-5" aria-hidden="true" />
                  </span>
                </div>

                <Badge variant={column.continuing ? "success" : "muted"} className="mt-4 w-fit">
                  {column.badge}
                </Badge>

                <motion.figure
                  className="my-6 rounded-lg border border-border bg-background/70 p-4"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 + colIdx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div aria-hidden="true" className="relative grid grid-cols-3 gap-2">
                    <motion.span
                      className="absolute left-[16.67%] right-1/2 top-4 border-t-2 border-primary/40"
                      initial={reduceMotion ? false : { scaleX: 0, originX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.35 + colIdx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.span
                      className={cn(
                        "absolute left-1/2 right-[16.67%] top-4 border-t-2",
                        column.continuing ? "border-primary/40" : "border-dashed border-border",
                      )}
                      initial={reduceMotion ? false : { scaleX: 0, originX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.45 + colIdx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {["Earlier", "Export", "Later"].map((phase, index) => (
                      <motion.div
                        key={phase}
                        className="flex flex-col items-center gap-2"
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.45, delay: 0.3 + colIdx * 0.1 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <span
                          className={cn(
                            "relative flex size-8 items-center justify-center rounded-full border transition-transform duration-200",
                            index === 2 && !column.continuing
                              ? "border-border bg-background text-muted-foreground"
                              : "border-primary/20 bg-background text-primary",
                          )}
                        >
                          {index === 1 ? <column.icon className="size-3.5" /> : index === 2 ? (
                            column.continuing ? <ArrowRight className="size-3.5" /> : <Ban className="size-3.5" />
                          ) : <span className="size-2 rounded-full bg-primary" />}
                        </span>
                        <span className="text-xs text-muted-foreground">{phase}</span>
                      </motion.div>
                    ))}
                  </div>
                  <figcaption className="mt-4 text-center text-xs font-medium leading-relaxed">
                    {column.caption}
                  </figcaption>
                </motion.figure>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {column.explanation}
                </p>

                <dl className="my-6 divide-y divide-border border-y border-border">
                  {column.facts.map((fact) => (
                    <div key={fact.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 py-4 text-sm leading-relaxed">
                      <dt className="text-muted-foreground">{fact.label}</dt>
                      <dd className="font-medium">{fact.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto rounded-lg border border-border bg-background/70 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-medium">
                    <TriangleAlert className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    Know the limits
                  </h4>
                  <ul className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                    {column.cautions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="flex flex-col gap-4 border-t border-border bg-muted/50 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-2xl items-start gap-3">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p id="disclosure-explainer" className="text-sm leading-relaxed text-muted-foreground">
                Both exports are ordinary encrypted files. They travel by your own channels, never
                through a Vinca upload or sharing link.
              </p>
            </div>
            <Button asChild variant="outline" className="self-start lg:self-auto">
              <Link to="/docs">
                Read the export formats
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

export { DisclosureComparisonSection };
