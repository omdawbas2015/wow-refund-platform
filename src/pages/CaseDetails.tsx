import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  MoreHorizontal,
  Mail,
  History,
  ShieldCheck,
  CreditCard,
  User,
  ShoppingBag,
  Globe,
  Tag,
  ArrowRight,
  Zap,
  ChevronRight,
  Printer,
  Copy,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => api.get(`/api/cases/${id}`).then(res => res.data)
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/cases/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      toast.success('Status updated successfully');
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="relative">
         <div className="w-12 h-12 border-4 border-stripe-blurple/20 border-t-stripe-blurple rounded-full animate-spin" />
         <Zap className="absolute inset-0 m-auto w-4 h-4 text-stripe-blurple animate-pulse" />
      </div>
    </div>
  );
  if (!caseData) return <div className="p-12 text-center stripe-h2">Instruction not found</div>;

  const isApproved = caseData.status === 'APPROVED';
  const isRefunded = caseData.status === 'REFUNDED';

  return (
    <div className="max-w-[1300px] mx-auto py-12 px-8">
      {/* Breadcrumbs & Actions Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <div className="flex items-center gap-2 text-[12px] font-bold text-stripe-light-slate uppercase tracking-widest mb-3">
              <button onClick={() => navigate('/cases')} className="hover:text-stripe-blurple transition-colors flex items-center gap-1">
                 <ArrowLeft className="w-3.5 h-3.5" />
                 Refunds
              </button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-stripe-dark">{caseData.caseNumber}</span>
           </div>
           <div className="flex items-center gap-4">
              <h1 className="text-[32px] font-bold text-stripe-dark tracking-tight leading-none">{caseData.caseNumber}</h1>
              <div className={cn(
                 "stripe-badge text-[10px] py-1 px-3",
                 isRefunded ? "stripe-badge-success" :
                 isApproved ? "stripe-badge-info" : "stripe-badge-warning"
              )}>
                 {caseData.status?.replace('_', ' ')}
              </div>
           </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
           <button className="stripe-button stripe-button-secondary">
              <Printer className="w-4 h-4" />
              <span>Print</span>
           </button>
           <button className="stripe-button stripe-button-secondary">
              <Mail className="w-4 h-4" />
              <span>Contact</span>
           </button>
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <button className="stripe-button stripe-button-primary bg-stripe-dark hover:bg-stripe-dark/90">
                    <span>Manage</span>
                    <ChevronDown className="w-4 h-4" />
                 </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 shadow-stripe-lg border-stripe-border rounded-xl">
                 {!isApproved && !isRefunded && (
                    <DropdownMenuItem onClick={() => updateStatus.mutate('APPROVED')} className="text-[13px] py-2.5 px-4 rounded-lg cursor-pointer font-bold text-stripe-blurple hover:bg-stripe-blurple/5">Approve for payout</DropdownMenuItem>
                 )}
                 <DropdownMenuItem className="text-[13px] py-2.5 px-4 rounded-lg cursor-pointer font-semibold hover:bg-gray-50">Issue internal voucher</DropdownMenuItem>
                 <DropdownMenuItem className="text-[13px] py-2.5 px-4 rounded-lg cursor-pointer font-semibold hover:bg-gray-50">Add internal note</DropdownMenuItem>
                 <div className="my-2 border-t border-stripe-border" />
                 <DropdownMenuItem className="text-[13px] py-2.5 px-4 rounded-lg cursor-pointer font-bold text-stripe-error hover:bg-red-50">Reject & Close</DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Detailed Content Area */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* Summary Section - High Fidelity */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="stripe-surface p-10 relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-stripe-blurple/[0.03] rounded-bl-full pointer-events-none" />
             <h3 className="stripe-label mb-10">Payment Details</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                   <div className="group">
                      <label className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-[0.1em] block mb-3">Customer Entity</label>
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50 border border-stripe-border transition-all group-hover:bg-white group-hover:shadow-stripe-sm">
                         <div className="w-12 h-12 rounded-full bg-white border border-stripe-border shadow-sm flex items-center justify-center text-stripe-blurple font-bold text-[14px]">
                            {caseData.customerName?.charAt(0)}
                         </div>
                         <div className="flex flex-col min-w-0">
                            <p className="text-[15px] font-bold text-stripe-dark truncate">{caseData.customerName}</p>
                            <div className="flex items-center gap-2">
                               <p className="text-[13px] text-stripe-slate truncate">{caseData.customerEmail}</p>
                               <button className="p-1 hover:text-stripe-blurple opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-3 h-3" /></button>
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   <div>
                      <label className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-[0.1em] block mb-3">Instruction Manifest</label>
                      <div className="p-5 rounded-xl bg-gray-50/50 border border-stripe-border border-dashed">
                         <p className="text-[14px] text-stripe-dark leading-relaxed font-medium italic">"{caseData.refundReason}"</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="group">
                      <label className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-[0.1em] block mb-3">Associated Order</label>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-stripe-border shadow-stripe-sm group-hover:border-stripe-blurple transition-all">
                         <div className="flex items-center gap-3">
                            <ShoppingBag className="w-5 h-5 text-stripe-blurple" />
                            <span className="text-[15px] font-bold text-stripe-dark">#{caseData.orderNumber}</span>
                         </div>
                         <ExternalLink className="w-4 h-4 text-stripe-light-slate group-hover:text-stripe-blurple transition-colors" />
                      </div>
                   </div>

                   <div>
                      <label className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-[0.1em] block mb-3">Regional Governance</label>
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-lg bg-gray-100 border border-stripe-border flex items-center justify-center text-stripe-slate">
                            <Globe className="w-5 h-5" />
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[14px] font-bold text-stripe-dark">{caseData.country?.name}</span>
                            <span className="text-[12px] text-stripe-light-slate font-semibold uppercase tracking-wider">{caseData.country?.code} Operations</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>

          {/* Activity Timeline - Modern Stripe Style */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stripe-surface overflow-hidden"
          >
             <div className="px-10 py-6 border-b border-stripe-border bg-gray-50/30 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-stripe-dark uppercase tracking-wider">Audit & History</h3>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-stripe-border rounded-lg text-[11px] font-bold text-stripe-slate">
                   <Clock className="w-3.5 h-3.5" />
                   Real-time
                </div>
             </div>
             <div className="p-10 space-y-10">
                {(caseData.logs || []).map((log: any, i: number) => (
                   <div key={i} className="flex gap-8 relative group">
                      {i !== (caseData.logs.length - 1) && (
                         <div className="absolute left-[13px] top-8 bottom-[-40px] w-0.5 bg-stripe-border group-hover:bg-stripe-blurple/20 transition-colors" />
                      )}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white shadow-sm ring-4 ring-gray-50/50",
                        log.actionType.includes('CREATED') ? "bg-stripe-blurple text-white" : "bg-white border-stripe-border text-stripe-slate"
                      )}>
                         {log.actionType.includes('CREATED') ? <Zap className="w-3.5 h-3.5 fill-white" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-baseline mb-2">
                            <p className="text-[15px] font-bold text-stripe-dark group-hover:text-stripe-blurple transition-colors">{log.actionType.replace(/_/g, ' ')}</p>
                            <span className="text-[12px] font-semibold text-stripe-light-slate">{format(new Date(log.timestamp), 'MMM d, h:mm a')}</span>
                         </div>
                         <p className="text-[14px] text-stripe-slate leading-relaxed mb-3">{log.description}</p>
                         <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-gray-100/50 border border-stripe-border">
                               <div className="w-4 h-4 rounded bg-white border border-stripe-border flex items-center justify-center text-[8px] font-bold text-stripe-blurple">{log.actorName?.charAt(0)}</div>
                               <span className="text-[11px] font-bold text-stripe-dark uppercase">{log.actorName}</span>
                            </div>
                            <div className="text-[10px] font-bold text-stripe-light-slate uppercase tracking-widest">Internal Op</div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </motion.div>
        </div>

        {/* Dynamic Sidebar - High Impact Financial Summary */}
        <div className="lg:col-span-4 space-y-10">
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.2 }}
             className="stripe-surface p-10 bg-[#0a2540] text-white border-none shadow-stripe-lg relative overflow-hidden group"
           >
              {/* Dynamic Living Gradients */}
              <motion.div 
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-[50%] -right-[50%] w-[200%] h-[200%] bg-gradient-to-br from-stripe-blurple/30 via-transparent to-transparent opacity-40 blur-[80px]" 
              />
              
              <div className="relative z-10">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.15em]">Liquidity Impact</h3>
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10 group-hover:scale-110 transition-transform">
                       <CreditCard className="w-5 h-5 text-white" />
                    </div>
                 </div>
                 
                 <div className="space-y-8">
                    <div>
                       <p className="text-[14px] text-white/70 font-medium mb-1">Settlement Value</p>
                       <p className="text-[40px] font-bold tracking-tighter leading-none">
                          {(caseData.partialAmount ?? caseData.orderAmount)?.toLocaleString()} 
                          <span className="text-[18px] text-white/40 font-normal ml-2">{caseData.country?.currency}</span>
                       </p>
                    </div>
                    
                    <div className="pt-8 border-t border-white/10 space-y-4">
                       <div className="flex justify-between text-[14px]">
                          <span className="text-white/60">Operational risk</span>
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-stripe-green" />
                             <span className="font-bold text-stripe-green">Low</span>
                          </div>
                       </div>
                       <div className="flex justify-between text-[14px]">
                          <span className="text-white/60">Expected settlement</span>
                          <span className="font-bold">Immediate</span>
                       </div>
                    </div>
                 </div>
              </div>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.3 }}
             className="stripe-surface p-8 space-y-8"
           >
              <h4 className="text-[12px] font-bold text-stripe-dark uppercase tracking-widest flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-stripe-blurple" />
                 Compliance Check
              </h4>
              <div className="space-y-6">
                 <div className="flex items-center justify-between text-[14px]">
                    <span className="text-stripe-light-slate font-medium">Fulfillment Node</span>
                    <span className="font-bold text-stripe-dark">{caseData.branch?.name || 'Central Distribution'}</span>
                 </div>
                 <div className="flex items-center justify-between text-[14px]">
                    <span className="text-stripe-light-slate font-medium">Funding Source</span>
                    <div className="flex items-center gap-2">
                       <span className="font-bold text-stripe-dark uppercase">{caseData.refundMethod || 'Original payment'}</span>
                       <div className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-bold border border-stripe-border">VERIFIED</div>
                    </div>
                 </div>
              </div>
              <div className="pt-8 border-t border-stripe-border">
                 <button className="stripe-button stripe-button-secondary w-full justify-between group">
                    <span>Export audit report</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                 </button>
              </div>
           </motion.div>
        </div>
      </div>
    </div>
  );
}
