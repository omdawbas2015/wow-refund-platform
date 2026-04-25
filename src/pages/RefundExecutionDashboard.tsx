import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Wallet, 
  Activity, 
  Search,
  Download,
  Filter,
  RefreshCw,
  CreditCard,
  Building2,
  FileText,
  ChevronRight,
  Zap,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  ArrowUpRight
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function RefundExecutionDashboard() {
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['refund-batches'],
    queryFn: () => api.get('/api/admin/refund-batches').then(r => r.data),
    refetchInterval: 10000
  });

  const settleCase = useMutation({
    mutationFn: (caseId: string) => api.post(`/api/cases/${caseId}/settle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund-batches'] });
      toast.success('Payout instruction transmitted to treasury');
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="relative">
         <div className="w-12 h-12 border-4 border-stripe-blurple/20 border-t-stripe-blurple rounded-full animate-spin" />
         <Wallet className="absolute inset-0 m-auto w-4 h-4 text-stripe-blurple" />
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <div className="flex items-center gap-2 mb-3">
              <div className="px-2.5 py-1 bg-stripe-green/10 text-stripe-green rounded-lg text-[10px] font-bold uppercase tracking-wider border border-stripe-green/20 flex items-center gap-1.5">
                 <ShieldCheck className="w-3 h-3" />
                 Treasury Operations
              </div>
           </div>
           <h1 className="stripe-h1">Payout Execution</h1>
           <p className="text-[16px] text-stripe-slate">Finalize fund transfers and settlement instructions for verified refunds.</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
           <button className="stripe-button stripe-button-secondary">
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
           </button>
           <button className="stripe-button stripe-button-primary bg-stripe-dark hover:bg-stripe-dark/90">
              <Zap className="w-4 h-4" />
              <span>Initiate bulk payout</span>
           </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {/* KPI Row - Elite Stripe Style */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[
             { label: 'Available Balance', value: '12,450.00 KWD', trend: '+2.4%', icon: Wallet },
             { label: 'Pending Settlement', value: '4,120.00 KWD', trend: 'Active', icon: Clock },
             { label: 'Success Velocity', value: '99.8%', trend: '+0.1%', icon: Activity },
             { label: 'Instructions', value: batches.length, trend: 'Today', icon: FileText },
           ].map((kpi, i) => (
             <motion.div 
               key={i} 
               initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: i * 0.05 }}
               className="stripe-surface p-6 group hover:border-stripe-blurple transition-all"
             >
                <div className="flex items-center justify-between mb-4">
                   <div className="w-9 h-9 bg-gray-50 border border-stripe-border rounded-lg flex items-center justify-center text-stripe-slate group-hover:text-stripe-blurple transition-colors">
                      <kpi.icon className="w-4.5 h-4.5" />
                   </div>
                   <div className="text-[10px] font-bold text-stripe-green bg-stripe-green/10 px-1.5 py-0.5 rounded uppercase">{kpi.trend}</div>
                </div>
                <p className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-widest mb-1">{kpi.label}</p>
                <p className="text-[22px] font-bold text-stripe-dark tracking-tight">{kpi.value}</p>
             </motion.div>
           ))}
        </div>

        {/* Payout List - High Fidelity Table Card */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="stripe-surface overflow-hidden shadow-stripe-lg"
        >
           <div className="px-10 py-6 border-b border-stripe-border flex items-center justify-between bg-white/60 backdrop-blur-md">
              <h3 className="text-[18px] font-bold text-stripe-dark">Settlement Queue</h3>
              <div className="flex items-center gap-4">
                 <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
                    <input placeholder="Search batch, entity or order..." className="stripe-input-field pl-10 h-10 w-72 bg-gray-50/50 border-transparent focus:bg-white" />
                 </div>
                 <button className="p-2.5 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all" onClick={() => queryClient.invalidateQueries({ queryKey: ['refund-batches'] })}>
                    <RefreshCw className="w-4 h-4" />
                 </button>
              </div>
           </div>
           
           <div className="overflow-x-auto">
              <table className="stripe-table">
                 <thead>
                    <tr>
                       <th>Settlement ID</th>
                       <th>Instruction Logic</th>
                       <th>Destination Identity</th>
                       <th className="text-right">Settlement Value</th>
                       <th className="text-right">Execution</th>
                    </tr>
                 </thead>
                 <tbody>
                    {batches.length === 0 ? (
                       <tr><td colSpan={5} className="py-28 text-center text-stripe-slate italic font-medium">No pending settlements in current cycle.</td></tr>
                    ) : batches.map((c: any, i: number) => (
                       <motion.tr 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: 0.2 + (i * 0.05) }}
                         key={c.id} 
                         className="group"
                       >
                          <td className="w-[180px]">
                             <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-stripe-dark">SET-{c.id.slice(0, 8)}</span>
                                <span className="text-[11px] text-stripe-light-slate font-bold uppercase tracking-wider">REF: {c.caseNumber}</span>
                             </div>
                          </td>
                          <td>
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-stripe-blurple/[0.03] border border-stripe-blurple/10 rounded-xl flex items-center justify-center text-stripe-blurple shrink-0 group-hover:scale-110 transition-transform">
                                   <CreditCard className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-[14px] font-bold text-stripe-dark uppercase">{c.refundMethod || 'Original Method'}</span>
                                   <div className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-stripe-green" />
                                      <span className="text-[11px] text-stripe-light-slate font-semibold uppercase">{c.country?.name} Gate</span>
                                   </div>
                                </div>
                             </div>
                          </td>
                          <td>
                             <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-stripe-dark">{c.customerName}</span>
                                <span className="text-[12px] text-stripe-light-slate font-medium truncate max-w-[200px]">{c.customerEmail}</span>
                             </div>
                          </td>
                          <td className="text-right">
                             <div className="flex flex-col items-end">
                                <span className="text-[16px] font-bold text-stripe-dark font-mono">{(c.partialAmount ?? c.orderAmount)?.toLocaleString()} <span className="text-[12px] font-semibold text-stripe-light-slate uppercase">{c.country?.currency}</span></span>
                                <div className="flex items-center gap-1 text-[10px] font-bold text-stripe-green">
                                   <TrendingUp className="w-2.5 h-2.5" />
                                   Verified
                                </div>
                             </div>
                          </td>
                          <td className="text-right">
                             <button 
                               onClick={() => settleCase.mutate(c.id)}
                               disabled={settleCase.isPending}
                               className="stripe-button stripe-button-primary h-9 px-6 text-[13px] bg-stripe-blurple hover:shadow-stripe-md active:scale-95"
                             >
                                {settleCase.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Initiate Payout"}
                             </button>
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
