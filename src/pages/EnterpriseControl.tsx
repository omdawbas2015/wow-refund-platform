import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Mail, 
  Settings2, 
  Users2, 
  Zap, 
  History, 
  Plus, 
  Save, 
  Trash2, 
  MoreVertical,
  ChevronRight,
  ShieldCheck,
  Activity,
  FileDown,
  Search,
  Filter,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const categories = [
  { value: 'APPROVAL', label: 'Approval Notifications' },
  { value: 'KNET_REFUND', label: 'Bank Notifications' },
  { value: 'AURA_REFUND', label: 'Loyalty Notifications' },
  { value: 'FOLLOW_UP', label: 'Customer Updates' },
];

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function EnterpriseControl() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('templates');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [logSearch, setLogSearch] = useState('');

  // Queries
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => api.get('/api/admin/templates').then(r => r.data)
  });

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ['admin-teams'],
    queryFn: () => api.get('/api/admin/teams').then(r => r.data)
  });

  const { data: emailLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['admin-email-logs'],
    queryFn: () => api.get('/api/admin/email-logs').then(r => r.data)
  });

  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-normal text-slate-900 flex items-center gap-3">
          <Settings2 className="w-6 h-6 text-blue-600" />
          Resource management
        </h1>
        <p className="text-sm text-slate-500 mt-1">Configure communication templates and operational workflows</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-1">
          {[
            { id: 'templates', label: 'Message templates', icon: Mail },
            { id: 'teams', label: 'Regional teams', icon: Users2 },
            { id: 'logs', label: 'Communication logs', icon: History },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium transition-colors",
                activeTab === item.id 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
          {activeTab === 'templates' && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
               <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-lg font-normal text-slate-900">Communication templates</h3>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 h-9 font-medium" onClick={() => setIsTemplateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Create template
                  </Button>
               </div>
               <div className="divide-y divide-slate-100">
                  {isLoadingTemplates ? (
                    <div className="p-12 text-center"><Activity className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                  ) : templates.map((tmpl: any) => (
                    <div key={tmpl.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                           <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{tmpl.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">{tmpl.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-medium uppercase text-slate-400 border-slate-200">{tmpl.category}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'teams' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {teams.map((team: any) => (
                 <div key={team.id} className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-base font-medium text-slate-900">{team.name} operations</h4>
                        <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                           <span className="text-[10px] text-emerald-600 font-bold uppercase">Active</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1">
                           <p className="text-[11px] text-slate-500 uppercase font-medium">Group email</p>
                           <p className="text-sm text-slate-900">{team.emailGroup}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[11px] text-slate-500 uppercase font-medium">SLA window</p>
                           <p className="text-sm text-slate-900 font-medium">{team.slaHours} hours</p>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-6 w-full h-8 text-xs font-medium border-slate-300">Edit team</Button>
                 </div>
               ))}
             </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
               <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="relative max-w-sm w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Filter communications..." className="pl-9 h-9 rounded border-slate-300 text-sm" value={logSearch} onChange={e => setLogSearch(e.target.value)} />
                  </div>
                  <Button variant="ghost" className="text-primary text-xs font-medium h-8">
                    <FileDown className="w-3.5 h-3.5 mr-2" /> Export
                  </Button>
               </div>
               <table className="google-table">
                  <thead>
                     <tr>
                        <th>Timestamp</th>
                        <th>Type</th>
                        <th>Recipient</th>
                        <th className="text-right">Status</th>
                     </tr>
                  </thead>
                  <tbody>
                     {emailLogs.map((log: any) => (
                        <tr key={log.id}>
                           <td className="text-slate-500 text-xs">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</td>
                           <td><Badge variant="outline" className="text-[10px] uppercase font-medium text-slate-400">{log.type}</Badge></td>
                           <td className="text-sm text-slate-700 max-w-[200px] truncate">{log.recipients}</td>
                           <td className="text-right">
                              <div className={cn(
                                 "inline-flex items-center gap-1.5 text-xs font-medium",
                                 log.status === 'SENT' ? "text-emerald-600" : "text-red-500"
                              )}>
                                 {log.status === 'SENT' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                 {log.status}
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
