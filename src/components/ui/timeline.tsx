import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string | Date;
  icon?: ReactNode;
  actor?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

const variantDotStyles: Record<string, string> = {
  default: 'bg-[var(--color-border-strong)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger:  'bg-[var(--color-danger)]',
  info:    'bg-[var(--color-accent)]',
};

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn('relative', className)}>
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const variant = item.variant || 'default';

        return (
          <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Line */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[var(--color-border)]" />
            )}

            {/* Dot */}
            <div className="relative shrink-0 mt-1">
              <div className={cn(
                'w-[22px] h-[22px] rounded-full border-2 border-[var(--color-surface)] flex items-center justify-center',
                isFirst ? 'ring-4 ring-[var(--color-accent-subtle)]' : '',
              )}>
                {item.icon ? (
                  <div className="w-[22px] h-[22px] rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-tertiary)]">
                    {item.icon}
                  </div>
                ) : (
                  <div className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    variantDotStyles[variant]
                  )} />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-caption text-[var(--color-text-tertiary)]">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </span>
              </div>
              <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">
                {item.title}
                {item.actor && (
                  <span className="text-[var(--color-text-tertiary)] font-normal"> · {item.actor}</span>
                )}
              </p>
              {item.description && (
                <p className="text-caption mt-0.5">{item.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
