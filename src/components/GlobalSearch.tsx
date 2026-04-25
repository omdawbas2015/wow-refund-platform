import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Ticket, ArrowRight, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search', query],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/search/global?q=${query}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    },
    enabled: query.length > 1,
    staleTime: 500
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (type: string, id: string) => {
    setIsOpen(false);
    setQuery('');
    if (type === 'CASE') {
      navigate(`/cases/${id}`);
    } else if (type === 'PROMO') {
      navigate('/promo/management');
    }
  };

  const resultsCount = (data?.cases?.length || 0) + (data?.promos?.length || 0);

  return (
    <div className="relative w-full max-w-[720px]" ref={menuRef}>
      <div className={cn(
        "relative flex items-center transition-all duration-200 rounded-full overflow-hidden",
        isFocused ? "bg-white shadow-[0_1px_1px_0_rgba(65,69,73,0.3),0_1px_3px_1px_rgba(65,69,73,0.15)] ring-1 ring-[#dadce0]" : "bg-[#f1f3f4] hover:bg-[#e8eaed]"
      )}>
        <button className="pl-4 pr-3 py-2 text-[#5f6368] hover:text-[#202124] transition-colors">
          <Search className="w-5 h-5" />
        </button>
        <Input
          placeholder="Search refunds, customers, IDs..."
          className="h-12 bg-transparent border-none focus-visible:ring-0 text-[16px] text-[#202124] placeholder:text-[#5f6368] font-body"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="px-4 text-[#5f6368] hover:text-[#202124]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && query.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute top-[calc(100%-8px)] left-0 right-0 bg-white shadow-[0_4px_6px_rgba(32,33,36,0.28)] rounded-b-[24px] overflow-hidden z-[100] border-t border-[#dadce0] pt-2"
          >
            {isLoading ? (
              <div className="p-8 flex items-center justify-center gap-3 text-[#5f6368]">
                <Loader2 className="w-5 h-5 animate-spin text-[#1a73e8]" />
                <span className="text-[14px] font-medium">Searching...</span>
              </div>
            ) : resultsCount === 0 ? (
              <div className="p-10 text-center">
                <p className="text-[14px] font-medium text-[#202124] mb-1">No results found</p>
                <p className="text-[12px] text-[#5f6368]">Check your spelling or try a different keyword.</p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto pb-4">
                {data.cases?.length > 0 && (
                  <div className="py-2">
                    <h3 className="px-6 py-2 text-[11px] font-medium uppercase tracking-wider text-[#5f6368]">Refund Cases</h3>
                    <div className="px-2">
                      {data.cases.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => handleSelect('CASE', c.id)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[#f1f3f4] transition-all text-left group"
                        >
                          <div className="flex items-center gap-4">
                            <FileText className="w-5 h-5 text-[#5f6368]" />
                            <div className="flex flex-col">
                              <span className="text-[14px] font-medium text-[#202124]">#{c.caseNumber}</span>
                              <span className="text-[12px] text-[#5f6368]">{c.customerName}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-[#e8f0fe] text-[#1a73e8] border-none text-[11px] font-medium px-2 py-0.5 rounded-full">{c.status}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {data.promos?.length > 0 && (
                  <div className="py-2">
                    <h3 className="px-6 py-2 text-[11px] font-medium uppercase tracking-wider text-[#5f6368]">Promo Codes</h3>
                    <div className="px-2">
                      {data.promos.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelect('PROMO', p.id)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-[#f1f3f4] transition-all text-left group"
                        >
                          <div className="flex items-center gap-4">
                            <Ticket className="w-5 h-5 text-[#5f6368]" />
                            <div className="flex flex-col">
                              <span className="text-[14px] font-mono font-medium text-[#202124]">{p.code}</span>
                              <span className="text-[12px] text-[#5f6368]">Case: {p.caseNumber || 'N/A'}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[11px] font-medium border-none px-2 py-0.5 rounded-full",
                            p.status === 'AVAILABLE' ? "bg-[#e6f4ea] text-[#1e8e3e]" : "bg-[#f1f3f4] text-[#5f6368]"
                          )}>{p.status}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="px-6 py-3 border-t border-[#f1f3f4] mt-2">
                   <p className="text-[11px] text-[#5f6368]">Press <span className="font-bold text-[#202124]">Enter</span> to see all results in a dedicated view</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

