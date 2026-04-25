import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Save, Settings2, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const api = axios.create({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function ConfigTab() {
  const queryClient = useQueryClient();
  const { data: configs } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/api/admin/config').then(r => r.data),
    refetchInterval: 5000,
  });

  const [local, setLocal] = useState<any[]>([]);
  useEffect(() => { if (configs) setLocal(configs); }, [configs]);

  const save = async () => {
    try {
      await api.patch('/api/admin/config', { configs: local });
      toast.success('Configuration saved');
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
    } catch { toast.error('Failed to save'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <Info className="w-4 h-4 text-[var(--color-info)]" />
          <p className="text-[var(--text-caption)]">Live variables affecting backend logic. Changes take effect immediately.</p>
        </div>
        <Button onClick={save}
          className="h-9 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-[var(--text-caption)] font-semibold gap-1.5 rounded-[var(--radius-md)]">
          <Save className="w-4 h-4" /> Save All
        </Button>
      </div>

      <div className="space-y-3">
        {local.map((c: any, i: number) => (
          <Card key={c.key} className="border-[var(--color-border)] bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-xs)]">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                  <span className="text-[var(--text-body)] font-semibold text-[var(--color-text-primary)] font-mono">{c.key}</span>
                </div>
                <p className="text-[var(--text-micro)] text-[var(--color-text-secondary)] mt-0.5 ml-6">{c.description}</p>
              </div>
              <div className="w-full md:w-64 shrink-0">
                <Input
                  value={c.value}
                  onChange={(e) => {
                    const next = [...local];
                    next[i].value = e.target.value;
                    setLocal(next);
                  }}
                  className="h-9 border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)] font-mono text-[var(--text-caption)]"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
