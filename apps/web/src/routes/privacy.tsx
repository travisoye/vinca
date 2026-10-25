import { DocPage, DocSection, DocToc } from "./doc-page";

const toc = [
  { id: "stays-local", label: "What stays in your browser" },
  { id: "relay-visibility", label: "What the relay can see" },
  { id: "storage", label: "Storage and recovery" },
  { id: "memos", label: "Memo retrieval" },
  { id: "accounts", label: "Accounts and telemetry" },
  { id: "limits", label: "What this page does not claim" },
] as const;

function PrivacyPage() {
  return (
    <DocPage
      title="Privacy"
      description="What Vinca processes locally, what a public-data relay can observe, and what neither accounting nor encryption can promise."
    >
      <DocToc items={toc} />

      <DocSection id="stays-local" title="What stays in your browser">
        <p>
          Imported viewing material, labels, received records, memos and disclosure history are
          processed in your browser and encrypted before they are written to local storage. No
          private workspace database exists on any Vinca server, and no cloud sync exists to lose
          or leak that material.
        </p>
        <p>
          Your external wallet keeps total spending custody. Nothing in this flow asks for seeds or
          spending keys, which protects you from Vinca the same way it protects the toolkit from
          holding what it cannot.
        </p>
      </DocSection>

      <DocSection id="relay-visibility" title="What the relay can see">
        <p>
          The relay serves public chain data. A source can observe your connection, the ranges you
          fetch and the specific transaction ids you deliberately request. Traffic correlation
          against real-world events is outside Vinca's guarantee, and this page does not claim
          otherwise.
        </p>
        <p>
          Viewing keys, labels, amounts, memos, decrypted records and disclosure files are never
          transmitted to the relay, and routine logs keep deliberately requested transaction
          queries out of application paths.
        </p>
      </DocSection>

      <DocSection id="storage" title="Storage and recovery">
        <p>
          The workspace lives in browser storage behind a passphrase you choose, protected by
          inactivity locking. Browsers clear storage for their own reasons, and browser profile
          loss is unrecoverable except through an encrypted recovery file you exported yourself.
        </p>
        <p>
          Restored coverage stays marked stale until it is refreshed, and an older backup does not
          automatically discover contexts created after the backup was taken.
        </p>
      </DocSection>

      <DocSection id="memos" title="Memo retrieval">
        <p>
          Scanning alone never fetches matching transactions. A memo is requested explicitly, with
          a disclosure of the privacy implication of asking for that transaction, or imported
          offline from a file you supply. Unrequested defaults do not exist here.
        </p>
      </DocSection>

      <DocSection id="accounts" title="Accounts and telemetry">
        <p>
          There are no accounts, no email registration, no wallet login and no password recovery.
          The frontend claims no analytics, session replay or third-party tracking, and errors are
          not reported through channels that receive private payloads.
        </p>
      </DocSection>

      <DocSection id="limits" title="What this page does not claim">
        <p>
          Encryption proves possession of a file's secret; it does not prove who holds it or that
          the reported amounts are truthful. Compromised devices, malicious frontend updates and
          complete protection from traffic analysis remain outside any promise Vinca makes.
        </p>
      </DocSection>
    </DocPage>
  );
}

export { PrivacyPage };
