import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Ticket, 
  Plus, 
  Upload, 
  Search, 
  Trash2,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Columns,
  Settings2,
  Filter,
  FileSpreadsheet,
  ChevronRight,
  Zap,
  ShieldCheck,
  Building2,
  Globe,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToExcel } from '@/lib/exportUtils';

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function AdminPromo() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'STANDARD' | 'INTERNAL'>('STANDARD');
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Queries
  const { data: promoCodes, isLoading } = useQuery({
    queryKey: ['promoCodes', activeTab],
    queryFn: async () => {
      const type = activeTab === 'STANDARD' ? 'COMPENSATION' : 'INTERNAL_100';
      const response = await api.get(`/api/promo?type=${type}`);
      return response.data;
    }
  });

  const { data: metaData } = useQuery({
    queryKey: ['metadata'],
    queryFn: () => api.get('/api/metadata').then(r => r.data)
  });

  const { data: inventory } = useQuery({
    queryKey: ['promoInventory'],
    queryFn: () => api.get('/api/promo/inventory').then(r => r.data),
    refetchInterval: 30000
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/promo', data),
    onSuccess: () => {
      toast.success('Voucher authorized and published');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/promo/${id}`),
    onSuccess: () => {
      toast.success('Resource decommissioned');
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] });
    }
  });

  const filteredCodes = useMemo(() => {
    if (!Array.isArray(promoCodes)) return [];
    return promoCodes.filter((p: any) => {
      const s = searchTerm.toLowerCase();
      return !s || p.code?.toLowerCase().includes(s) || (p.usage?.caseNumber?.toLowerCase().includes(s));
    });
  }, [promoCodes, searchTerm]);

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-8 animate-stripe">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <div className="flex items-center gap-2 mb-3">
              <div className="px-2.5 py-1 bg-stripe-blurple/10 text-stripe-blurple rounded-lg text-[10px] font-bold uppercase tracking-wider border border-stripe-blurple/20 flex items-center gap-1.5">
                 <ShieldCheck className="w-3 h-3" />
                 Inventory Management
              </div>
           </div>
           <h1 className="stripe-h1">Voucher Repository</h1>
           <p className="text-[16px] text-stripe-slate">Centralized governance for global compensation and service recovery resources.</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
           <button onClick={() => setIsUploadOpen(true)} className="stripe-button stripe-button-secondary">
              <Upload className="w-4 h-4" />
              <span>Bulk Import</span>
           </button>
           <button onClick={() => setIsCreateOpen(true)} className="stripe-button stripe-button-primary">
              <Plus className="w-4 h-4" />
              <span>Create Resource</span>
           </button>
        </motion.div>
      </div>

      {/* Snapshot KPI Cards - Stripe Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        <AnimatePresence>
           {Array.isArray(inventory) && inventory.slice(0, 4).map((inv: any, i: number) => (
             <motion.div 
               key={i} 
               initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               className="stripe-surface p-8 group hover:border-stripe-blurple transition-all relative overflow-hidden"
             >
                <div className="absolute top-0 right-0 w-24 h-24 bg-stripe-blurple/[0.02] rounded-bl-full transition-transform group-hover:scale-110" />
                <div className="flex justify-between items-start mb-6">
                   <div className="stripe-badge text-[10px] uppercase font-bold tracking-tighter">
                      {inv.type?.replace('_', ' ')}
                   </div>
                   <Ticket className="w-4.5 h-4.5 text-stripe-light-slate group-hover:text-stripe-blurple transition-colors" />
                </div>
                <p className="text-[36px] font-bold text-stripe-dark tracking-tighter leading-none mb-2">{inv._count}</p>
                <p className="text-[12px] text-stripe-light-slate font-bold uppercase tracking-widest">Available Units</p>
                <div className="mt-8 pt-6 border-t border-stripe-border flex justify-between items-center text-[13px]">
                   <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-stripe-light-slate" />
                      <span className="text-stripe-dark font-bold">{inv.country?.name || 'Global Sect.'}</span>
                   </div>
                   <span className="text-stripe-blurple font-bold">{inv.value} {inv.currency}</span>
                </div>
             </motion.div>
           ))}
        </AnimatePresence>
      </div>

      {/* Main Table Interface */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="stripe-surface overflow-hidden shadow-stripe-lg"
      >
        <div className="px-8 border-b border-stripe-border bg-white flex gap-10">
          {[
            { id: 'STANDARD', label: 'Retention Rewards' },
            { id: 'INTERNAL', label: 'Internal Compensation (100%)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "h-14 text-[14px] font-bold transition-all relative flex items-center px-1",
                activeTab === tab.id ? "text-stripe-blurple" : "text-stripe-light-slate hover:text-stripe-dark"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="repo-tab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-stripe-blurple rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="px-8 py-5 border-b border-stripe-border flex items-center justify-between bg-white/60 backdrop-blur-md">
           <div className="flex items-center gap-6 flex-1">
             <div className="relative w-full max-w-md group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
                <input 
                  placeholder="Filter resources by code or allocation..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="stripe-input-field pl-10 h-10 border-transparent bg-gray-50/50 focus:bg-white"
                />
             </div>
             <button className="stripe-button stripe-button-secondary h-10 px-4 text-[13px]">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
             </button>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => exportToExcel(filteredCodes, [], 'Voucher_Export')} className="p-2.5 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all" title="Export Manifest">
                 <Download className="w-4 h-4" />
              </button>
              <button className="p-2.5 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all" onClick={() => queryClient.invalidateQueries({ queryKey: ['promoCodes'] })}>
                 <RefreshCw className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-stripe-border mx-1" />
              <button className="p-2.5 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all">
                 <Settings2 className="w-4 h-4" />
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="stripe-table">
            <thead>
              <tr>
                <th>Voucher Identity</th>
                <th>Regional Governance</th>
                <th className="text-right">Settlement Value</th>
                <th className="text-center">Lifecycle Status</th>
                <th>Allocation Metadata</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                 {isLoading ? (
                    <tr><td colSpan={6} className="py-24 text-center text-stripe-slate italic">Synchronizing repository data...</td></tr>
                 ) : filteredCodes.length === 0 ? (
                    <tr><td colSpan={6} className="py-24 text-center text-stripe-slate italic">No matching records in inventory</td></tr>
                 ) : filteredCodes.map((p: any, i: number) => (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      key={p.id} 
                      className="group"
                    >
                      <td>
                        <div className="flex flex-col">
                           <span className="text-[14px] font-bold text-stripe-blurple font-mono tracking-tighter hover:underline cursor-pointer">{p.code}</span>
                           <span className="text-[11px] text-stripe-light-slate font-bold uppercase mt-0.5">{p.createdAt ? format(new Date(p.createdAt), 'MMM d, yyyy') : 'Pre-audit Entry'}</span>
                        </div>
                      </td>
                      <td>
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-stripe-border flex items-center justify-center text-stripe-slate group-hover:bg-white group-hover:shadow-stripe-sm transition-all">
                               <Building2 className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                               <span className="text-[13px] text-stripe-dark font-bold">{p.country?.name || 'Global Entity'}</span>
                               {p.brand && <span className="text-[10px] text-stripe-blurple font-bold uppercase">{p.brand.name} Node</span>}
                            </div>
                         </div>
                      </td>
                      <td className="text-right">
                         <span className="text-[15px] font-bold text-stripe-dark font-mono">{p.value} <span className="text-[11px] font-semibold text-stripe-light-slate uppercase">{p.currency}</span></span>
                      </td>
                      <td className="text-center">
                         <div className="flex justify-center">
                            <div className={cn(
                              "stripe-badge",
                              p.status === 'AVAILABLE' ? "stripe-badge-success" : 
                              p.status === 'USED' ? "stripe-badge-info" : "stripe-badge-warning"
                            )}>
                               {p.status.toLowerCase()}
                            </div>
                         </div>
                      </td>
                      <td>
                         {p.usage ? (
                            <div className="flex flex-col">
                               <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] font-bold text-stripe-dark">Allocated to #{p.usage.caseNumber}</span>
                                  <ArrowUpRight className="w-3.5 h-3.5 text-stripe-blurple" />
                               </div>
                               <span className="text-[11px] text-stripe-light-slate font-bold uppercase">{format(new Date(p.usage.usedAt), 'MMM d, HH:mm')}</span>
                            </div>
                         ) : (
                            <span className="text-[11px] text-stripe-light-slate italic font-bold uppercase tracking-widest">Unallocated</span>
                         )}
                      </td>
                      <td className="text-right">
                        {p.status !== 'USED' && (
                           <button onClick={() => deleteMutation.mutate(p.id)} className="p-2.5 hover:bg-red-50 rounded-xl text-stripe-error transition-all border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4" />
                           </button>
                        )}
                      </td>
                    </motion.tr>
                 ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Creation Dialog - Stripe Style */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
         <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 overflow-hidden border-none shadow-stripe-lg">
            <div className="px-10 py-6 bg-white border-b border-stripe-border">
               <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-stripe-blurple rounded-lg flex items-center justify-center text-white">
                     <Zap className="w-5 h-5 fill-white" />
                  </div>
                  <DialogTitle className="text-[20px] font-bold text-stripe-dark tracking-tight">Resource Provisioning</DialogTitle>
               </div>
               <DialogDescription className="text-[14px] text-stripe-slate font-medium">Manually publish a new compensation voucher to the global repository.</DialogDescription>
            </div>
            <form onSubmit={(e) => {
               e.preventDefault();
               const formData = new FormData(e.currentTarget);
               const data = Object.fromEntries(formData);
               if (data.brandId === 'none') delete data.brandId;
               createMutation.mutate(data);
            }} className="p-10 space-y-8 bg-white">
               <div className="space-y-2">
                  <label className="stripe-label">Unique Resource Identifier (Code)</label>
                  <input name="code" required placeholder="e.g. AL-2024-X" className="stripe-input-field font-mono font-bold" />
               </div>
               <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                     <label className="stripe-label">Operating Sector</label>
                     <Select name="countryId" required>
                        <SelectTrigger className="stripe-input-field">
                           <SelectValue placeholder="Market" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl p-1 shadow-stripe-lg border-stripe-border">
                           {metaData?.countries?.map((c: any) => (<SelectItem key={c.id} value={c.id} className="rounded-lg py-2.5">{c.name}</SelectItem>))}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <label className="stripe-label">Brand</label>
                     <Select name="brandId">
                        <SelectTrigger className="stripe-input-field">
                           <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl p-1 shadow-stripe-lg border-stripe-border">
                           <SelectItem value="none">Global (No Brand)</SelectItem>
                           {metaData?.brands?.map((b: any) => (<SelectItem key={b.id} value={b.id} className="rounded-lg py-2.5">{b.name}</SelectItem>))}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <label className="stripe-label">Settlement Value</label>
                     <div className="relative">
                        <input name="value" type="number" step="0.01" required placeholder="0.00" className="stripe-input-field" />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-stripe-light-slate">CURR.</div>
                     </div>
                  </div>
               </div>
               <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setIsCreateOpen(false)} className="stripe-button stripe-button-secondary h-11 px-8">Discard</button>
                  <button type="submit" className="stripe-button stripe-button-primary h-11 px-10">Authorize & Publish</button>
               </div>
            </form>
         </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog - Stripe Style */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
         <DialogContent className="sm:max-w-[500px] rounded-2xl p-10 overflow-hidden text-center">
            <div className="w-20 h-20 bg-stripe-blurple/[0.03] rounded-3xl flex items-center justify-center mx-auto mb-8 border border-stripe-blurple/10">
               <FileSpreadsheet className="w-10 h-10 text-stripe-blurple" />
            </div>
            <h2 className="text-[22px] font-bold text-stripe-dark tracking-tight mb-2">Repository Bulk Import</h2>
            <p className="text-[15px] text-stripe-slate font-medium leading-relaxed max-w-sm mx-auto">
               Synchronize the global repository by uploading a batch manifest of pre-generated resources.
            </p>
            <div className="mt-10 pt-10 border-t border-stripe-border">
               <input type="file" id="bulk-file" className="hidden" />
               <button onClick={() => document.getElementById('bulk-file')?.click()} className="stripe-button stripe-button-primary w-full h-12 shadow-stripe-lg active:scale-95">
                  <Upload className="w-4 h-4" />
                  Select Manifest Source
               </button>
               <div className="mt-6 flex items-center justify-center gap-4 text-[11px] font-bold text-stripe-light-slate uppercase tracking-widest">
                  <div className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-stripe-blurple" /> CSV Required</div>
                  <div className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-stripe-blurple" /> UTF-8 Format</div>
               </div>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
