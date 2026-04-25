import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Globe, 
  Building2, 
  MapPin, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Loader2, 
  CheckCircle2, 
  ChevronRight,
  Zap,
  ShieldCheck,
  Search
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const api = axios.create({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function GeographyTab() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'countries' | 'branches'>('countries');
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const { data: countries = [], isLoading: countriesLoading } = useQuery({ 
    queryKey: ['admin-countries'], 
    queryFn: () => api.get('/api/admin/countries').then(r => Array.isArray(r.data) ? r.data : []) 
  });
  
  const { data: branches = [], isLoading: branchesLoading } = useQuery({ 
    queryKey: ['admin-branches'], 
    queryFn: () => api.get('/api/admin/branches').then(r => Array.isArray(r.data) ? r.data : []) 
  });

  const handleCreateOrUpdate = async () => {
    try {
      const endpoint = activeSubTab === 'countries' ? '/api/admin/countries' : '/api/admin/branches';
      if (editItem) {
        await api.patch(`${endpoint}/${editItem.id}`, formData);
        toast.success('Configuration updated');
      } else {
        await api.post(endpoint, formData);
        toast.success('Resource provisioned');
      }
      queryClient.invalidateQueries({ queryKey: [`admin-${activeSubTab}`] });
      setOpen(false);
      setEditItem(null);
      setFormData({});
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this resource?')) return;
    try {
      const endpoint = activeSubTab === 'countries' ? '/api/admin/countries' : '/api/admin/branches';
      await api.delete(`${endpoint}/${id}`);
      toast.success('Resource decommissioned');
      queryClient.invalidateQueries({ queryKey: [`admin-${activeSubTab}`] });
    } catch { toast.error('Decommissioning failed'); }
  };

  return (
    <div className="space-y-10 animate-stripe">
      {/* High Fidelity Sub-Navigation */}
      <div className="flex items-center justify-between border-b border-stripe-border pb-1">
        <div className="flex gap-8">
          {[
            { id: 'countries', label: 'Market Sectors', icon: Globe },
            { id: 'branches', label: 'Physical Nodes', icon: Building2 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={cn(
                "pb-4 text-[14px] font-bold transition-all relative flex items-center gap-2",
                activeSubTab === tab.id ? "text-stripe-blurple" : "text-stripe-light-slate hover:text-stripe-dark"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeSubTab === tab.id && (
                <motion.div 
                  layoutId="subtab-active"
                  className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-stripe-blurple rounded-full z-10"
                />
              )}
            </button>
          ))}
        </div>
        <button 
          onClick={() => { setEditItem(null); setFormData({}); setOpen(true); }}
          className="stripe-button stripe-button-primary h-9 px-5 mb-2 text-[13px]"
        >
          <Plus className="w-4 h-4" /> <span>Add {activeSubTab === 'countries' ? 'Sector' : 'Node'}</span>
        </button>
      </div>

      {/* Resource Grid / Table */}
      <div className="stripe-surface overflow-hidden">
        <table className="stripe-table">
          <thead>
            {activeSubTab === 'countries' ? (
              <tr>
                <th>Region Name</th>
                <th>ISO Code</th>
                <th>Currency</th>
                <th className="text-right">Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Node Name</th>
                <th>Market Assignment</th>
                <th>Physical Identity</th>
                <th className="text-right">Actions</th>
              </tr>
            )}
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
               {(activeSubTab === 'countries' ? countriesLoading : branchesLoading) ? (
                 <tr><td colSpan={4} className="py-24 text-center text-stripe-slate italic">Synchronizing regional parameters...</td></tr>
               ) : (activeSubTab === 'countries' ? countries : branches).length === 0 ? (
                 <tr><td colSpan={4} className="py-24 text-center text-stripe-slate italic">No resources found in current sector</td></tr>
               ) : (activeSubTab === 'countries' ? countries : branches).map((item: any, i: number) => (
                 <motion.tr 
                   initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.05 }}
                   key={item.id} 
                   className="group"
                 >
                   {activeSubTab === 'countries' ? (
                     <>
                       <td>
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-stripe-blurple/5 border border-stripe-blurple/10 flex items-center justify-center text-stripe-blurple font-bold text-[11px]">
                                {item.code}
                             </div>
                             <span className="text-[14px] font-bold text-stripe-dark">{item.name}</span>
                          </div>
                       </td>
                       <td><span className="text-[13px] text-stripe-slate font-bold font-mono tracking-wider">{item.code}</span></td>
                       <td>
                          <div className="flex items-center gap-2">
                             <Zap className="w-3.5 h-3.5 text-stripe-yellow" />
                             <span className="text-[13px] text-stripe-dark font-bold uppercase">{item.currency}</span>
                          </div>
                       </td>
                     </>
                   ) : (
                     <>
                       <td><span className="text-[14px] font-bold text-stripe-dark">{item.name}</span></td>
                       <td>
                          <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-stripe-border rounded-lg self-start">
                             <Globe className="w-3 h-3 text-stripe-light-slate" />
                             <span className="text-[12px] text-stripe-dark font-bold uppercase">{item.country?.code || 'Global'}</span>
                          </div>
                       </td>
                       <td><span className="text-[13px] text-stripe-slate font-medium">{item.id.slice(0, 8)}</span></td>
                     </>
                   )}
                   <td className="text-right">
                     <div className="flex items-center justify-end gap-2">
                       <button 
                         onClick={() => { setEditItem(item); setFormData(item); setOpen(true); }}
                         className="p-2 hover:bg-gray-100 rounded-lg text-stripe-slate transition-colors"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => handleDelete(item.id)}
                         className="p-2 hover:bg-red-50 rounded-lg text-stripe-error transition-colors border border-transparent hover:border-red-100"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   </td>
                 </motion.tr>
               ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Configuration Dialog - Stripe Style */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-0 overflow-hidden border-none shadow-stripe-lg">
           <div className="px-10 py-6 bg-white border-b border-stripe-border">
              <div className="flex items-center gap-3 mb-1">
                 <div className="w-8 h-8 bg-stripe-blurple rounded-lg flex items-center justify-center text-white">
                    <MapPin className="w-5 h-5" />
                 </div>
                 <DialogTitle className="text-[20px] font-bold text-stripe-dark tracking-tight">Configuration Profile</DialogTitle>
              </div>
              <DialogDescription className="text-[14px] text-stripe-slate font-medium">Configure regional parameters for automated refund settlement flows.</DialogDescription>
           </div>
           
           <div className="p-10 space-y-8 bg-white">
             <div className="space-y-2">
               <label className="stripe-label">Identity / Resource Name</label>
               <input 
                 placeholder={activeSubTab === 'countries' ? "e.g. Kuwait, United Arab Emirates..." : "e.g. Central Mall, Flagship Store..."}
                 value={formData.name || ''} 
                 onChange={e => setFormData({...formData, name: e.target.value})}
                 className="stripe-input-field"
               />
             </div>
             
             {activeSubTab === 'countries' ? (
               <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                   <label className="stripe-label">ISO Alpha-2 Code</label>
                   <input 
                     placeholder="e.g. KW" 
                     value={formData.code || ''} 
                     onChange={e => setFormData({...formData, code: e.target.value})}
                     className="stripe-input-field font-mono uppercase"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="stripe-label">Settlement Currency</label>
                   <input 
                     placeholder="e.g. KWD" 
                     value={formData.currency || ''} 
                     onChange={e => setFormData({...formData, currency: e.target.value})}
                     className="stripe-input-field font-mono uppercase"
                   />
                 </div>
               </div>
             ) : (
               <div className="space-y-2">
                 <label className="stripe-label">Sector Root ID</label>
                 <div className="relative">
                    <input 
                      placeholder="Enter parent sector UUID..." 
                      value={formData.countryId || ''} 
                      onChange={e => setFormData({...formData, countryId: e.target.value})}
                      className="stripe-input-field"
                    />
                    <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate" />
                 </div>
               </div>
             )}
           </div>

           <div className="flex justify-end gap-3 p-8 bg-gray-50/50 border-t border-stripe-border">
              <button onClick={() => setOpen(false)} className="stripe-button stripe-button-secondary h-10 px-6">Discard</button>
              <button onClick={handleCreateOrUpdate} className="stripe-button stripe-button-primary h-10 px-8">Update Resource</button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
