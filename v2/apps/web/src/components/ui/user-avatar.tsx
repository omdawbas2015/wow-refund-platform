import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md';

const sizeCls: Record<Size, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-8 w-8 text-xs',
};

/**
 * Deterministic initials avatar. Picks a stable background color from
 * the user's name so the same person always gets the same chip. When
 * the user has a real `image` URL (uploaded profile photo), render it
 * instead.
 *
 * Used in the People sidebar on the case detail page so ops can scan
 * who created / was assigned / approved a case at a glance.
 */
export function UserAvatar({
  name,
  image,
  size = 'sm',
  className,
}: {
  name: string | null | undefined;
  image?: string | null;
  size?: Size;
  className?: string;
}) {
  const safe = (name ?? '').trim();
  const initials =
    safe
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .filter(Boolean)
      .join('')
      .toUpperCase() || '?';

  const palette = [
    'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  ];
  let hash = 0;
  for (let i = 0; i < safe.length; i++) hash = (hash * 31 + safe.charCodeAt(i)) | 0;
  const tone = palette[Math.abs(hash) % palette.length]!;

  const base = cn(
    'inline-flex items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-border',
    sizeCls[size],
    !image && tone,
    className,
  );

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={safe || 'User avatar'}
        className={base}
      />
    );
  }

  return (
    <span className={base} aria-hidden>
      {initials}
    </span>
  );
}
