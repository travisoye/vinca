/*
  Hero 12 (Hero3 in the source registry) composition, ported from the supplied
  Watermelon registry item to Vite:
    - 'use client' directive removed (no Next.js).
    - Watermelon LogoIcon replaced by a Vinca brand mark placeholder.
    - Default copy uses the prd.md copy baseline; phase 2 finalises the page.
    - No PostHog/session-replay/bootstrap code is copied.

  The hero background is the source's separately hosted hero-3.avif. Its
  reuse rights are NOT established; replace or verify before publication
  (prd.md risk table and phase 10). No scrollbar hiding is adopted.
*/

import { ArrowDown, ArrowRight, Menu, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { HERO_COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
}

export interface HeroProps {
  brandName?: string;
  navLinks?: NavLink[];
  signUpLabel?: string;
  signUpHref?: string;
  /** Small pill badge text above the heading */
  badgeText?: string;
  headingLine1?: string;
  headingLine2?: string;
  description?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  bottomTagline?: string;
  scrollText?: string;
}

export default function Hero({
  brandName = HERO_COPY.brand,
  navLinks = [
    { label: "Workflow", href: HERO_COPY.secondaryHref },
    { label: "Developers", href: "#developers" },
    { label: "FAQ", href: "#faq" },
    { label: "Docs", href: "/docs" },
  ],
  signUpLabel = HERO_COPY.primaryLabel,
  signUpHref = HERO_COPY.primaryHref,
  badgeText = HERO_COPY.badge,
  headingLine1 = HERO_COPY.line1,
  headingLine2 = HERO_COPY.line2,
  description = HERO_COPY.description,
  primaryCtaLabel = HERO_COPY.primaryLabel,
  primaryCtaHref = HERO_COPY.primaryHref,
  secondaryCtaLabel = HERO_COPY.secondaryLabel,
  secondaryCtaHref = HERO_COPY.secondaryHref,
  bottomTagline = HERO_COPY.bottomSentence,
  scrollText = "Scroll to discover",
}: HeroProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const line1Words = headingLine1.split(" ");
  const line2Words = headingLine2.split(" ");

  useEffect(() => {
    if (!menuOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  return (
    <section className="surface-inverse relative isolate w-full overflow-hidden">
      {/* Background image — cinematic zoom (reuse rights pending, see header comment) */}
      <motion.div
        className="absolute inset-0"
        initial={reduceMotion ? false : { scale: 1.15 }}
        animate={{ scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 2.8, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <img
          src="https://assets.watermelon.sh/hero-3.avif"
          alt="Dark aerial landscape used as the hero background"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </motion.div>

      {/* Gradient overlays for depth */}
      <div className="pointer-events-none absolute inset-0 bg-black/60" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/30 via-transparent to-black/25" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/20 via-transparent to-transparent" />

      {/* Noise texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex min-h-[calc(100svh_-_3rem)] w-full flex-col">
        {/* Navbar */}
        <div className="relative">
        <nav aria-label="Main navigation" className="site-container flex items-center justify-between gap-4 py-4 md:py-6">
          <a href="/" className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-full">
            <LogoMark className="size-8 text-white" />
            <span className="text-xl font-semibold tracking-tight text-white">
              {brandName}
            </span>
          </a>

          <div className="hidden items-center gap-4 lg:flex xl:gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full text-sm font-medium text-white transition-colors hover:text-primary md:text-[15px]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Language control removed: Vinca has no inactive language switching (prd.md phase 2). */}
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <a href={signUpHref}>{signUpLabel}</a>
            </Button>

            {/* Working mobile menu */}
            <Button
              ref={menuButtonRef}
              variant="hero"
              size="icon"
              className="lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="hero-mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>
          </div>
        </nav>

        {/* Mobile menu panel */}
        {menuOpen ? (
          <nav
            id="hero-mobile-menu"
            aria-label="Mobile navigation"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh_-_6rem)] overflow-y-auto border-y border-border bg-background lg:hidden"
          >
            <ul className="site-container flex flex-col gap-1 py-4">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded-full text-sm font-medium hover:text-primary"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="/privacy"
                  className="inline-flex min-h-11 items-center rounded-full text-sm font-medium hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="inline-flex min-h-11 items-center rounded-full text-sm font-medium hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Terms
                </a>
              </li>
              <li>
                <a
                  href={signUpHref}
                  className={buttonVariants({ variant: "outline" })}
                  onClick={() => setMenuOpen(false)}
                >
                  {signUpLabel}
                </a>
              </li>
            </ul>
          </nav>
        ) : null}
        </div>

        {/* Main content area */}
        <div id="hero-content" tabIndex={-1} className="site-container flex flex-1 flex-col justify-center py-12 md:py-16">
          <div className="max-w-2xl">
            {/* Shared eyebrow treatment */}
            <motion.div
              className="mb-8 inline-flex items-center gap-2 md:mb-10"
              initial={reduceMotion ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.5 }}
            >
              <span className="eyebrow">{badgeText}</span>
            </motion.div>

            {/* Heading — word-by-word stagger, light weight, italic second line */}
            <h1 aria-label={`${headingLine1} ${headingLine2}`} className="mb-6 text-[2.5rem] font-light leading-[1.05] tracking-tight text-white sm:text-[3.25rem] md:mb-8 md:text-[3.75rem] lg:text-[4.25rem]">
              <span aria-hidden="true" className="block overflow-hidden">
                {line1Words.map((word, i) => (
                  <Fragment key={i}>
                  <motion.span
                    className="inline-block max-w-full break-words"
                    initial={reduceMotion ? false : { y: "110%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : 0.7 + i * 0.1, ease: [0.33, 1, 0.68, 1] }}
                  >
                    {word}
                  </motion.span>
                  {i < line1Words.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </span>
              {" "}
              <em aria-hidden="true" className="block overflow-hidden pb-1 font-light italic">
                {line2Words.map((word, i) => (
                  <Fragment key={i}>
                  <motion.span
                    className="inline-block max-w-full break-words"
                    initial={reduceMotion ? false : { y: "110%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : 1.0 + i * 0.1, ease: [0.33, 1, 0.68, 1] }}
                  >
                    {word}
                  </motion.span>
                  {i < line2Words.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </em>
            </h1>

            {/* Animated horizontal rule */}
            <motion.div
              className="mb-6 h-px max-w-md bg-linear-to-r from-white/50 via-white/20 to-transparent md:mb-8"
              initial={reduceMotion ? false : { scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: reduceMotion ? 0 : 1.2, delay: reduceMotion ? 0 : 1.3, ease: [0.33, 1, 0.68, 1] }}
            />

            {/* Description */}
            <motion.p
              className="mb-8 max-w-md text-sm leading-relaxed text-white/90 md:mb-10 md:text-base"
              initial={reduceMotion ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 1.4, ease: "easeOut" }}
            >
              {description}
            </motion.p>

            {/* CTA buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg">
                <a href={primaryCtaHref}>{primaryCtaLabel}</a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={secondaryCtaHref}>
                  {secondaryCtaLabel}
                  <ArrowRight aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="site-container flex flex-col items-start justify-between gap-6 pb-8 md:flex-row md:items-end md:pb-10">
          <motion.p
            className="min-w-0 max-w-xl whitespace-pre-line text-sm leading-relaxed text-white/90"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1, delay: reduceMotion ? 0 : 2 }}
          >
            {bottomTagline}
          </motion.p>

          <a
            href="#product"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0")}
          >
            {scrollText}
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Decorative corner frame lines */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-6 hidden h-12 w-12 md:right-10 md:top-8 md:block lg:right-16"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 1, delay: reduceMotion ? 0 : 2.5 }}
      >
        <span className="absolute right-0 top-0 h-px w-full bg-linear-to-l from-white/25 to-transparent" />
        <span className="absolute right-0 top-0 h-full w-px bg-linear-to-b from-white/25 to-transparent" />
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-6 left-6 hidden h-12 w-12 md:bottom-8 md:left-10 md:block lg:left-16"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 1, delay: reduceMotion ? 0 : 2.5 }}
      >
        <span className="absolute bottom-0 left-0 h-px w-full bg-linear-to-r from-white/25 to-transparent" />
        <span className="absolute bottom-0 left-0 h-full w-px bg-linear-to-t from-white/25 to-transparent" />
      </motion.div>

    </section>
  );
}
