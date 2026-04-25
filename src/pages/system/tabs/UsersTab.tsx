import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  ShieldCheck, 
  UserX, 
  UserCheck, 
  Loader2, 
  MoreHorizontal, 
  Mail, 
  Shield, 
  Lock, 
  Globe,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const api = axios.create({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function UsersTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'AGENT', countryId: '' });

  const { data: users = [], isLoading } = useQuery({ 
    queryKey: ['admin-users'], 
    queryFn: () => api.get('/api/admin/users').then(r => Array.isArray(r.data) ? r.data : []) 
  });
  
  const { data: countries = [] } = useQuery({ 
    queryKey: ['admin-countries'], 
    queryFn: () => api.get('/api/admin/countries').then(r => Array.isArray(r.data) ? r.data : []) 
  });

  const toggleStatus = async (user: any) => {
    try {
      await api.patch(`/api/admin/users/${user.id}`, { isActive: !user.isActive });
      toast.success(`Access ${user.isActive ? 'suspended' : 'restored'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch { toast.error('Governance update failed'); }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Identity metadata incomplete');
      return;
    }
    try {
      await api.post('/api/admin/users', formData);
      toast.success('Identity provisioned successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'AGENT', countryId: '' });
    } catch (err: any) { toast.error(err.response?.data?.error || 'Provisioning failed'); }
  };

  const filtered = users.filter((u: any) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-stripe">
      {/* Tab Toolbar */}
      <div className="flex items-center justify-between gap-6">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
          <input 
            placeholder="Search by name or email identity..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="stripe-input-field pl-10 h-10 border-transparent bg-gray-50/50 focus:bg-white"
          />
        </div>
        <button 
          onClick={() => setOpen(true)}
          className="stripe-button stripe-button-primary h-10 px-6 text-[13px]"
        >
          <Plus className="w-4 h-4" /> <span>Provision User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="stripe-surface overflow-hidden">
        <table className="stripe-table">
          <thead>
            <tr>
               <th>Identity</th>
               <th>Access Endpoint</th>
               <th>Governance Role</th>
               <th className="text-center">Lifecycle Status</th>
               <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
               {isLoading ? (
                  <tr><td colSpan={5} className="py-24 text-center text-stripe-slate italic">Synchronizing user registry...</td></tr>
               ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-24 text-center text-stripe-slate italic">No matching identity records found</td></tr>
               ) : filtered.map((u: any, i: number) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={u.id} 
                    className="group"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-stripe-blurple/[0.03] border border-stripe-blurple/10 flex items-center justify-center text-stripe-blurple font-bold text-[12px] group-hover:scale-110 transition-transform">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[14px] font-bold text-stripe-dark">{u.name}</span>
                      </div>
                    </td>
                    <td>
                       <div className="flex items-center gap-2">
                          <span className="text-[13px] text-stripe-slate font-medium">{u.email}</span>
                          <Mail className="w-3.5 h-3.5 text-stripe-light-slate opacity-0 group-hover:opacity-100 transition-opacity" />
                       </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Shield className={cn("w-4 h-4", u.role === 'ADMIN' ? "text-stripe-blurple" : "text-stripe-slate")} />
                        <span className={cn("text-[12px] font-bold uppercase tracking-widest", u.role === 'ADMIN' ? "text-stripe-blurple" : "text-stripe-light-slate")}>{u.role}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <div className={cn(
                          "stripe-badge",
                          u.isActive ? "stripe-badge-success" : "stripe-badge-info"
                        )}>
                          {u.isActive ? 'Active Access' : 'Suspended'}
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                       <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => toggleStatus(u)}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-lg transition-all border border-transparent",
                              u.isActive ? "hover:bg-red-50 text-stripe-error hover:border-red-100" : "hover:bg-stripe-green/10 text-stripe-green hover:border-stripe-green/20"
                            )}
                            title={u.isActive ? "Suspend Access" : "Restore Access"}
                          >
                            {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg text-stripe-slate transition-colors">
                             <MoreHorizontal className="w-4 h-4" />
                          </button>
                       </div>
                    </td>
                  </motion.tr>
               ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Creation Dialog - Stripe Style Overhaul */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 overflow-hidden border-none shadow-stripe-lg">
          <div className="px-10 py-6 bg-white border-b border-stripe-border">
            <div className="flex items-center gap-3 mb-1">
               <div className="w-8 h-8 bg-stripe-blurple rounded-lg flex items-center justify-center text-white">
                  <ShieldCheck className="w-5 h-5" />
               </div>
               <DialogTitle className="text-[20px] font-bold text-stripe-dark tracking-tight">Identity Provisioning</DialogTitle>
            </div>
            <DialogDescription className="text-[14px] text-stripe-slate font-medium">Configure authentication and access privileges for the new operative.</DialogDescription>
          </div>
          
          <div className="p-10 space-y-8 bg-white">
            <div className="space-y-2">
              <label className="stripe-label">Legal Identity Name</label>
              <input 
                placeholder="Full operative name..." 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="stripe-input-field"
              />
            </div>
            
            <div className="space-y-2">
              <label className="stripe-label">Work Authentication Email</label>
              <input 
                placeholder="operative@organization.com" 
                type="email" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="stripe-input-field"
              />
            </div>

            <div className="space-y-2">
              <label className="stripe-label">Access Credentials</label>
              <div className="relative">
                 <input 
                   placeholder="Secure character sequence..." 
                   type="password" 
                   value={formData.password} 
                   onChange={e => setFormData({...formData, password: e.target.value})}
                   className="stripe-input-field pr-10"
                 />
                 <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="stripe-label">Governance Role</label>
                <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                  <SelectTrigger className="h-11 border-stripe-border rounded-lg shadow-stripe-sm focus:ring-4 focus:ring-stripe-blurple/10 transition-all font-semibold text-[14px]">
                    <SelectValue placeholder="Select Privilege" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl p-1 shadow-stripe-lg border-stripe-border">
                    <SelectItem value="AGENT" className="rounded-lg py-2.5">Standard Agent</SelectItem>
                    <SelectItem value="ADMIN" className="rounded-lg py-2.5">System Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role === 'AGENT' && (
                <div className="space-y-2 animate-stripe">
                  <label className="stripe-label">Sector Assignment</label>
                  <Select value={formData.countryId} onValueChange={v => setFormData({...formData, countryId: v})}>
                    <SelectTrigger className="h-11 border-stripe-border rounded-lg shadow-stripe-sm focus:ring-4 focus:ring-stripe-blurple/10 transition-all font-semibold text-[14px]">
                      <SelectValue placeholder="Market Region" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl p-1 shadow-stripe-lg border-stripe-border">
                      {countries.map((c: any) => <SelectItem key={c.id} value={c.id} className="rounded-lg py-2.5">{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 p-8 bg-gray-50/50 border-t border-stripe-border">
            <button onClick={() => setOpen(false)} className="stripe-button stripe-button-secondary h-10 px-6">Discard</button>
            <button onClick={handleCreate} className="stripe-button stripe-button-primary h-10 px-8">Provision Identity</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
