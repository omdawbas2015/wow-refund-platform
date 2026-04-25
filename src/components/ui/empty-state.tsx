import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      className
    )}>
      <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--color-surface-hover)] flex items-center justify-center mb-4 text-[var(--color-text-tertiary)]">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-subhead mb-1">{title}</h3>
      {description && (
        <p className="text-body max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
}
