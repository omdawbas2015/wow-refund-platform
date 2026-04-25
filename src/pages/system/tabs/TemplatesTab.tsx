import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Mail, ShieldCheck, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
const categories = [
  { value: 'APPROVAL', label: 'Approval Requests' },
  { value: 'KNET_REFUND', label: 'KNET Notifications' },
  { value: 'AURA_REFUND', label: 'Aura Points' },
  { value: 'FOLLOW_UP', label: 'Customer Follow-up' },
  { value: 'CUSTOM', label: 'Manual/Custom' },
];

export default function TemplatesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => axios.get('/api/admin/templates', { headers }).then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (data: any) => axios.post('/api/admin/templates', data, { headers }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-templates'] }); setOpen(false); toast.success('Template created'); },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">
          Standardized outgoing communication templates for all refund tracks.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="h-9 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-[var(--text-caption)] font-semibold gap-1.5 rounded-[var(--radius-md)]" />}>
              <Plus className="w-4 h-4" /> New Template
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-[var(--radius-xl)] border-[var(--color-border)]">
            <DialogHeader><DialogTitle className="text-[var(--text-heading)] font-bold">Create Template</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.mutate({ name: fd.get('name'), category: fd.get('category'), subject: fd.get('subject'), body: fd.get('body') });
            }} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[var(--text-micro)] font-semibold text-[var(--color-text-tertiary)]">Template Name</Label>
                  <Input name="name" placeholder="e.g. KNET Refund Request" required className="h-9 border-[var(--color-border)] rounded-[var(--radius-md)]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[var(--text-micro)] font-semibold text-[var(--color-text-tertiary)]">Category</Label>
                  <select name="category" className="w-full h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-[var(--text-caption)] bg-[var(--color-surface)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none">
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--text-micro)] font-semibold text-[var(--color-text-tertiary)]">Subject Line</Label>
                <Input name="subject" placeholder="Refund Request for {{orderId}}" required className="h-9 border-[var(--color-border)] rounded-[var(--radius-md)]" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-[var(--text-micro)] font-semibold text-[var(--color-text-tertiary)]">Body</Label>
                  <Badge className="text-[9px] bg-[var(--color-info-subtle)] text-[var(--color-info-text)] border-none">Supports {'{{variables}}'}</Badge>
                </div>
                <textarea name="body" rows={6} required placeholder="Dear {{customerName}}..."
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-[var(--text-caption)] bg-[var(--color-surface)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none resize-none" />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-9 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-[var(--radius-md)]">Save Template</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-[var(--color-surface-hover)] animate-pulse rounded-[var(--radius-lg)]" />) :
          templates.map((tmpl: any) => (
            <Card key={tmpl.id} className="border-[var(--color-border)] bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] transition-shadow group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-tertiary)] group-hover:bg-[var(--color-accent-subtle)] group-hover:text-[var(--color-accent)] transition-colors shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[var(--text-body)] font-semibold text-[var(--color-text-primary)]">{tmpl.name}</h3>
                      <Badge className="text-[9px] bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-none rounded-[var(--radius-sm)]">{tmpl.category}</Badge>
                    </div>
                    <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)] truncate">{tmpl.subject}</p>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="flex items-center text-[var(--text-micro)] text-[var(--color-text-tertiary)] gap-1">
                        <ShieldCheck className="w-3 h-3 text-[var(--color-success)]" /> Verified
                      </span>
                      <span className="flex items-center text-[var(--text-micro)] text-[var(--color-text-tertiary)] gap-1">
                        <Clock className="w-3 h-3" /> {format(new Date(tmpl.updatedAt), 'MMM dd')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        }
      </div>
    </div>
  );
}
