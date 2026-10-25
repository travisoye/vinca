import { DocPage, DocSection, DocToc } from "./doc-page";

const toc = [
  { id: "scope", label: "Scope of the toolkit" },
  { id: "spending-boundary", label: "Spending boundary" },
  { id: "verification", label: "What exports can prove" },
  { id: "disclosure-limits", label: "Disclosure limits" },
  { id: "availability", label: "Availability and changes" },
] as const;

function TermsPage() {
  return (
    <DocPage
      title="Terms"
      description="The terms that apply to using the Vinca interface, written to match what the toolkit can actually do."
    >
      <DocToc items={toc} />

      <DocSection id="scope" title="Scope of the toolkit">
        <p>
          Vinca is a read-only interface for understanding and disclosing incoming viewing access
          to Zcash payments. You may use it to import viewing material you are entitled to inspect,
          to review your own records, and to prepare encrypted files for recipients you choose.
        </p>
      </DocSection>

      <DocSection id="spending-boundary" title="Spending boundary">
        <p>
          Vinca cannot spend, freeze, move or custody funds. Your wallet retains every spending
          capability, and nothing in the toolkit should ever be treated as a way to recover one.
          Requests for phrases or spending keys are phishing against this boundary.
        </p>
      </DocSection>

      <DocSection id="verification" title="What exports can prove">
        <p>
          An encrypted export authenticates possession of its file secret and binds the data it
          contains. It does not verify a human recipient, does not prove the exporter reported
          private amounts truthfully, and does not carry consensus-complete payment proof. Records
          show their evidence labels and nothing more.
        </p>
      </DocSection>

      <DocSection id="disclosure-limits" title="Disclosure limits">
        <p>
          A context-access package grants continuing access that its holder can keep and reshare.
          Archiving a context, deleting a file, changing a passphrase or exporting a filtered
          selection does not revoke anything a recipient already holds. Treat every export as
          permanent until you have confirmed your recipient once more.
        </p>
      </DocSection>

      <DocSection id="availability" title="Availability and changes">
        <p>
          This release targets testnet and regtest and treats mainnet encodings as rejected input.
          Since the workspace lives only in your browser, availability depends on your browser and
          locally saved recovery files rather than a hosted guarantee. Terms updates appear on this
          page as the toolkit changes.
        </p>
      </DocSection>
    </DocPage>
  );
}

export { TermsPage };
