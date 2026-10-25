/*
  High-contrast closing action with explicit preview limits. The dashboard
  destination stays functional without suggesting that real imports are available.
*/
import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { CLOSING_COPY } from "@/lib/copy";

function ClosingCta() {
  return (
    <section aria-labelledby="closing-heading" className="surface-inverse section-space border-t border-border">
      <div className="site-container">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-12">
          <div className="min-w-0 space-y-6">
            <div className="eyebrow">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              Begin with the sample
            </div>
            <h2 id="closing-heading" className="section-title max-w-2xl">
              {CLOSING_COPY.title}
            </h2>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Your wallet retains spending authority.
            </p>
          </div>

          <div className="min-w-0 space-y-6">
            <p className="body-copy max-w-md">{CLOSING_COPY.body}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg">
                <Link to="/app">
                  {CLOSING_COPY.actionLabel}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
              >
                <a href="/docs#limitations">Understand the preview</a>
              </Button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export { ClosingCta };
