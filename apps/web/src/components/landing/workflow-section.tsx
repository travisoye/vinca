/*
  Three-step workflow sequence (prd.md landing sequence, item 3): import,
  inspection and deliberate disclosure. Rendered as varied editorial rows, not
  a repeated feature-card grid.
*/
import { motion, useReducedMotion } from "motion/react";
import { Download, ScanLine, SendHorizonal } from "lucide-react";
import { WORKFLOW_COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { LandingSection } from "./section";

const stepIcons = [Download, ScanLine, SendHorizonal] as const;

function WorkflowSection() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <LandingSection
      id="how-it-works"
      eyebrow="How it works"
      title="Three deliberate steps."
      lead={WORKFLOW_COPY.paragraph}
    >
      <ol className="flex flex-col">
        {WORKFLOW_COPY.steps.map((step, index) => {
          const reversed = index % 2 === 1;
          const Icon = stepIcons[index];
          return (
            <motion.li
              key={step.title}
              initial={reduceMotion ? false : { opacity: 0, x: reversed ? 40 : -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className={cn(
                  "flex min-w-0 flex-col gap-6 border-b border-border py-8 md:flex-row md:items-start md:gap-12",
                  reversed && "md:flex-row-reverse",
                )}
              >
                <span
                  aria-hidden
                  className="font-mono text-5xl font-light text-muted-foreground/50 transition-colors duration-300"
                >
                  {`0${index + 1}`}
                </span>
                <div className={cn("flex min-w-0 flex-col gap-3 md:max-w-xl", reversed && "md:text-right")}>
                  <h3 className="flex items-center gap-3 text-lg font-medium leading-tight tracking-tight md:justify-start">
                    {!reversed ? <Icon className="size-5 text-primary" aria-hidden /> : null}
                    {step.title}
                    {reversed ? <Icon className="size-5 text-primary" aria-hidden /> : null}
                  </h3>
                  <p className="body-copy">{step.body}</p>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </LandingSection>
  );
}

export { WorkflowSection };
