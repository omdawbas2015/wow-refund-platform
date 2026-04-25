import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentMethodInfo = {
  key: string;
  label: string;
};

type Size = 'sm' | 'md';

/**
 * Compact list of payment-method logo badges used in the cases table
 * and on the case details page. Each pill mimics the real brand look —
 * Apple Pay (white wordmark on black), KNET (green wordmark), credit cards
 * (card glyph with brand stripe). Unknown methods fall back to a neutral
 * pill with the human-readable label.
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
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {unique.map((m) => (
        <PaymentMethodPill key={m.key} info={m} size={size} />
      ))}
    </div>
  );
}

function PaymentMethodPill({ info, size }: { info: PaymentMethodInfo; size: Size }) {
  const h = size === 'md' ? 'h-7' : 'h-6';
  const Renderer = RENDERERS[info.key] ?? FallbackPill;
  return <Renderer label={info.label} heightClass={h} />;
}

type RendererProps = { label: string; heightClass: string };
type Renderer = (p: RendererProps) => React.ReactElement;

const RENDERERS: Record<string, Renderer> = {
  APPLE_PAY: ApplePayPill,
  CREDIT_CARD: CreditCardPill,
  KNET: KnetPill,
  MADA: MadaPill,
  AURA: AuraPill,
};

function ApplePayPill({ heightClass }: RendererProps) {
  return (
    <span
      title="Apple Pay"
      aria-label="Apple Pay"
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-[#0b0b0b] px-2 text-white ring-1 ring-black/20',
        heightClass,
      )}
    >
      <AppleLogo />
      <span className="text-[11px] font-semibold leading-none tracking-tight">Pay</span>
    </span>
  );
}

function KnetPill({ heightClass }: RendererProps) {
  return (
    <span
      title="KNET"
      aria-label="KNET"
      className={cn(
        'inline-flex items-center rounded-md bg-white px-2 ring-1 ring-border',
        heightClass,
      )}
    >
      <KnetWordmark />
    </span>
  );
}

function CreditCardPill({ heightClass }: RendererProps) {
  return (
    <span
      title="Credit card"
      aria-label="Credit card"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-[#1a1f36] px-2 text-white ring-1 ring-black/20',
        heightClass,
      )}
    >
      <VisaMastercardGlyph />
      <span className="text-[11px] font-medium leading-none tracking-tight">Card</span>
    </span>
  );
}

function MadaPill({ heightClass }: RendererProps) {
  return (
    <span
      title="Mada"
      aria-label="Mada"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-white px-2 ring-1 ring-border',
        heightClass,
      )}
    >
      <span className="text-[11px] font-bold leading-none tracking-[0.08em]">
        <span className="text-[#84CDDE]">m</span>
        <span className="text-[#58595B]">a</span>
        <span className="text-[#84CDDE]">d</span>
        <span className="text-[#58595B]">a</span>
      </span>
    </span>
  );
}

function AuraPill({ heightClass }: RendererProps) {
  return (
    <span
      title="Aura points"
      aria-label="Aura points"
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 text-primary ring-1 ring-primary/20',
        heightClass,
      )}
    >
      <AuraGlyph />
      <span className="text-[11px] font-semibold leading-none tracking-tight">Aura</span>
    </span>
  );
}

function FallbackPill({ label, heightClass }: RendererProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-surface-subtle px-2 text-foreground ring-1 ring-border',
        heightClass,
      )}
    >
      <CreditCard className="h-3 w-3" />
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </span>
  );
}

/* ---------- Glyphs ---------- */

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.417 2.232-1.252 3.18-.835.947-1.952 1.493-3.077 1.407-.123-1.063.363-2.19 1.218-3.123.854-.932 2.057-1.523 3.111-1.464zM21 17.25c-.553 1.28-1.203 2.52-1.95 3.718-1.07 1.71-2.16 2.547-3.26 2.547-.872 0-1.56-.24-2.07-.72-.51-.48-1.21-.72-2.09-.72-.86 0-1.56.24-2.1.72-.54.48-1.22.72-2.04.72-1.15 0-2.25-.83-3.3-2.49C2.63 18.24 2 15.38 2 12.66 2 10.1 2.62 8.05 3.86 6.52 5.08 5 6.5 4.24 8.14 4.24c.88 0 1.93.3 3.14.9 1.2.6 2.04.9 2.52.9.36 0 1.26-.35 2.7-1.05 1.44-.7 2.58-1.05 3.42-1.05 1.79 0 3.3 1.03 4.54 3.09-2.16 1.17-3.24 2.95-3.24 5.34 0 1.88.64 3.38 1.92 4.51.55.5 1.1.89 1.66 1.17z" />
    </svg>
  );
}

function KnetWordmark() {
  // Flat wordmark: "K" and "NET" in KNET's trademark green so the pill reads like
  // a real card-network badge at a glance.
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-black leading-none tracking-[0.06em]">
      <span className="text-[#00a651]">K</span>
      <span className="text-[#58595B]">NET</span>
    </span>
  );
}

function VisaMastercardGlyph() {
  // Two overlapping brand circles (Mastercard-style) to hint at "credit card"
  // without mimicking any single network's exact mark.
  return (
    <span className="relative inline-flex h-3 w-5">
      <span className="absolute left-0 top-0 h-3 w-3 rounded-full bg-[#eb001b]/90" />
      <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-[#f79e1b]/90" />
      <span className="absolute left-1 top-0 h-3 w-3 rounded-full bg-[#ff5f00]/60" />
    </span>
  );
}

function AuraGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M12 2l2.09 6.26L20 9l-5 4.18L16.18 20 12 16.77 7.82 20 9 13.18 4 9l5.91-.74L12 2z" />
    </svg>
  );
}
