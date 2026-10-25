/*
  Privacy FAQ (prd.md landing sequence, item 6): custody, disclosure scope,
  evidence levels, recovery and source metadata. Native details/summary keeps
  it keyboard and screen-reader friendly without extra dependencies.
*/
import { ArrowUpRight, ChevronDown, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Question {
  question: string;
  answer: string;
}

const questions: Question[] = [
  {
    question: "Who holds custody of my funds?",
    answer:
      "Your external wallet keeps every spending capability. Vinca is designed to accept incoming viewing material only, never seeds or spending keys. The current preview uses sample records and does not import real key files.",
  },
  {
    question: "What can a recipient do after I share?",
    answer:
      "A context-access package gives its holder the incoming capability, including matching later payments. A record snapshot contains selected entries without a key. Deleting your export or changing a passphrase cannot revoke a copy already shared.",
  },
  {
    question: "How do evidence levels work?",
    answer:
      "Evidence labels describe where a record came from: sample data, local inspection, or an exporter's assertion. Those labels do not turn private amounts or memos into independently verified payment proof.",
  },
  {
    question: "What happens if my browser loses its storage?",
    answer:
      "Browser storage can be cleared, and Vinca has no hosted copy to restore. Encrypted workspace backups are planned, not available in this preview. They recover read-only records, not spending authority; restored coverage must remain stale until refreshed.",
  },
  {
    question: "What does the relay observe?",
    answer:
      "The planned relay serves public block ranges and deliberately requested transactions. It can observe connections and those requests, but must never receive viewing keys, labels, amounts, memos or decrypted records. No relay is connected in this preview.",
  },
];

function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="section-space scroll-mt-24 border-t border-border bg-muted/40"
    >
      <div className="site-container grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0 space-y-6">
          <div className="eyebrow">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            Questions, answered
          </div>
          <h2 id="faq-heading" className="section-title">
            Custody, scope, evidence and recovery.
          </h2>
          <p className="body-copy max-w-sm">
            Know what stays in your wallet, what leaves your browser, and what a shared file can
            and cannot prove.
          </p>
          <Button asChild variant="outline">
            <Link to="/privacy">
              Read the privacy boundary
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
          <div className="flex max-w-sm items-start gap-3 rounded-xl border border-border bg-background/70 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium">A preview, not a live wallet.</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This build uses public sample records. Real import, live scanning and encrypted
                recovery are not connected.
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {questions.map((item, index) => (
            <details key={item.question} className="faq-item group border-b border-border last:border-b-0 open:bg-muted/30">
              <summary className="flex min-h-11 cursor-pointer items-center gap-4 px-6 py-4 text-sm font-medium transition-colors hover:bg-muted/30 md:text-base">
                <span aria-hidden="true" className="shrink-0 font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">{item.question}</span>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                  <ChevronDown className="faq-chevron size-4 text-muted-foreground transition-transform duration-200" aria-hidden="true" />
                </span>
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground md:pl-16">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export { FaqSection };
