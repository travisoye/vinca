import Hero from "@/components/hero/hero";
import { ProductSection } from "@/components/landing/product-section";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { DisclosureComparisonSection } from "@/components/landing/disclosure-comparison-section";
import { DevelopersSection } from "@/components/landing/developers-section";
import { FaqSection } from "@/components/landing/faq-section";
import { ClosingCta } from "@/components/landing/closing-cta";

/**
 * Complete landing page (prd.md phase 2 sequence):
 * 1. Supplied hero with Vinca copy and functional actions
 * 2. Editorial product explanation beside a labelled inspection preview
 * 3. Three-step workflow (import, local inspection, deliberate disclosure)
 * 4. Side-by-side comparison of the two disclosure formats
 * 5. Concise developer integration section
 * 6. Privacy FAQ (custody, scope, evidence, recovery, source metadata)
 * 7. Closing dashboard action (restrained footer lives in PublicLayout)
 */
function LandingPage() {
  return (
    <div>
      <Hero />
      <ProductSection />
      <WorkflowSection />
      <DisclosureComparisonSection />
      <DevelopersSection />
      <FaqSection />
      <ClosingCta />
    </div>
  );
}

export { LandingPage };
