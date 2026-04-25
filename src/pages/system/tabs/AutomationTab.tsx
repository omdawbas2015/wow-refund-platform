import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Zap, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

export default function AutomationTab() {
  const { data: rules = [] } = useQuery({
    queryKey: ['admin-automation-rules'],
    queryFn: () => axios.get('/api/admin/automation-rules', { headers }).then(r => r.data),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">
          Configure automatic triggers for emails and status updates based on case lifecycle events.
        </p>
        <Button className="h-9 bg-[var(--color-success)] hover:opacity-90 text-white text-[var(--text-caption)] font-semibold gap-1.5 rounded-[var(--radius-md)]">
          <Plus className="w-4 h-4" /> New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="py-16 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
          <Zap className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-[var(--text-caption)] font-medium">No automation rules configured</p>
          <p className="text-[var(--text-micro)] mt-1">Rules can trigger emails on status changes or delays</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <Card key={rule.id} className="border-[var(--color-border)] bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] transition-shadow group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[var(--text-body)] font-semibold text-[var(--color-text-primary)]">{rule.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-[10px] bg-[var(--color-neutral-subtle)] text-[var(--color-neutral-text)] border-none rounded-[var(--radius-sm)]">
                        IF {rule.triggerEvent}
                      </Badge>
                      <ChevronRight className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                      <Badge className="text-[10px] bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-none rounded-[var(--radius-sm)]">
                        THEN {rule.actionType}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
