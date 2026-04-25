import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function KpiCard({ label, value, trend, icon, onClick, className }: KpiCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 transition-all',
        onClick && 'cursor-pointer hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)]',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-micro">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-tertiary)]">
            {icon}
          </div>
        )}
      </div>
      <div className="text-[24px] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-2">
        {value}
      </div>
      {trend && (
        <div className={cn(
          'flex items-center gap-1 text-[12px] font-medium',
          trend.direction === 'up' && 'text-[var(--color-success)]',
          trend.direction === 'down' && 'text-[var(--color-danger)]',
          trend.direction === 'neutral' && 'text-[var(--color-text-tertiary)]',
        )}>
          <TrendIcon className="w-3.5 h-3.5" />
          {trend.value}
        </div>
      )}
    </div>
  );
}
