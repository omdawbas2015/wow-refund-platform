import { cn } from '@/lib/utils';

/**
 * Aura brand mark — pink disc with the AURA wordmark.
 *
 * Rendered as inline SVG so it scales crisply and inherits colors from
 * Tailwind tokens. Swap this out with an official asset (e.g. a PNG or
 * a tighter SVG from the brand team) when one is available.
 */
export function AuraLogo({
  size = 28,
  className,
  title = 'Aura',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <title>{title}</title>
      <circle cx="60" cy="60" r="58" fill="#ec4899" />
      <text
        x="60"
        y="70"
        textAnchor="middle"
        fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
        fontWeight="800"
        fontSize="34"
        letterSpacing="2"
        fill="#ffffff"
      >
        AURA
      </text>
    </svg>
  );
}
