/**
 * Placeholder brand mark. Phase 2 replaces Watermelon branding with a Vinca
 * wordmark; this geometric mark is Vinca's own, not a Watermelon asset.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.9" />
      <path
        d="M9 9 L16 23 L23 9"
        fill="none"
        stroke="oklch(0.62 0.14 43)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
