import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Plus, 
  Tag, 
  ToggleLeft, 
  ToggleRight, 
  Pencil, 
  Globe, 
  Database,
  Zap,
  Activity,
  ShieldCheck,
  Building2,
  Trash2,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const api = axios.create({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function BrandsTab() {
  const qc = useQueryClient();
  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => api.get('/api/admin/brands').then(r => r.data)
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', logoUrl: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/admin/brands', data),
    onSuccess: () => {
      toast.success('Resource Cluster Initialized');
      qc.invalidateQueries({ queryKey: ['admin-brands'] });
      qc.invalidateQueries({ queryKey: ['metadata'] });
      setOpen(false);
      setForm({ name: '', code: '', logoUrl: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Initialization Failed')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/api/admin/brands/${id}`, data),
    onSuccess: () => {
      toast.success('Cluster Parameters Updated');
      qc.invalidateQueries({ queryKey: ['admin-brands'] });
      qc.invalidateQueries({ queryKey: ['metadata'] });
      setEditingId(null);
      setOpen(false);
      setForm({ name: '', code: '', logoUrl: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Update Failed')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/admin/brands/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Cluster State Toggled');
      qc.invalidateQueries({ queryKey: ['admin-brands'] });
      qc.invalidateQueries({ queryKey: ['metadata'] });
    }
  });

  const handleSubmit = () => {
    if (!form.name || !form.code) return toast.error('Required parameters missing');
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (brand: any) => {
    setForm({ name: brand.name, code: brand.code, logoUrl: brand.logoUrl || '' });
    setEditingId(brand.id);
    setOpen(true);
  };

  if (isLoading) return (
    <div className="py-20 flex justify-center">
       <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Brand Clusters</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Isolated resource deployment & database mapping
          </p>
        </div>
        
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm({ name: '', code: '', logoUrl: '' }); } }}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest gap-2 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> Initialize Cluster
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px] rounded-[32px] border-slate-100 dark:border-slate-800 p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">{editingId ? 'Edit Cluster' : 'Initialize New Cluster'}</DialogTitle>
              <DialogDescription className="text-slate-500 text-xs font-bold uppercase tracking-widest">Configure brand isolation parameters</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cluster Identity (Name)</label>
                <Input
                  placeholder="e.g. Chipotle"
                  className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Code (UID)</label>
                <Input
                  placeholder="e.g. CHIPOTLE"
                  className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold uppercase"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Asset URL</label>
                <Input
                  placeholder="https://assets.alshaya.com/logo.png"
                  className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  value={form.logoUrl}
                  onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Push Updates' : 'Deploy Cluster'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {brands.length === 0 ? (
        <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[40px] bg-slate-50/50 dark:bg-slate-800/20">
          <Tag className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-6" />
          <h4 className="text-lg font-black text-slate-400 uppercase tracking-widest">No Active Clusters</h4>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Initialize your first brand deployment to begin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brands.map((brand: any, i: number) => (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className={cn(
                  "relative group overflow-hidden p-8 rounded-[40px] border transition-all duration-500",
                  brand.isActive
                    ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60"
                )}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-[80px] group-hover:w-32 group-hover:h-32 transition-all duration-500" />
                
                <div className="flex items-start justify-between relative z-10 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-[24px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt={brand.name} className="w-10 h-10 object-contain rounded-lg" />
                      ) : (
                        <Building2 className="w-8 h-8 text-indigo-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">{brand.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <Terminal className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] font-black font-mono text-slate-400 tracking-tighter uppercase">{brand.code}</p>
                      </div>
                    </div>
                  </div>
                  <Badge className={cn(
                    "text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border-none",
                    brand.isActive
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-slate-500/10 text-slate-500"
                  )}>
                    {brand.isActive ? 'ONLINE' : 'OFFLINE'}
                  </Badge>
                </div>

                <div className="space-y-4 mb-8">
                   <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2">
                         <Database className="w-3.5 h-3.5 text-slate-400" />
                         <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Resource Pool</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">SECURED</span>
                   </div>
                   <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2">
                         <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                         <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Isolation Layer</span>
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-slate-50 dark:border-slate-800 relative z-10">
                  <Button
                    variant="ghost"
                    onClick={() => handleEdit(brand)}
                    className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => toggleMutation.mutate({ id: brand.id, isActive: !brand.isActive })}
                    className={cn(
                      "flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2",
                      brand.isActive ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" : "text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {brand.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {brand.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
