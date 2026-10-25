/*
  Public copy baseline, transcribed from prd.md phase 2. The landing page and
  tests consume these constants together, so the required copy stays present
  even as layout evolves. Body copy follows the PRD writing rules: complete
  sentences of roughly 20-45 words, no em dashes, no hype, no invented
  endorsements or adoption numbers.
*/

export const HERO_COPY = {
  brand: "Vinca",
  badge: "A read-only toolkit for Zcash developers.",
  line1: "Understand what you share",
  line2: "before you share it.",
  description:
    "Vinca helps wallet and application developers inspect receiving-key scope, compare contexts, and prepare deliberate disclosures. Private inspection happens in your browser, and each export distinguishes continuing incoming access from selected payment records.",
  primaryLabel: "Open dashboard",
  primaryHref: "/app",
  secondaryLabel: "Explore the workflow",
  secondaryHref: "#how-it-works",
  bottomSentence:
    "Your wallet retains spending authority while Vinca helps you understand and share incoming access deliberately.",
} as const;

export const WORKFLOW_COPY = {
  paragraph:
    "Import an incoming viewing key from a compatible wallet and review the access it carries. Inspect received notes locally, then choose whether to share that continuing access or export only the records you need.",
  steps: [
    {
      title: "Import",
      body: "Bring an incoming viewing-key file from an external wallet. Vinca validates the receivers, network and birthday it declares, and reports any components it does not retain for inspection.",
    },
    {
      title: "Inspect locally",
      body: "Coverage is presented as contiguous block ranges with gaps stated openly. Amounts stay exact integer values, and a memo is retrieved only when you deliberately ask for the containing transaction.",
    },
    {
      title: "Disclose deliberately",
      body: "Export a context-access package when the recipient should follow the account, or a record snapshot when they only need the specific entries you selected.",
    },
  ],
} as const;

export const CONTEXT_ACCESS_EXPLANATION =
  "A context-access package lets its holder inspect incoming data covered by the key, including later payments. Vinca explains this scope before sharing because a date filter or deleted file cannot revoke a key someone already holds.";

export const SNAPSHOT_EXPLANATION =
  "A record snapshot contains the entries you select without including a viewing key. It is useful for sharing information, but recipients should not treat the exported private amounts or memos as an independently verified payment proof.";

export const CLOSING_COPY = {
  title: "Open the dashboard when you are ready.",
  body: "Explore the fixture-backed dashboard to review sample contexts and received records without supplying private material. Real key import, live scanning and encrypted exports are not connected in this preview.",
  actionLabel: "Open dashboard",
} as const;
