import { cn } from '@/lib/utils';

/**
 * Simple brand avatar — first letter(s) of the brand name on a colored chip.
 * Used as a secondary identifier next to the customer name in lists, so we
 * don't need a dedicated Brand column.
 */
export function BrandAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Deterministic hue from name so each brand gets a stable color without
  // needing to store one per brand.
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue} 70% 94%)`;
  const fg = `hsl(${hue} 60% 32%)`;

  return (
    <span
      title={name}
      style={{ backgroundColor: bg, color: fg }}
      className={cn(
        'inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        className,
      )}
    >
      {initials || '—'}
    </span>
  );
}
