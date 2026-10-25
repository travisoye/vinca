/*
  Watermelon Features3 layout adapted to Vinca's product copy and explicitly
  labelled fixture data. Cards stack on small screens to keep every value readable.
*/
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fixtureContexts } from "@/fixtures";

const sampleContext = fixtureContexts[0];

function ProductSection() {
  const reduceMotion = useReducedMotion() ?? false;
  const coverage = sampleContext.coverage;
  const span = Number(coverage.tipHeight ?? coverage.lastScannedHeight) - coverage.birthdayHeight + 1;
  const scanned = coverage.scannedRanges.reduce((sum, range) => sum + (range.endHeight - range.startHeight + 1), 0);
  const scannedPct = Math.round((scanned / span) * 100);

  return (
    <section
      id="product"
      aria-labelledby="product-heading"
      className="section-space w-full scroll-mt-24 border-t border-border bg-background"
    >
      <div className="site-container grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0 space-y-6">
          <div className="eyebrow">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
            What Vinca does
          </div>

          <h2 id="product-heading" className="section-title">
            Inspect before you disclose.
          </h2>

          <p className="body-copy max-w-lg">
            Vinca gives wallet and payment developers a dedicated workspace for incoming viewing
            material. Import a key file, review exactly what it can see, and keep parsing and
            decryption inside your own browser.
          </p>

          <ul aria-label="Product benefits" className="space-y-2">
            {[
              "Inspect incoming viewing material locally",
              "Keep contexts and received records separate",
              "Compare overlapping imports before sharing",
              "Review what a recipient can actually access",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">{item}</p>
              </li>
            ))}
          </ul>

          <Button asChild size="lg">
            <Link to="/app">Get started</Link>
          </Button>
        </div>

        <div
          role="group"
          aria-label="Sample inspection preview using bundled fixture data"
          className="relative isolate flex min-w-0 flex-col items-center gap-4 rounded-xl border border-border bg-muted/50 p-6"
        >
          <p className="w-full text-xs text-muted-foreground">Sample preview</p>
          <div className="grid w-full max-w-md gap-4">
            <motion.div
              className="w-full sm:max-w-72 sm:justify-self-start"
              initial={reduceMotion ? false : { opacity: 0, x: -36, y: 16 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="w-full">
                <CardContent className="space-y-2 p-4">
                  <h3 className="text-sm font-medium leading-tight tracking-tight">Context overview</h3>

                  <div className="text-2xl font-medium">
                    {sampleContext.receiptCount}{" "}
                    <span className="text-sm font-normal text-muted-foreground">received records</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{sampleContext.network}</Badge>
                    <Badge variant="success">{sampleContext.status}</Badge>
                  </div>

                  <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                    <div>{sampleContext.label}</div>
                    <div>{sampleContext.supportedPools.join(" + ")}</div>
                    <div>sapling declared, not retained</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              className="relative w-full sm:-mt-2 sm:max-w-64 sm:justify-self-end"
              initial={reduceMotion ? false : { opacity: 0, x: 36, y: 16 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="w-full">
                <CardContent className="space-y-3 p-4">
                  <h3 className="text-sm font-medium leading-tight tracking-tight">Coverage breakdown</h3>

                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{scannedPct}% scanned</span>{" "}
                    on {sampleContext.network}
                  </p>

                  <div
                    role="meter"
                    aria-label="Sample scan coverage"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={scannedPct}
                    aria-valuetext={`${scannedPct}% scanned, with a stated gap before the chain tip`}
                    className="flex h-2 w-full gap-1"
                  >
                    <motion.div
                      className="rounded-full bg-primary"
                      initial={reduceMotion ? false : { width: "0%" }}
                      whileInView={{ width: `${scannedPct}%` }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <div className="flex-1 rounded-full bg-muted-foreground" data-testid="coverage-gap" />
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
                      Scanned
                    </span>
                    <span className="flex items-center gap-1">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-muted-foreground" />
                      Gap before tip
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Through block {coverage.lastScannedHeight?.toLocaleString("en-US")}. Coverage is stale.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              className="relative w-full sm:-mt-2 sm:ml-6 sm:max-w-72"
              initial={reduceMotion ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="w-full">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <h3 className="font-medium leading-tight tracking-tight">Received records</h3>
                    <span className="text-xs text-muted-foreground">Sample</span>
                  </div>

                  <ul className="space-y-2 font-mono text-sm text-muted-foreground">
                    <li className="flex justify-between gap-2">
                      <span>orchard</span>
                      <span className="text-foreground">1.23456789 ZEC</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>ironwood</span>
                      <span className="text-foreground">25 ZEC</span>
                    </li>
                  </ul>

                  <p className="text-xs leading-relaxed text-muted-foreground">Exact amounts. Sample values only.</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { ProductSection };
