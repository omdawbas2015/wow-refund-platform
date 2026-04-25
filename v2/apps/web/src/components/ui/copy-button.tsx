'use client';

/**
 * Tiny icon button that copies its `value` to the clipboard and briefly
 * swaps its icon to a checkmark to confirm. Designed to sit inline next
 * to a label (case number, email, phone, ARN, etc.) — it takes almost
 * no space and stays visually quiet until hovered.
 */

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CopyButton({
  value,
  className,
  size = 'sm',
  label = 'Copy',
}: {
  value: string;
  className?: string;
  size?: 'xs' | 'sm';
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail in insecure contexts — degrade silently.
    }
  };

  const sizeCls =
    size === 'xs'
      ? 'h-5 w-5 [&>svg]:h-3 [&>svg]:w-3'
      : 'h-6 w-6 [&>svg]:h-3.5 [&>svg]:w-3.5';

  return (
    <button
      type="button"
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleCopy(e);
      }}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className={cn(
        sizeCls,
        'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        copied && 'text-emerald-600 dark:text-emerald-400',
        className,
      )}
    >
      {copied ? <Check /> : <Copy />}
    </button>
  );
}
