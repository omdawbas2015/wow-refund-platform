import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentMethodInfo = {
  key: string;
  label: string;
};

type Size = 'sm' | 'md';

/**
 * Stripe-checkout-style payment-method badges. Every badge shares the same
 * card-chip footprint (32×20 / 40×24) so a row of them reads like accepted-
 * methods marks on a real payment page — tight, consistent, and scannable.
 * We show brand glyphs only; the human-readable label lives in the tooltip.
 */
export function PaymentMethodIcons({
  methods,
  size = 'sm',
  className,
}: {
  methods: PaymentMethodInfo[];
  size?: Size;
  className?: string;
}) {
  if (methods.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const seen = new Set<string>();
  const unique = methods.filter((m) => {
    if (seen.has(m.key)) return false;
    seen.add(m.key);
    return true;
  });

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {unique.map((m) => (
        <PaymentMethodBadge key={m.key} info={m} size={size} />
      ))}
    </div>
  );
}

function PaymentMethodBadge({ info, size }: { info: PaymentMethodInfo; size: Size }) {
  // Fixed card-chip aspect ratio keeps a row of mixed methods visually tidy.
  const sizing =
    size === 'md'
      ? 'h-6 w-10 rounded-[5px]'
      : 'h-5 w-8 rounded-[4px]';
  const Renderer = RENDERERS[info.key] ?? FallbackBadge;
  return <Renderer label={info.label} sizing={sizing} size={size} />;
}

type RendererProps = { label: string; sizing: string; size: Size };
type Renderer = (p: RendererProps) => React.ReactElement;

const RENDERERS: Record<string, Renderer> = {
  APPLE_PAY: ApplePayBadge,
  CREDIT_CARD: CreditCardBadge,
  KNET: KnetBadge,
  MADA: MadaBadge,
  AURA: AuraBadge,
};

function ApplePayBadge({ label, sizing, size }: RendererProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center bg-[#0b0b0b] text-white ring-1 ring-black/10',
        sizing,
      )}
    >
      <AppleLogo size={size} />
    </span>
  );
}

function KnetBadge({ label, sizing, size }: RendererProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center bg-white ring-1 ring-border',
        sizing,
      )}
    >
      <span
        className={cn(
          'font-extrabold leading-none tracking-[0.04em]',
          size === 'md' ? 'text-[10px]' : 'text-[8px]',
        )}
      >
        <span className="text-[#00a651]">K</span>
        <span className="text-[#58595b]">NET</span>
      </span>
    </span>
  );
}

function CreditCardBadge({ label, sizing, size }: RendererProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center bg-[#1a1f36] text-white ring-1 ring-black/10',
        sizing,
      )}
    >
      <CreditCard className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} strokeWidth={2} />
    </span>
  );
}

function MadaBadge({ label, sizing, size }: RendererProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center bg-white ring-1 ring-border',
        sizing,
      )}
    >
      <span
        className={cn(
          'font-bold leading-none tracking-[0.04em]',
          size === 'md' ? 'text-[10px]' : 'text-[8px]',
        )}
      >
        <span className="text-[#84cdde]">m</span>
        <span className="text-[#58595b]">a</span>
        <span className="text-[#84cdde]">d</span>
        <span className="text-[#58595b]">a</span>
      </span>
    </span>
  );
}

function AuraBadge({ label, sizing, size }: RendererProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center bg-primary/10 text-primary ring-1 ring-primary/20',
        sizing,
      )}
    >
      <AuraGlyph size={size} />
    </span>
  );
}

function FallbackBadge({ label, sizing, size }: RendererProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center bg-surface-subtle text-muted-foreground ring-1 ring-border',
        sizing,
      )}
    >
      <CreditCard className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} strokeWidth={1.75} />
    </span>
  );
}

/* ---------- Glyphs ---------- */

function AppleLogo({ size }: { size: Size }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'}
      fill="currentColor"
      aria-hidden
    >
      <path d="M16.365 1.43c0 1.14-.417 2.232-1.252 3.18-.835.947-1.952 1.493-3.077 1.407-.123-1.063.363-2.19 1.218-3.123.854-.932 2.057-1.523 3.111-1.464zM21 17.25c-.553 1.28-1.203 2.52-1.95 3.718-1.07 1.71-2.16 2.547-3.26 2.547-.872 0-1.56-.24-2.07-.72-.51-.48-1.21-.72-2.09-.72-.86 0-1.56.24-2.1.72-.54.48-1.22.72-2.04.72-1.15 0-2.25-.83-3.3-2.49C2.63 18.24 2 15.38 2 12.66 2 10.1 2.62 8.05 3.86 6.52 5.08 5 6.5 4.24 8.14 4.24c.88 0 1.93.3 3.14.9 1.2.6 2.04.9 2.52.9.36 0 1.26-.35 2.7-1.05 1.44-.7 2.58-1.05 3.42-1.05 1.79 0 3.3 1.03 4.54 3.09-2.16 1.17-3.24 2.95-3.24 5.34 0 1.88.64 3.38 1.92 4.51.55.5 1.1.89 1.66 1.17z" />
    </svg>
  );
}

function AuraGlyph({ size }: { size: Size }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l2.09 6.26L20 9l-5 4.18L16.18 20 12 16.77 7.82 20 9 13.18 4 9l5.91-.74L12 2z" />
    </svg>
  );
}
