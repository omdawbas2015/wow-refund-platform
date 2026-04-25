import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  MoreHorizontal,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Globe,
  Settings2,
  Columns,
  ArrowUpRight,
  Command,
  Zap
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function CaseList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const { data: cases, isLoading, refetch } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.get('/api/cases').then((r) => r.data),
    refetchInterval: 60000,
  });

  const filteredCases = useMemo(() => {
    if (!Array.isArray(cases)) return [];
    return cases.filter((c: any) => {
      const search = searchTerm.toLowerCase();
      return (
        !search ||
        c.caseNumber?.toLowerCase().includes(search) ||
        c.customerName?.toLowerCase().includes(search) ||
        c.orderNumber?.toLowerCase().includes(search)
      );
    });
  }, [cases, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const paginatedCases = filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-stripe-blurple animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-2 text-[12px] font-bold text-stripe-light-slate uppercase tracking-widest mb-2">
             <Zap className="w-3 h-3 text-stripe-blurple fill-stripe-blurple" />
             <span>Payments</span>
             <ChevronRight className="w-3 h-3" />
             <span className="text-stripe-blurple">Refunds</span>
          </div>
          <h1 className="stripe-h1">Transactions</h1>
          <p className="text-[16px] text-stripe-slate">Explore and manage all refund instructions across regions.</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
           <button className="stripe-button stripe-button-secondary">
              <Download className="w-4 h-4" />
              <span>Export</span>
           </button>
           <button 
             className="stripe-button stripe-button-primary"
             onClick={() => navigate('/cases/new')}
           >
              <Plus className="w-4 h-4" /> 
              <span>Create refund</span>
           </button>
        </motion.div>
      </div>

      {/* Main Table Card with Glassmorphism Toolbar */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="stripe-surface overflow-hidden shadow-stripe-lg"
      >
        {/* Toolbar - Stripe Glass Look */}
        <div className="px-8 py-5 border-b border-stripe-border flex flex-wrap items-center justify-between gap-6 bg-white/60 backdrop-blur-md sticky top-0 z-20">
           <div className="flex flex-1 items-center gap-4">
              <div className="relative max-w-sm w-full group">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
                 <input 
                   placeholder="Filter by case, name or order..." 
                   className="stripe-input-field pl-10 h-10 border-transparent bg-gray-50/50 focus:bg-white transition-all"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 border border-stripe-border rounded text-[10px] font-bold text-stripe-light-slate bg-white">
                    <Command className="w-2.5 h-2.5" />
                    F
                 </div>
              </div>
              <button className="stripe-button stripe-button-secondary h-10 px-4 text-[13px]">
                 <Filter className="w-4 h-4" />
                 <span>Add filters</span>
              </button>
           </div>
           
           <div className="flex items-center gap-2">
              <button className="p-2.5 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all" title="Reload" onClick={() => refetch()}>
                 <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-2.5 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all" title="Columns">
                 <Columns className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-stripe-border mx-1" />
              <button className="p-2.5 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all">
                 <Settings2 className="w-4 h-4" />
              </button>
           </div>
        </div>

        {/* Dense Stripe Table */}
        <div className="overflow-x-auto">
          <table className="stripe-table">
            <thead>
              <tr>
                <th className="w-12">
                   <Checkbox 
                     checked={paginatedCases.length > 0 && selectedIds.length === paginatedCases.length} 
                     onCheckedChange={(checked) => setSelectedIds(checked ? paginatedCases.map((c:any) => c.id) : [])} 
                   />
                </th>
                <th>Reference</th>
                <th>Customer Identity</th>
                <th>Region</th>
                <th className="text-right">Net Amount</th>
                <th className="text-center">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {paginatedCases.map((c: any, i: number) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                    key={c.id} 
                    className={cn(selectedIds.includes(c.id) && "bg-stripe-blurple/[0.03]", "cursor-pointer group relative")}
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedIds.includes(c.id)} 
                        onCheckedChange={() => setSelectedIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} 
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                         <span className="text-[14px] font-bold text-stripe-blurple hover:underline">{c.caseNumber}</span>
                         <ArrowUpRight className="w-3.5 h-3.5 text-stripe-blurple opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-stripe-slate font-bold text-[10px] border border-stripe-border">
                            {c.customerName?.charAt(0)}
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[14px] font-bold text-stripe-dark">{c.customerName}</span>
                            <span className="text-[12px] text-stripe-light-slate font-medium">{c.customerEmail}</span>
                         </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-gray-50 border border-stripe-border self-start">
                         <Globe className="w-3.5 h-3.5 text-stripe-light-slate" />
                         <span className="text-[12px] text-stripe-dark font-bold">{c.country?.code}</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className="text-[15px] font-bold text-stripe-dark font-mono">
                        {(c.partialAmount ?? c.orderAmount)?.toLocaleString()} <span className="text-[12px] font-semibold text-stripe-light-slate uppercase">{c.country?.currency}</span>
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center">
                         <div className={cn(
                           "stripe-badge",
                           c.status === 'REFUNDED' ? "stripe-badge-success" :
                           c.status === 'PENDING_APPROVAL' ? "stripe-badge-warning" :
                           "stripe-badge-info"
                         )}>
                           {c.status?.replace('_', ' ')}
                         </div>
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-gray-100 rounded-xl text-stripe-slate transition-all group-hover:scale-110">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 shadow-stripe-lg border-stripe-border rounded-xl">
                          <DropdownMenuItem onClick={() => navigate(`/cases/${c.id}`)} className="text-[13px] py-2 px-3 rounded-md font-medium cursor-pointer hover:bg-gray-50">View case details</DropdownMenuItem>
                          <DropdownMenuItem className="text-[13px] py-2 px-3 rounded-md font-medium cursor-pointer hover:bg-gray-50">Edit metadata</DropdownMenuItem>
                          <DropdownMenuItem className="text-[13px] py-2 px-3 rounded-md font-bold cursor-pointer hover:bg-red-50 text-stripe-error">Close case</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Premium Pagination */}
        <div className="px-8 py-5 border-t border-stripe-border flex items-center justify-between bg-gray-50/20 backdrop-blur-sm">
          <div className="text-[13px] text-stripe-light-slate font-semibold">
            Showing <span className="text-stripe-dark font-bold">{Math.min(filteredCases.length, (page - 1) * PAGE_SIZE + 1)}–{Math.min(filteredCases.length, page * PAGE_SIZE)}</span> of <span className="text-stripe-dark font-bold">{filteredCases.length}</span> instructions
          </div>
          <div className="flex items-center gap-3">
             <button 
               disabled={page === 1} 
               onClick={() => setPage(p => p - 1)} 
               className="stripe-button stripe-button-secondary h-9 px-3 disabled:opacity-30"
             >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
             </button>
             <div className="flex items-center gap-1.5">
                {[...Array(Math.min(5, totalPages))].map((_, i) => (
                   <button 
                     key={i} 
                     onClick={() => setPage(i + 1)}
                     className={cn(
                       "w-9 h-9 rounded-xl text-[13px] font-bold transition-all",
                       page === i + 1 ? "bg-stripe-blurple text-white shadow-stripe-md scale-105" : "text-stripe-slate hover:bg-gray-100 hover:text-stripe-dark"
                     )}
                   >
                     {i + 1}
                   </button>
                ))}
             </div>
             <button 
               disabled={page === totalPages} 
               onClick={() => setPage(p => p + 1)} 
               className="stripe-button stripe-button-secondary h-9 px-3 disabled:opacity-30"
             >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
             </button>
          </div>
        </div>
        </motion.div>
    </div>
  );
}
