import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Command,
  ChevronRight,
  TrendingUp,
  LayoutGrid,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function RefundOpsHub() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['ops-queue'],
    queryFn: () => api.get('/api/admin/ops-queue').then(r => r.data),
    refetchInterval: 15000
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      api.patch(`/api/cases/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-queue'] });
      toast.success('Queue item processed');
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="relative">
         <div className="w-12 h-12 border-4 border-stripe-blurple/20 border-t-stripe-blurple rounded-full animate-spin" />
         <LayoutGrid className="absolute inset-0 m-auto w-4 h-4 text-stripe-blurple" />
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <div className="flex items-center gap-2 mb-3">
              <div className="px-2.5 py-1 bg-stripe-blurple/10 text-stripe-blurple rounded-lg text-[10px] font-bold uppercase tracking-wider border border-stripe-blurple/20 flex items-center gap-1.5">
                 <Zap className="w-3 h-3 fill-stripe-blurple" />
                 Mission Control
              </div>
           </div>
           <h1 className="stripe-h1">Work Queue</h1>
           <p className="text-[16px] text-stripe-slate">High-priority refund requests requiring administrative audit and override.</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
           <button className="stripe-button stripe-button-secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['ops-queue'] })}>
              <RefreshCw className="w-4 h-4" />
              <span>Sync queue</span>
           </button>
           <button className="stripe-button stripe-button-primary bg-stripe-dark hover:bg-stripe-dark/90 group">
              <ShieldCheck className="w-4 h-4" />
              <span>Bulk Authorize</span>
              <div className="ml-2 w-1.5 h-1.5 rounded-full bg-stripe-green group-hover:scale-150 transition-transform" />
           </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {/* Active Work Queue Card */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="stripe-surface overflow-hidden shadow-stripe-lg"
        >
          <div className="px-10 py-6 border-b border-stripe-border flex flex-wrap items-center justify-between gap-6 bg-white/60 backdrop-blur-md">
             <div className="flex items-center gap-6 flex-1">
                <div className="relative max-w-sm w-full group">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
                   <input placeholder="Filter instructions..." className="stripe-input-field pl-10 h-10 border-transparent bg-gray-50/50 focus:bg-white transition-all" />
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 border border-stripe-border rounded text-[10px] font-bold text-stripe-light-slate bg-white">
                      <Command className="w-2.5 h-2.5" />
                      Q
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <button className="px-4 py-2 rounded-lg text-[13px] font-bold bg-stripe-error/10 text-stripe-error border border-stripe-error/20 hover:bg-stripe-error hover:text-white transition-all">High Priority</button>
                   <button className="px-4 py-2 rounded-lg text-[13px] font-bold text-stripe-slate border border-stripe-border hover:bg-gray-50 transition-all">SLA Overdue</button>
                </div>
             </div>
             <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border border-stripe-border rounded-xl">
                <ShieldCheck className="w-4 h-4 text-stripe-green" />
                <span className="text-[12px] font-bold text-stripe-dark uppercase tracking-wider">KYC & Risk Filters Active</span>
             </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="stripe-table">
              <thead>
                <tr>
                  <th>Audit Priority</th>
                  <th>Instruction Resource</th>
                  <th>Origin & Destination</th>
                  <th className="text-right">Settlement Value</th>
                  <th className="text-right">Governance</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={5} className="py-32 text-center text-stripe-slate italic font-medium">Clear queue. No instructions requiring immediate override.</td></tr>
                ) : queue.map((c: any, i: number) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + (i * 0.05) }}
                    key={c.id} 
                    className="group"
                  >
                    <td className="w-[180px]">
                      <div className="flex items-center gap-2">
                        {c.riskLevel === 'HIGH' ? (
                          <div className="stripe-badge stripe-badge-error gap-1.5 animate-pulse">
                             <ShieldAlert className="w-3 h-3" />
                             CRITICAL
                          </div>
                        ) : (
                          <div className="stripe-badge stripe-badge-warning gap-1.5">
                             <Clock className="w-3 h-3" />
                             AUDIT REQ.
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[14px] font-bold text-stripe-blurple hover:underline cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>{c.caseNumber}</span>
                           <ArrowUpRight className="w-3.5 h-3.5 text-stripe-blurple opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-stripe-blurple/20" />
                           <span className="text-[12px] text-stripe-slate font-semibold truncate max-w-[200px]">{c.refundReason}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 border border-stripe-border flex items-center justify-center text-stripe-slate group-hover:bg-white group-hover:shadow-stripe-sm transition-all">
                           <Globe className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[14px] font-bold text-stripe-dark">{c.customerName}</span>
                           <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-stripe-light-slate font-bold uppercase tracking-wider">{c.country?.code} Market</span>
                              <ChevronRight className="w-2.5 h-2.5 text-stripe-light-slate" />
                              <span className="text-[11px] text-stripe-blurple font-bold uppercase">Lvl 3 Verification</span>
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                       <div className="flex flex-col items-end">
                          <span className="text-[16px] font-bold text-stripe-dark font-mono">{(c.partialAmount ?? c.orderAmount)?.toLocaleString()} <span className="text-[12px] font-semibold text-stripe-light-slate uppercase">{c.country?.currency}</span></span>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-stripe-green uppercase tracking-tighter">
                             <TrendingUp className="w-3 h-3" />
                             Instruction Valid
                          </div>
                       </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => updateStatus.mutate({ id: c.id, status: 'REJECTED' })}
                          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 text-stripe-error transition-all border border-transparent hover:border-red-100 shadow-none hover:shadow-stripe-sm active:scale-95"
                        >
                           <AlertCircle className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => updateStatus.mutate({ id: c.id, status: 'APPROVED' })}
                          className="stripe-button stripe-button-primary h-10 px-6 text-[13px] shadow-stripe-md active:scale-95"
                        >
                           Authorize
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          </motion.div>
      </div>
    </div>
  );
}
