import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useWorkspace } from "@/context/workspace-context";

const publicNavLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Demo", href: "/demo" },
] as const;

const footerNavGroups = [
  {
    title: "Explore",
    links: [
      { label: "Sample dashboard", href: "/app" },
      { label: "Documentation", href: "/docs" },
      { label: "Demo preview", href: "/demo" },
    ],
  },
  {
    title: "Principles",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of use", href: "/terms" },
    ],
  },
] as const;

function PublicLayout() {
  const { pathname } = useLocation();
  // The landing page's hero already renders its own navbar, so the layout
  // header is only shown on the other public pages to avoid a duplicate.
  const showHeader = pathname !== "/";

  return (
    <div className="flex min-h-screen flex-col">
      <a href={pathname === "/" ? "#hero-content" : "#main-content"} className="skip-link">Skip to content</a>
      {showHeader ? (
        <header className="border-b border-border bg-background">
          <div className="site-container flex flex-wrap items-center justify-between gap-4 py-4">
            <Link to="/" className="inline-flex min-h-11 items-center gap-3 rounded-full">
              <LogoMark className="size-8 text-foreground" />
              <span className="text-lg font-semibold tracking-tight">Vinca</span>
            </Link>
            <nav aria-label="Primary" className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
              {publicNavLinks.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  className={({ isActive }) =>
                    buttonVariants({ variant: isActive ? "subtle" : "ghost" })
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <Button asChild>
                <Link to="/app">Open dashboard</Link>
              </Button>
            </nav>
          </div>
        </header>
      ) : null}

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        <Outlet />
      </main>

      <footer className="surface-inverse border-t border-border">
        <div className="site-container">
          <div className="grid gap-8 py-12 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:gap-12 md:py-16">
            <div className="min-w-0 space-y-5">
              <Link
                to="/"
                aria-label="Vinca homepage"
                className="inline-flex min-h-11 items-center rounded-full"
              >
                <span className="text-3xl font-semibold tracking-tight">Vinca</span>
              </Link>
              <p className="body-copy max-w-sm">
                Read-only inspection for wallet and payment developers. Understand incoming access
                before you decide what to share.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">Your wallet. Your authority. Deliberate disclosure.</p>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-8">
              {footerNavGroups.map((group) => (
                <nav key={group.title} aria-label={`${group.title} footer navigation`}>
                  <h3 className="text-xs font-medium uppercase tracking-widest">
                    {group.title}
                  </h3>
                  <ul className="mt-4 space-y-1 text-sm">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          to={link.href}
                          className="inline-flex min-h-11 items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-6 text-xs text-muted-foreground">
            <p>Copyright {new Date().getFullYear()} Vinca.</p>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                Fixture-backed preview
              </span>
              <span className="border-l border-border pl-4">No mainnet support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const dashboardNav = [
  { label: "Overview", end: true, href: "/app" },
  { label: "Import", end: false, href: "/app/import" },
  { label: "Compare", end: false, href: "/app/compare" },
  { label: "Disclosures", end: false, href: "/app/disclosures" },
  { label: "Settings", end: false, href: "/app/settings" },
] as const;

function AppLayout() {
  const { phase, lock } = useWorkspace();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="border-b border-border bg-background">
        <div className="site-container flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link to="/" className="inline-flex min-h-11 items-center gap-3 rounded-full">
              <LogoMark className="size-8 text-foreground" />
              <span className="text-lg font-semibold tracking-tight">Vinca</span>
            </Link>
            <Badge variant={phase === "unlocked" ? "secondary" : "muted"}>
              Workspace: {phase} (sample)
            </Badge>
            {phase === "unlocked" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={lock}
                aria-label="Lock sample workspace"
                className="text-xs"
              >
                Lock
              </Button>
            ) : null}
          </div>
          <nav aria-label="Dashboard" className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {dashboardNav.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.end}
                className={({ isActive }) =>
                  buttonVariants({ variant: isActive ? "subtle" : "ghost" })
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

        <main id="main-content" tabIndex={-1} className="site-container page-space flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export { PublicLayout, AppLayout };
