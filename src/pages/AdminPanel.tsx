import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Globe, Store, AlertTriangle, Settings, Activity, Ticket, Plus, CreditCard, ExternalLink, ChevronRight, ShieldCheck, History, Info, Loader2, Save, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import AdminPromo from './AdminPromo';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const api = axios.create({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

// --- User Management Tab ---
function UsersTab() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/api/admin/users').then(res => Array.isArray(res.data) ? res.data : []) });
  const { data: countries } = useQuery({ queryKey: ['admin-countries'], queryFn: () => api.get('/api/admin/countries').then(res => Array.isArray(res.data) ? res.data : []) });

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'AGENT', countryId: '' });

  const toggleStatus = async (user: any) => {
    try {
      await api.patch(`/api/admin/users/${user.id}`, { isActive: !user.isActive });
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch {
      toast.error('Update failed');
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/api/admin/users', formData);
      toast.success('User created');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'AGENT', countryId: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-normal text-slate-900">Users</h3>
          <p className="text-sm text-slate-500">Manage user accounts and permissions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 h-9 font-medium">
              <Plus className="w-4 h-4 mr-2" /> Add user
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px] rounded-lg">
            <DialogHeader>
              <DialogTitle className="font-normal text-xl">Add new user</DialogTitle>
              <DialogDescription>Assign credentials and regional access.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Name</Label>
                <Input placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded border-slate-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Email</Label>
                <Input placeholder="email@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="rounded border-slate-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Password</Label>
                <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="rounded border-slate-300" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Role</Label>
                  <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                    <SelectTrigger className="rounded border-slate-300 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGENT">Agent</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role === 'AGENT' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Region</Label>
                    <Select value={formData.countryId} onValueChange={v => setFormData({...formData, countryId: v})}>
                      <SelectTrigger className="rounded border-slate-300 h-9 text-sm"><SelectValue placeholder="Market" /></SelectTrigger>
                      <SelectContent>
                        {Array.isArray(countries) && countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                 <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                 <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6" onClick={handleCreate}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <table className="google-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u: any) => (
            <tr key={u.id}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">{u.name.charAt(0)}</div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-slate-900 truncate">{u.name}</span>
                    <span className="text-[11px] text-slate-500 truncate">{u.email}</span>
                  </div>
                </div>
              </td>
              <td>
                <div className={cn(
                   "inline-flex px-2 py-0.5 rounded text-[11px] font-medium uppercase",
                   u.role === 'ADMIN' ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-700"
                )}>
                  {u.role}
                </div>
              </td>
              <td>
                <div className="flex items-center gap-1.5">
                   <div className={cn("w-1.5 h-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-slate-300")} />
                   <span className="text-xs text-slate-600">{u.isActive ? 'Active' : 'Disabled'}</span>
                </div>
              </td>
              <td className="text-right">
                <Button variant="ghost" className="text-blue-600 text-xs font-medium h-8" onClick={() => toggleStatus(u)}>
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- System Configuration Tab ---
function ConfigTab() {
  const queryClient = useQueryClient();
  const { data: configs } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/api/admin/config').then(res => res.data),
  });

  const [localConfigs, setLocalConfigs] = useState<any[]>([]);
  
  useEffect(() => {
    if (configs) setLocalConfigs(configs);
  }, [configs]);

  const saveConfig = async () => {
    try {
      await api.patch('/api/admin/config', { configs: localConfigs });
      toast.success('Settings updated');
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
    } catch {
      toast.error('Failed to update config');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-lg font-normal text-slate-900">System settings</h3>
        <p className="text-sm text-slate-500">Live variables and operational thresholds</p>
      </div>
      <div className="p-6 space-y-6 max-w-3xl">
        {localConfigs.map((c: any, index: number) => (
          <div key={c.key} className="flex flex-col gap-2">
             <Label className="text-sm font-medium text-slate-700 uppercase tracking-tight text-[11px]">{c.key}</Label>
             <p className="text-xs text-slate-500 mb-1">{c.description}</p>
             <Input 
               value={c.value} 
               className="h-9 rounded border-slate-300 text-sm max-w-sm"
               onChange={(e) => {
                 const newConf = [...localConfigs];
                 newConf[index].value = e.target.value;
                 setLocalConfigs(newConf);
               }}
             />
          </div>
        ))}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button onClick={saveConfig} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-8 h-9 font-medium">
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-normal text-slate-900 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          Enterprise Administration
        </h1>
        <p className="text-sm text-slate-500 mt-1">Global system control and security management</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-transparent border-b border-slate-200 rounded-none h-auto p-0 mb-8 flex gap-8">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'promos', label: 'Promos', icon: Ticket },
            { id: 'config', label: 'Settings', icon: Settings },
            { id: 'audit', label: 'Audit history', icon: History }
          ].map(tab => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id} 
              className="px-0 py-4 h-auto text-sm font-medium border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent rounded-none transition-all hover:text-slate-900"
            >
              <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users" className="mt-0 outline-none"><UsersTab /></TabsContent>
        <TabsContent value="promos" className="mt-0 outline-none"><AdminPromo /></TabsContent>
        <TabsContent value="config" className="mt-0 outline-none"><ConfigTab /></TabsContent>
        <TabsContent value="audit" className="mt-0 outline-none">
           <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400">
             Audit history log is currently being migrated to the new schema.
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
