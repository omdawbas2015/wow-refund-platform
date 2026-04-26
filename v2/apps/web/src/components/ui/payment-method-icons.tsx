import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentMethodInfo = {
  key: string;
  label: string;
};

export type PaymentSize = 'sm' | 'md';

/**
 * Payment-method badges styled after real-world brand marks on a Stripe
 * checkout: fixed card-chip aspect ratio, authentic colors, glyphs / short
 * wordmarks only. The brand label is rendered as text next to the chip
 * (not on it), matching how accepted-methods strips look on real
 * checkouts.
 *
 * Sizes: sm = 28×18 (compact list cells), md = 56×36 (form picker tiles).
 */
export function PaymentMethodIcons({
  methods,
  size = 'sm',
  showLabel = true,
  className,
}: {
  methods: PaymentMethodInfo[];
  size?: PaymentSize;
  /** Show the brand name inline next to the chip. Defaults to true. */
  showLabel?: boolean;
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
    <div className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      {unique.map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1.5">
          <PaymentBrand brandKey={m.key} label={m.label} size={size} />
          {showLabel && (
            <span className="text-xs font-medium text-heading">{m.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Render a single brand chip by key. Exposed so the New Case form can
 * render larger picker tiles without reconstructing a `methods` array.
 */
export function PaymentBrand({
  brandKey,
  label,
  size = 'sm',
}: {
  brandKey: string;
  label?: string;
  size?: PaymentSize;
}) {
  const name = label ?? defaultLabel(brandKey);
  const Renderer = RENDERERS[brandKey] ?? FallbackBadge;
  return <Renderer label={name} size={size} />;
}

function defaultLabel(key: string): string {
  switch (key) {
    case 'MASTERCARD':
      return 'Mastercard';

    case 'APPLE_PAY':
      return 'Apple Pay';
    case 'KNET':
      return 'KNET';
    case 'AURA':
      return 'Aura';
    case 'CREDIT_CARD':
      return 'Credit card';
    default:
      return key;
  }
}

type RendererProps = { label: string; size: PaymentSize };
type Renderer = (p: RendererProps) => React.ReactElement;

const RENDERERS: Record<string, Renderer> = {
  MASTERCARD: MastercardBadge,
  APPLE_PAY: ApplePayBadge,
  KNET: KnetBadge,
  AURA: AuraBadge,
  CREDIT_CARD: CreditCardBadge,
};

// Shared shell so every brand sits on the same card-chip footprint. The
// chip carries a subtle border to separate it from the row background.
function Chip({
  children,
  label,
  size,
  className,
}: {
  children: React.ReactNode;
  label: string;
  size: PaymentSize;
  className?: string;
}) {
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-inset ring-black/10',
        size === 'md' ? 'h-9 w-14 rounded-md' : 'h-[18px] w-7 rounded',
        className,
      )}
    >
      {children}
    </span>
  );
}

function MastercardBadge({ label, size }: RendererProps) {
  // Classic overlapping red + yellow circles on a near-black field.
  const circle = size === 'md' ? 'h-4 w-4' : 'h-2.5 w-2.5';
  const overlap = size === 'md' ? '-ms-1.5' : '-ms-1';
  return (
    <Chip label={label} size={size} className="bg-[#11151f]">
      <span className="relative inline-flex items-center">
        <span className={cn('rounded-full bg-[#eb001b]', circle)} />
        <span
          className={cn(
            'rounded-full bg-[#f79e1b] mix-blend-screen',
            circle,
            overlap,
          )}
        />
      </span>
    </Chip>
  );
}



function ApplePayBadge({ label, size }: RendererProps) {
  // White "Pay" badge with the apple glyph — matches Apple's marketing mark
  // (what you see on a device's Wallet, not the black app icon).
  return (
    <Chip label={label} size={size} className="bg-white">
      <span
        className={cn(
          'inline-flex items-center gap-[1px] font-semibold text-black',
          size === 'md' ? 'text-[11px]' : 'text-[7px]',
        )}
      >
        <AppleLogo size={size} />
        <span className="leading-none">Pay</span>
      </span>
    </Chip>
  );
}

function KnetBadge({ label, size }: RendererProps) {
  // KNET's wordmark-on-white treatment, compact to the card-chip footprint.
  return (
    <Chip label={label} size={size} className="bg-white">
      <span
        className={cn(
          'font-black uppercase leading-none tracking-[0.06em]',
          size === 'md' ? 'text-[11px]' : 'text-[7px]',
        )}
      >
        <span className="text-[#00a651]">K</span>
        <span className="text-[#58595b]">NET</span>
      </span>
    </Chip>
  );
}

function AuraBadge({ label, size }: RendererProps) {
  return (
    <Chip label={label} size={size} className="bg-white">
      <AuraGlyph size={size} />
    </Chip>
  );
}

function CreditCardBadge({ label, size }: RendererProps) {
  return (
    <Chip label={label} size={size} className="bg-white">
      <CreditCard
        className={cn(
          'text-[#64748b]',
          size === 'md' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5',
        )}
        strokeWidth={2}
      />
    </Chip>
  );
}

function FallbackBadge({ label, size }: RendererProps) {
  return (
    <Chip label={label} size={size} className="bg-surface-subtle text-muted-foreground">
      <CreditCard
        className={size === 'md' ? 'h-4 w-4' : 'h-3 w-3'}
        strokeWidth={1.75}
      />
    </Chip>
  );
}

/* ---------- Glyphs ---------- */

function AppleLogo({ size }: { size: PaymentSize }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={size === 'md' ? 'h-3 w-3' : 'h-[7px] w-[7px]'}
      fill="currentColor"
      aria-hidden
    >
      <path d="M16.365 1.43c0 1.14-.417 2.232-1.252 3.18-.835.947-1.952 1.493-3.077 1.407-.123-1.063.363-2.19 1.218-3.123.854-.932 2.057-1.523 3.111-1.464zM21 17.25c-.553 1.28-1.203 2.52-1.95 3.718-1.07 1.71-2.16 2.547-3.26 2.547-.872 0-1.56-.24-2.07-.72-.51-.48-1.21-.72-2.09-.72-.86 0-1.56.24-2.1.72-.54.48-1.22.72-2.04.72-1.15 0-2.25-.83-3.3-2.49C2.63 18.24 2 15.38 2 12.66 2 10.1 2.62 8.05 3.86 6.52 5.08 5 6.5 4.24 8.14 4.24c.88 0 1.93.3 3.14.9 1.2.6 2.04.9 2.52.9.36 0 1.26-.35 2.7-1.05 1.44-.7 2.58-1.05 3.42-1.05 1.79 0 3.3 1.03 4.54 3.09-2.16 1.17-3.24 2.95-3.24 5.34 0 1.88.64 3.38 1.92 4.51.55.5 1.1.89 1.66 1.17z" />
    </svg>
  );
}

function AuraGlyph({ size }: { size: PaymentSize }) {
  // Aura brand mark: pink circle with Arabic calligraphy "نور" inside.
  const cls = size === 'md' ? 'h-6 w-6' : 'h-3.5 w-3.5';
  return (
    <svg viewBox="0 0 48 48" className={cls} aria-hidden fill="none">
      <circle cx="24" cy="24" r="20" stroke="#E6007E" strokeWidth="3" fill="none" />
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="#E6007E"
      >
        نور
      </text>
    </svg>
  );
}
