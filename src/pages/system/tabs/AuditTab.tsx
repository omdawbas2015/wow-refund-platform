import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Clock, 
  User, 
  Activity, 
  Database, 
  ExternalLink,
  ChevronRight,
  Code,
  Lock,
  ArrowRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const api = axios.create({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function AuditTab() {
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs = [], isLoading } = useQuery({ 
    queryKey: ['admin-audit'], 
    queryFn: () => api.get('/api/admin/audit-logs').then(r => Array.isArray(r.data) ? r.data : []) 
  });

  const filtered = logs.filter((l: any) =>
    !search || 
    l.actionType?.toLowerCase().includes(search.toLowerCase()) || 
    l.actorName?.toLowerCase().includes(search.toLowerCase()) ||
    l.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-stripe">
      {/* Audit Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-lg group">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
           <input 
             placeholder="Search immutable ledger by action, operative or metadata..." 
             value={search} 
             onChange={e => setSearch(e.target.value)}
             className="stripe-input-field pl-10 h-11 border-transparent bg-gray-50/50 focus:bg-white transition-all"
           />
        </div>
        <div className="flex items-center gap-3">
           <button className="stripe-button stripe-button-secondary h-11">
              <Filter className="w-4 h-4" />
              <span>Filter log</span>
           </button>
           <button className="stripe-button stripe-button-secondary h-11">
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
           </button>
        </div>
      </div>

      {/* Ledger Table - Stripe Style */}
      <div className="stripe-surface overflow-hidden">
        <div className="px-8 py-5 border-b border-stripe-border bg-white flex items-center justify-between">
           <h3 className="text-[14px] font-bold text-stripe-dark uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00d924]" />
              Immutable Operations Log
           </h3>
           <div className="flex items-center gap-2 text-[11px] font-bold text-stripe-light-slate uppercase">
              <Database className="w-3 h-3" />
              Mainnet DB
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="stripe-table">
            <thead>
              <tr>
                <th>Event Identity</th>
                <th>Operative Node</th>
                <th>Lifecycle Action</th>
                <th className="text-right">Timestamp</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                 {isLoading ? (
                    <tr><td colSpan={5} className="py-24 text-center text-stripe-slate italic">Synchronizing immutable ledger...</td></tr>
                 ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="py-24 text-center text-stripe-slate italic">No audit records found in current block</td></tr>
                 ) : filtered.map((l: any, i: number) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      key={l.id} 
                      className="group cursor-pointer"
                      onClick={() => setSelectedLog(l)}
                    >
                      <td>
                        <div className="flex flex-col">
                           <span className="text-[13px] font-bold text-stripe-dark uppercase tracking-wider font-mono">TX-{l.id.slice(0, 8)}</span>
                           <span className="text-[11px] text-stripe-light-slate font-medium truncate max-w-[200px]">{l.description}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                           <div className="w-7 h-7 rounded-lg bg-gray-50 border border-stripe-border flex items-center justify-center text-stripe-slate shadow-sm group-hover:bg-white transition-all">
                              <User className="w-3.5 h-3.5" />
                           </div>
                           <span className="text-[13px] font-bold text-stripe-dark">{l.actorName}</span>
                        </div>
                      </td>
                      <td>
                        <div className={cn(
                          "stripe-badge text-[10px]",
                          l.actionType.includes('CREATED') ? "stripe-badge-success" : 
                          l.actionType.includes('UPDATED') ? "stripe-badge-info" : "stripe-badge-info"
                        )}>
                          {l.actionType.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex flex-col items-end">
                           <span className="text-[13px] font-bold text-stripe-dark">{format(new Date(l.timestamp), 'MMM d, HH:mm')}</span>
                           <span className="text-[11px] text-stripe-light-slate font-medium">{format(new Date(l.timestamp), 'ss')}s offset</span>
                        </div>
                      </td>
                      <td>
                         <button className="p-2 hover:bg-gray-100 rounded-lg text-stripe-slate opacity-0 group-hover:opacity-100 transition-all">
                            <Eye className="w-4 h-4" />
                         </button>
                      </td>
                    </motion.tr>
                 ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Viewer - Stripe Style */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl p-0 overflow-hidden border-none shadow-stripe-lg">
           <div className="px-10 py-6 bg-white border-b border-stripe-border">
              <div className="flex items-center gap-3 mb-1">
                 <div className="w-8 h-8 bg-stripe-dark rounded-lg flex items-center justify-center text-white">
                    <Lock className="w-4 h-4" />
                 </div>
                 <DialogTitle className="text-[20px] font-bold text-stripe-dark tracking-tight">Audit Manifest Details</DialogTitle>
              </div>
              <DialogDescription className="text-[14px] text-stripe-slate font-medium">Immutable transaction record for security and compliance audit.</DialogDescription>
           </div>
           
           <div className="p-10 space-y-10 bg-white">
             <div className="grid grid-cols-2 gap-10">
                <div className="space-y-6">
                   <div>
                      <label className="stripe-label block mb-2">Event Origin</label>
                      <div className="flex items-center gap-2 font-bold text-stripe-dark text-[14px]">
                         <User className="w-4 h-4 text-stripe-blurple" />
                         {selectedLog?.actorName}
                      </div>
                   </div>
                   <div>
                      <label className="stripe-label block mb-2">Lifecycle Stage</label>
                      <span className="stripe-badge">{selectedLog?.actionType.replace(/_/g, ' ')}</span>
                   </div>
                </div>
                <div className="space-y-6">
                   <div>
                      <label className="stripe-label block mb-2">System Timestamp</label>
                      <div className="flex items-center gap-2 text-stripe-dark font-bold text-[14px]">
                         <Clock className="w-4 h-4 text-stripe-blurple" />
                         {selectedLog && format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                      </div>
                   </div>
                   <div>
                      <label className="stripe-label block mb-2">Network ID</label>
                      <span className="text-[13px] font-mono font-bold text-stripe-slate">{selectedLog?.id}</span>
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <label className="stripe-label flex items-center gap-2">
                   <Code className="w-4 h-4 text-stripe-blurple" />
                   Metadata Payload
                </label>
                <div className="p-6 rounded-xl bg-[#0a2540] text-[#e1e7ff] font-mono text-[12px] leading-relaxed relative overflow-hidden shadow-inner">
                   <div className="absolute top-0 right-0 p-4 opacity-20"><Database className="w-12 h-12" /></div>
                   <pre className="relative z-10 whitespace-pre-wrap">
                      {selectedLog?.metadata ? JSON.stringify(JSON.parse(selectedLog.metadata), null, 2) : '// No additional metadata payload'}
                   </pre>
                </div>
             </div>
           </div>

           <div className="flex justify-end p-8 bg-gray-50/50 border-t border-stripe-border">
              <button onClick={() => setSelectedLog(null)} className="stripe-button stripe-button-primary h-11 px-10 group">
                 <span>Close manifest</span>
                 <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
