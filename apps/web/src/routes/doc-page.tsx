import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/page-shell";

/** Shared documentation-layout shell used by /docs, /privacy and /terms. */
export interface DocPageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

function DocPage({ title, description, children }: DocPageProps) {
  return (
    <div className="site-container page-space">
      <article className="flex min-w-0 flex-col gap-8">
        <PageShell title={title} description={description} />
        <div className="body-copy flex min-w-0 max-w-3xl flex-col gap-8 [&_ul.list-disc]:space-y-2 [&_ul.list-disc]:pl-5 [&_ul.list-disc]:list-outside">
          {children ?? (
            <p>
              Content for this page is written in phase 2, alongside the public navigation and
              metadata work. Layout, typography and theming are established here in phase 1.
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

/** Numbered subsection with a stable anchor, used by the documentation pages. */
export interface DocSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

function DocSection({ id, title, children }: DocSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="min-w-0 scroll-mt-24">
      <h2 id={`${id}-heading`} className="pb-4 text-xl font-medium leading-tight tracking-tight text-foreground">
        {title}
      </h2>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** In-page anchor list for a documentation page's sections. */
function DocToc({ items }: { items: readonly { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="rounded-xl border border-border bg-muted/40 p-6">
      <p className="mb-3 text-sm font-medium text-foreground">On this page</p>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="inline-flex min-h-11 items-center rounded-full py-2 underline underline-offset-4 hover:text-primary">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { DocPage, DocSection, DocToc };
