import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  LifeBuoy, Send, CheckCircle2, Clock, Mail, Hash,
  MessageSquare, User as UserIcon, RefreshCw, Info,
  ChevronRight, Search, Filter, AlertCircle,
  Settings2, Download, Building2, Ticket
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/exportUtils';

const HELP_DESK_REASONS = [
  { id: 'no_asset', label: 'MISSING ASSET ID', desc: 'Missing Asset ID on reported case' },
  { id: 'not_in_scope', label: 'OUT OF SCOPE', desc: 'Case falls outside operational boundaries' },
  { id: 'no_desc', label: 'INSUFFICIENT DESCRIPTION', desc: 'Insufficient information provided for investigation' },
  { id: 'leakage', label: 'REASON OF LEAKAGE', desc: 'Potential operational leakage identified' },
];

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function HelpDesk() {
  const [caseNumber, setCaseNumber] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'dispatch' | 'history'>('dispatch');

  const submitMutation = useMutation({
    mutationFn: async (data: { caseNumber: string; storeEmail: string; reason: string }) => {
      const response = await api.post('/api/help-desk/submit', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Support ticket dispatched successfully');
      setCaseNumber(''); setStoreEmail(''); setReason('');
      refetchHistory();
    },
    onError: (err: any) => { toast.error(err.response?.data?.error || 'Dispatch failed'); }
  });

  const { data: history, refetch: refetchHistory, isLoading } = useQuery({
    queryKey: ['help-desk-history'],
    queryFn: async () => {
      const response = await api.get('/api/help-desk/history');
      return response.data;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber || !storeEmail || !reason) { toast.error('Please complete all fields'); return; }
    submitMutation.mutate({ caseNumber, storeEmail, reason });
  };

  const filteredHistory = useMemo(() => {
    if (!history?.data) return [];
    return history.data.filter((ticket: any) => {
      const s = searchTerm.toLowerCase();
      return !s || 
        ticket.caseNumber?.toLowerCase().includes(s) || 
        ticket.storeEmail?.toLowerCase().includes(s) || 
        ticket.reason?.toLowerCase().includes(s);
    });
  }, [history, searchTerm]);

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <div className="flex items-center gap-2 text-[12px] font-bold text-stripe-light-slate uppercase tracking-widest mb-2">
              <LifeBuoy className="w-3.5 h-3.5 text-stripe-blurple" />
              <span>Help Desk</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-stripe-blurple">Ticketing</span>
           </div>
           <h1 className="stripe-h1">Support Ticketing</h1>
           <p className="text-[16px] text-stripe-slate max-w-2xl mt-2">
             Dispatch formal support tickets for cases missing context, assets, or falling out of standard SLA scope.
           </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
           <button 
             onClick={() => setActiveTab('history')}
             className={cn("stripe-button stripe-button-secondary bg-white", activeTab === 'history' && "ring-1 ring-stripe-blurple")}
           >
              <Search className="w-4 h-4" />
              <span>Ticket Logs</span>
           </button>
           <button 
             onClick={() => setActiveTab('dispatch')}
             className={cn("stripe-button stripe-button-primary", activeTab === 'dispatch' && "opacity-90")}
           >
              <Ticket className="w-4 h-4" /> 
              <span>New Ticket</span>
           </button>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dispatch' ? (
          <motion.div 
            key="dispatch"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Left Pane: Dispatch Form */}
            <div className="lg:col-span-5 flex flex-col">
               <div className="stripe-surface overflow-hidden shadow-stripe-lg h-full">
                  <div className="p-6 border-b border-stripe-border bg-white/60 backdrop-blur-md">
                     <h2 className="text-[18px] font-bold text-stripe-dark flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-stripe-blurple" /> Create Ticket
                     </h2>
                  </div>
                  
                  <div className="p-8 bg-gray-50/20">
                     <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                           <label className="stripe-label">Source Case Identifier</label>
                           <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate" />
                              <input 
                                placeholder="e.g. RC-KW-1001" 
                                value={caseNumber} 
                                onChange={e => setCaseNumber(e.target.value)} 
                                className="stripe-input-field pl-10"
                              />
                           </div>
                        </div>
                        
                        <div className="space-y-2">
                           <label className="stripe-label">Target Enterprise Email</label>
                           <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate" />
                              <input 
                                type="email" 
                                placeholder="store-id@alshaya.com" 
                                value={storeEmail} 
                                onChange={e => setStoreEmail(e.target.value)} 
                                className="stripe-input-field pl-10"
                              />
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="stripe-label">Support Classification</label>
                           <select 
                             value={reason} 
                             onChange={e => setReason(e.target.value)}
                             className="stripe-input-field text-[14px]"
                           >
                              <option value="">Select issue category...</option>
                              {HELP_DESK_REASONS.map(r => (
                                <option key={r.id} value={r.label}>{r.label}</option>
                              ))}
                           </select>
                           {reason && (
                              <p className="text-[12px] text-stripe-slate mt-2 flex items-center gap-1.5 p-2 bg-[#f6f9fc] rounded-md border border-stripe-border">
                                 <Info className="w-3.5 h-3.5 text-stripe-blurple" />
                                 {HELP_DESK_REASONS.find(r => r.label === reason)?.desc}
                              </p>
                           )}
                        </div>

                        <button 
                          type="submit" 
                          disabled={submitMutation.isPending} 
                          className="stripe-button stripe-button-primary w-full h-11 bg-stripe-dark hover:bg-black mt-4 shadow-stripe-lg"
                        >
                           {submitMutation.isPending ? (
                              <div className="flex items-center gap-2">
                                 <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                 <span>Processing...</span>
                              </div>
                           ) : (
                              <div className="flex items-center gap-2">
                                 <Send className="w-4 h-4" />
                                 <span>Dispatch Ticket</span>
                              </div>
                           )}
                        </button>
                     </form>
                  </div>
               </div>
            </div>

            {/* Right Pane: Live Queue */}
            <div className="lg:col-span-7 flex flex-col">
               <div className="stripe-surface overflow-hidden shadow-stripe-lg h-full flex flex-col">
                  <div className="p-5 border-b border-stripe-border flex items-center justify-between bg-white shrink-0">
                     <h3 className="text-[14px] font-bold text-stripe-dark flex items-center gap-2">
                        <Clock className="w-4 h-4 text-stripe-light-slate" /> Recent Dispatches
                     </h3>
                     <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-wider">Syncing</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-stripe-green animate-pulse" />
                     </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f6f9fc]/50">
                     {history?.data?.slice(0, 8).map((ticket: any, idx: number) => (
                       <motion.div 
                         initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                         key={ticket.id} 
                         className="p-4 bg-white rounded-xl border border-stripe-border hover:shadow-stripe-md transition-all group cursor-default flex items-center justify-between"
                       >
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-lg bg-stripe-bg flex items-center justify-center text-stripe-slate border border-stripe-border group-hover:border-stripe-blurple/30 group-hover:bg-stripe-blurple/5 transition-colors">
                                <Ticket className="w-4 h-4 group-hover:text-stripe-blurple" />
                             </div>
                             <div>
                                <div className="flex items-center gap-2 mb-1">
                                   <span className="text-[14px] font-bold text-stripe-dark font-mono">{ticket.caseNumber}</span>
                                   <span className="stripe-badge stripe-badge-gray text-[10px]">{ticket.reason}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[12px] text-stripe-slate">
                                   <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {ticket.submittedBy}</span>
                                   <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(ticket.createdAt), 'HH:mm')}</span>
                                </div>
                             </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-stripe-light-slate opacity-0 group-hover:opacity-100 group-hover:text-stripe-blurple transition-all -translate-x-2 group-hover:translate-x-0" />
                       </motion.div>
                     ))}
                     {(!history?.data || history.data.length === 0) && (
                       <div className="py-20 text-center">
                          <LifeBuoy className="w-8 h-8 mx-auto mb-3 text-stripe-light-slate opacity-50" />
                          <p className="text-[14px] font-bold text-stripe-slate">No recent tickets</p>
                          <p className="text-[13px] text-stripe-light-slate">Dispatched items will appear here in real-time.</p>
                       </div>
                     )}
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="stripe-surface overflow-hidden shadow-stripe-lg"
          >
             <div className="px-8 py-5 border-b border-stripe-border flex flex-wrap items-center justify-between gap-6 bg-white/60 backdrop-blur-md sticky top-0 z-20">
                <div className="flex flex-1 items-center gap-4">
                   <div className="relative max-w-sm w-full group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
                      <input 
                        placeholder="Search logs by case or email..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="stripe-input-field pl-10 h-10 border-transparent bg-gray-50/50 focus:bg-white transition-all"
                      />
                   </div>
                   <button className="stripe-button stripe-button-secondary h-10 px-4 text-[13px] bg-white">
                      <Filter className="w-4 h-4" />
                      <span>Filters</span>
                   </button>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => exportToExcel(filteredHistory, [], 'Support_History')} className="stripe-button stripe-button-secondary bg-white text-[13px] h-10">
                      <Download className="w-4 h-4" /> Export CSV
                   </button>
                </div>
             </div>
             
             <div className="overflow-x-auto">
                <table className="stripe-table">
                   <thead>
                      <tr>
                         <th>Timestamp</th>
                         <th>Case ID</th>
                         <th>Target Destination</th>
                         <th>Classification</th>
                         <th className="text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody>
                      {filteredHistory.map((ticket: any, i: number) => (
                         <motion.tr 
                           initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                           key={ticket.id}
                           className="group hover:bg-[#f6f9fc] transition-colors"
                         >
                            <td>
                               <div className="flex flex-col">
                                  <span className="text-[14px] font-bold text-stripe-dark">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
                                  <span className="text-[12px] text-stripe-light-slate font-medium">{format(new Date(ticket.createdAt), 'HH:mm:ss')}</span>
                               </div>
                            </td>
                            <td><span className="text-[14px] font-bold text-stripe-dark font-mono">{ticket.caseNumber}</span></td>
                            <td><span className="text-[13px] text-stripe-slate font-medium">{ticket.storeEmail}</span></td>
                            <td><div className="stripe-badge stripe-badge-gray uppercase">{ticket.reason}</div></td>
                            <td className="text-center">
                               <div className="flex justify-center">
                                  <div className="stripe-badge stripe-badge-success">
                                     <CheckCircle2 className="w-3 h-3 mr-1" />
                                     Dispatched
                                  </div>
                               </div>
                            </td>
                         </motion.tr>
                      ))}
                      {filteredHistory.length === 0 && (
                         <tr>
                            <td colSpan={5} className="text-center py-12 text-stripe-slate">
                               No ticket logs found matching your criteria.
                            </td>
                         </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
