import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Mail, Clock, AlertCircle, Users2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

export default function TeamsTab() {
  const { data: teams = [] } = useQuery({
    queryKey: ['admin-teams'],
    queryFn: () => axios.get('/api/admin/teams', { headers }).then(r => r.data),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">
          Manage external team contacts, SLA windows, and escalation policies.
        </p>
        <Button className="h-9 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-[var(--text-caption)] font-semibold gap-1.5 rounded-[var(--radius-md)]">
          <Plus className="w-4 h-4" /> Add Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="py-16 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
          <Users2 className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-[var(--text-caption)] font-medium">No external teams configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team: any) => (
            <Card key={team.id} className="border-[var(--color-border)] bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] transition-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white flex items-center justify-center text-[var(--text-body)] font-bold shrink-0">
                    {team.name.charAt(0)}
                  </div>
                  <h3 className="text-[var(--text-body)] font-semibold text-[var(--color-text-primary)]">{team.name} Team</h3>
                </div>
                <Badge className="text-[10px] bg-[var(--color-success-subtle)] text-[var(--color-success-text)] border-none rounded-[var(--radius-sm)]">Active</Badge>
              </div>

              <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
                <Mail className="w-4 h-4 text-[var(--color-accent)]" />
                <span className="text-[var(--text-caption)] font-medium text-[var(--color-text-primary)]">{team.emailGroup}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--color-surface-hover)] rounded-[var(--radius-md)]">
                  <p className="text-[var(--text-micro)] text-[var(--color-text-tertiary)] mb-0.5">SLA Window</p>
                  <p className="text-[var(--text-subhead)] font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" /> {team.slaHours} hrs
                  </p>
                </div>
                <div className="p-3 bg-[var(--color-surface-hover)] rounded-[var(--radius-md)]">
                  <p className="text-[var(--text-micro)] text-[var(--color-text-tertiary)] mb-0.5">Escalation</p>
                  <p className="text-[var(--text-caption)] font-medium text-[var(--color-text-primary)] truncate flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[var(--color-danger)] shrink-0" /> {team.escalationEmail || 'None'}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
