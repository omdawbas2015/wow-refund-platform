import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  ShoppingBag, 
  Copy, 
  RefreshCw,
  ChevronRight,
  Database,
  Command
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function PromoRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const isInternalRoute = location.pathname.includes('/internal');
  
  const [caseNumber, setCaseNumber] = useState(location.state?.caseNumber || '');
  const [lastSearched, setLastSearched] = useState('');
  
  const [countryId, setCountryId] = useState('');
  const [promoType, setPromoType] = useState(isInternalRoute ? 'INTERNAL_100' : 'COMPENSATION');
  const [promoValue, setPromoValue] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState('');
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDuplicateConfirmOpen, setIsDuplicateConfirmOpen] = useState(false);
  const [isSearchingCase, setIsSearchingCase] = useState(false);
  const [caseFoundStats, setCaseFoundStats] = useState<any>(null);
  const [successData, setSuccessData] = useState<any>(null);
  
  const [orderNumber, setOrderNumber] = useState('');
  const [brandId, setBrandId] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<'ISSUE' | 'HISTORY'>('ISSUE');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const { data: metaData } = useQuery({
    queryKey: ['metadata'],
    queryFn: () => api.get('/api/metadata').then(r => r.data)
  });

  const { data: inventoryData = null } = useQuery({
    queryKey: ['promoInventory', countryId, promoValue, promoType, brandId],
    queryFn: async () => {
      const finalPromoValue = promoType === 'INTERNAL_100' ? '100' : promoValue;
      if (!countryId || !finalPromoValue) return null;
      const response = await api.get(`/api/promo/inventory?countryId=${countryId}&value=${finalPromoValue}&type=${promoType}${brandId ? `&brandId=${brandId}` : ''}`);
      return response.data;
    },
    enabled: !!countryId && (!!promoValue || promoType === 'INTERNAL_100')
  });

  const { data: dynamicPromoValues, isLoading: loadingDynamicValues } = useQuery({
    queryKey: ['promoValues', countryId, promoType, brandId],
    queryFn: async () => {
      if (!countryId) return { values: [], currency: '' };
      const response = await api.get(`/api/promo/values?countryId=${countryId}&type=${promoType}${brandId ? `&brandId=${brandId}` : ''}`);
      if (!response.data || response.data.length === 0) return { values: [], currency: '' };
      const values = response.data.map((d: any) => d.value);
      if (values.length === 1 && promoValue === '') setPromoValue(values[0].toString());
      return { values, currency: response.data[0].currency };
    },
    enabled: !!countryId
  });
  
  const { data: ledgerData, isLoading: loadingLedger } = useQuery({
    queryKey: ['promoLedger', promoType],
    queryFn: () => api.get(`/api/promo/ledger?type=${promoType}`).then(r => r.data),
    enabled: activeMainTab === 'HISTORY'
  });

  useEffect(() => {
    const handler = setTimeout(async () => {
      const trimmedCase = caseNumber.trim();
      if (trimmedCase.length > 3 && trimmedCase !== lastSearched) {
        setLastSearched(trimmedCase);
        setIsSearchingCase(true);
        try {
          const res = await api.get(`/api/cases/search?caseNumber=${trimmedCase}`);
          if (res.data) {
            setCountryId(res.data.countryId);
            setCustomerEmail(res.data.customerEmail);
            setCustomerName(res.data.customerName);
            setOrderNumber(res.data.orderNumber || '');
            setBrandId(res.data.brandId || '');
            setCaseFoundStats(res.data);
          }
        } catch (e) {
          setCaseFoundStats(null);
        } finally {
          setIsSearchingCase(false);
        }
      } 
    }, 600);
    return () => clearTimeout(handler);
  }, [caseNumber, lastSearched, promoType]);

  const submitMutation = useMutation({
    mutationFn: async (vars?: { force?: boolean }) => {
      const finalPromoValue = promoType === 'INTERNAL_100' ? 100 : Number(promoValue);
      const payload = {
        caseNumber: caseNumber.trim(),
        orderNumber: orderNumber.trim(),
        countryId,
        brandId: brandId || undefined,
        promoType,
        promoValue: finalPromoValue,
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim(),
        reason: reason.trim(),
        forceDuplicate: vars?.force === true
      };
      return api.post('/api/promo/request', payload).then(r => r.data);
    },
    onSuccess: (data) => {
      setSuccessData(data);
      setIsConfirmOpen(false);
      setIsDuplicateConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['promoInventory'] });
      queryClient.invalidateQueries({ queryKey: ['promoLedger'] });
      toast.success('Resource allocated successfully');
    },
    onError: (error: any) => {
      if (error.response?.status === 409) setIsDuplicateConfirmOpen(true);
      else toast.error(error.response?.data?.error || 'Allocation failed');
    }
  });

  const filteredLedger = ledgerData?.filter((item: any) => {
    const s = historySearchTerm.toLowerCase();
    return item.promoCode.code.toLowerCase().includes(s) || 
           item.caseNumber.toLowerCase().includes(s) || 
           item.usedBy.toLowerCase().includes(s);
  });

  const isFormValid = caseNumber.length > 5 && countryId && (promoValue || promoType === 'INTERNAL_100') && customerEmail && customerName;

  if (successData) {
    return (
      <div className="max-w-[600px] mx-auto py-12 px-6">
        <div className="stripe-surface overflow-hidden shadow-sm border border-stripe-border">
          <div className="bg-[#f6f9fc] p-6 text-center border-b border-stripe-border">
             <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-[#1e874b]" />
             <h2 className="text-[20px] font-bold text-stripe-dark tracking-tight">Allocation Successful</h2>
             <p className="text-[13px] text-stripe-slate mt-1 font-medium">Resource transmitted for case {caseNumber}</p>
          </div>
          <div className="p-6 space-y-6 bg-white">
            <div className="bg-[#f8fafc] border border-stripe-border rounded-[4px] p-6 text-center">
               <span className="text-[11px] font-bold uppercase text-stripe-light-slate tracking-wide mb-2 block">Voucher Code</span>
               <div className="flex items-center justify-center gap-4">
                  <span className="text-[28px] font-bold text-stripe-dark tracking-tighter font-mono">{successData.code}</span>
                  <button 
                    className="w-8 h-8 flex items-center justify-center bg-white border border-stripe-border rounded-[4px] text-stripe-slate hover:bg-gray-50 transition-colors shadow-sm" 
                    onClick={() => { navigator.clipboard.writeText(successData.code); toast.success('Copied'); }}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
               </div>
            </div>
            <div className="flex gap-3">
               <button className="stripe-button stripe-button-secondary flex-1" onClick={() => navigate('/')}>Dashboard</button>
               <button className="stripe-button stripe-button-primary flex-1" onClick={() => setSuccessData(null)}>Issue Another</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-semibold text-stripe-blurple">
                 {isInternalRoute ? "Internal Governance" : "Customer Retention"}
              </span>
           </div>
           <h1 className="stripe-h1">{isInternalRoute ? "Admin Compensation" : "Retention Rewards"}</h1>
        </div>
        
        <div className="flex bg-[#f6f9fc] p-1 rounded-md border border-stripe-border">
           <button 
             onClick={() => setActiveMainTab('ISSUE')}
             className={cn("px-4 py-1.5 text-[13px] font-medium rounded transition-colors", activeMainTab === 'ISSUE' ? "bg-white text-stripe-dark shadow-sm border border-stripe-border" : "text-stripe-slate hover:text-stripe-dark")}
           >Issue Resource</button>
           <button 
             onClick={() => setActiveMainTab('HISTORY')}
             className={cn("px-4 py-1.5 text-[13px] font-medium rounded transition-colors", activeMainTab === 'HISTORY' ? "bg-white text-stripe-dark shadow-sm border border-stripe-border" : "text-stripe-slate hover:text-stripe-dark")}
           >Audit Trail</button>
        </div>
      </div>

      {activeMainTab === 'HISTORY' ? (
        <div className="stripe-surface overflow-hidden">
           <div className="px-5 py-4 border-b border-stripe-border flex items-center justify-between bg-white">
              <div className="relative w-[300px]">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stripe-light-slate" />
                 <input 
                   placeholder="Search codes..." 
                   className="stripe-input-field pl-8"
                   value={historySearchTerm}
                   onChange={(e) => setHistorySearchTerm(e.target.value)}
                 />
              </div>
              <button className="p-1.5 hover:bg-[#f6f9fc] rounded text-stripe-slate transition-colors" onClick={() => queryClient.invalidateQueries({ queryKey: ['promoLedger'] })}>
                 <RefreshCw className="w-3.5 h-3.5" />
              </button>
           </div>
           <table className="stripe-table">
              <thead>
                <tr>
                  <th>Resource Code</th>
                  <th>Audit Case</th>
                  <th>Issuance Date</th>
                  <th>Authorized By</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {loadingLedger ? (
                  <tr><td colSpan={5} className="py-12 text-center text-stripe-slate text-[13px]">Loading ledger...</td></tr>
                ) : filteredLedger?.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-stripe-slate text-[13px]">No records found</td></tr>
                ) : filteredLedger?.map((item: any) => (
                  <tr key={item.id}>
                    <td><span className="font-semibold text-stripe-dark font-mono">{item.promoCode.code}</span></td>
                    <td>{item.caseNumber}</td>
                    <td>{format(new Date(item.usedAt), 'MMM d, yyyy HH:mm')}</td>
                    <td>{item.usedBy}</td>
                    <td className="text-right font-mono font-medium">{item.promoCode.value} <span className="text-[11px] text-stripe-light-slate uppercase">{item.promoCode.currency}</span></td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="stripe-surface p-6">
              <h3 className="text-[14px] font-bold text-stripe-dark mb-4 pb-4 border-b border-stripe-border">Configuration Parameters</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="stripe-label">Investigation Reference</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stripe-light-slate" />
                    <input 
                      placeholder="Enter case number" 
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      className="stripe-input-field pl-8 pr-12"
                    />
                    {isSearchingCase && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stripe-blurple animate-spin" />}
                  </div>
                </div>

                <div>
                  <label className="stripe-label">Operational Market</label>
                  <Select value={countryId} onValueChange={setCountryId} disabled={!!caseFoundStats}>
                    <SelectTrigger className="h-8 border-stripe-border rounded-[4px] shadow-sm text-[13px] focus:ring-1 focus:ring-stripe-blurple/20">
                      <SelectValue placeholder="Select Sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {metaData?.countries?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {caseFoundStats && (
                <div className="bg-[#f8fafc] border border-stripe-border p-4 rounded-[4px] mb-5">
                   <div className="flex items-center justify-between pb-3 border-b border-stripe-border mb-3">
                      <div className="flex items-center gap-3">
                         <ShoppingBag className="w-4 h-4 text-stripe-slate" />
                         <div>
                            <p className="text-[11px] text-stripe-light-slate uppercase font-bold">Origin Entity</p>
                            <p className="text-[13px] font-semibold text-stripe-dark">#{caseFoundStats.orderNumber}</p>
                         </div>
                      </div>
                      <div className={cn("stripe-badge", caseFoundStats.riskLevel === 'HIGH' ? "stripe-badge-error" : "stripe-badge-success")}>
                         RISK: {caseFoundStats.riskLevel}
                      </div>
                   </div>
                   <div className="flex gap-8">
                      <div>
                         <p className="text-[11px] text-stripe-light-slate uppercase font-bold">Case Velocity</p>
                         <p className="text-[13px] font-semibold text-stripe-dark">{caseFoundStats.customerCaseCount} Requests</p>
                      </div>
                      <div>
                         <p className="text-[11px] text-stripe-light-slate uppercase font-bold">Allocated Value</p>
                         <p className="text-[13px] font-semibold text-stripe-dark">{caseFoundStats.customerPromoCount} Vouchers</p>
                      </div>
                   </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="stripe-label">Settlement Value</label>
                  <Select value={promoValue} onValueChange={setPromoValue} disabled={promoType === 'INTERNAL_100' && dynamicPromoValues?.values?.length === 1}>
                    <SelectTrigger className="h-8 border-stripe-border rounded-[4px] shadow-sm text-[13px] font-medium font-mono focus:ring-1 focus:ring-stripe-blurple/20">
                      <SelectValue placeholder="0.00" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingDynamicValues ? (
                        <div className="p-2 text-center text-[11px] text-stripe-slate">Scanning...</div>
                      ) : dynamicPromoValues?.values?.map((v: number) => (
                        <SelectItem key={v} value={v.toString()} className="font-mono">{v} {dynamicPromoValues.currency}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {inventoryData && (
                    <div className={cn("text-[11px] font-semibold mt-1.5", inventoryData.available ? "text-[#1e874b]" : "text-[#cd3d64]")}>
                      {inventoryData.available ? `Available: ${inventoryData.count} units` : `Inventory Depleted`}
                    </div>
                  )}
                </div>

                <div>
                  <label className="stripe-label">Recipient Legal Identity</label>
                  <input 
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Legal Entity Name"
                    disabled={!!caseFoundStats}
                    className="stripe-input-field"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="stripe-label">Allocation Rationale</label>
                <textarea 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide justification..."
                  className="stripe-input-field h-[80px] py-2 resize-none"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-stripe-border">
                <button 
                  disabled={!isFormValid || submitMutation.isPending || inventoryData?.count === 0}
                  onClick={() => setIsConfirmOpen(true)}
                  className="stripe-button stripe-button-primary h-8 px-4"
                >
                  {submitMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Authorize Allocation
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="stripe-surface p-5 bg-[#f8fafc]">
               <h3 className="text-[13px] font-bold text-stripe-dark mb-3 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-stripe-slate" />
                  Governance Protocols
               </h3>
               <div className="space-y-4">
                  <div>
                     <h4 className="text-[12px] font-semibold text-stripe-dark mb-0.5">01. Pre-Issuance Audit</h4>
                     <p className="text-[12px] text-stripe-slate leading-relaxed">Ensure every resource request is mapped to a verified investigation reference in the core ledger.</p>
                  </div>
                  <div>
                     <h4 className="text-[12px] font-semibold text-stripe-dark mb-0.5">02. Limit Override</h4>
                     <p className="text-[12px] text-stripe-slate leading-relaxed">Multiple allocations for high-risk entities require immediate technical lead authorization.</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-lg p-0 border border-stripe-border shadow-stripe-card">
          <div className="px-5 py-4 border-b border-stripe-border bg-[#f8fafc]">
             <DialogTitle className="text-[16px] font-bold text-stripe-dark">Authorize Allocation</DialogTitle>
             <DialogDescription className="text-[13px] text-stripe-slate">Verify parameters before finalizing.</DialogDescription>
          </div>
          <div className="p-5">
            <div className="bg-white border border-stripe-border rounded-[4px] p-4 space-y-3">
               <div className="flex justify-between items-center">
                  <span className="text-[12px] font-semibold text-stripe-slate">Value</span>
                  <span className="text-[14px] font-bold text-stripe-dark font-mono">{promoValue} {dynamicPromoValues?.currency}</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[12px] font-semibold text-stripe-slate">Target Resource</span>
                  <span className="text-[13px] font-medium text-stripe-dark">#{caseNumber}</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[12px] font-semibold text-stripe-slate">Recipient</span>
                  <span className="text-[13px] font-medium text-stripe-dark">{customerName}</span>
               </div>
            </div>
          </div>
          <DialogFooter className="px-5 py-3 bg-[#f8fafc] border-t border-stripe-border gap-2">
            <button className="stripe-button stripe-button-secondary" onClick={() => setIsConfirmOpen(false)}>Cancel</button>
            <button className="stripe-button stripe-button-primary" onClick={() => submitMutation.mutate({})}>Finalize</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDuplicateConfirmOpen} onOpenChange={setIsDuplicateConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-lg p-0 border border-stripe-border shadow-stripe-card">
          <div className="px-5 py-4 border-b border-stripe-border bg-[#fceceb]">
             <DialogTitle className="text-[#cd3d64] flex items-center gap-1.5 text-[16px] font-bold">
               <ShieldAlert className="w-4 h-4" /> Policy Violation Alert
             </DialogTitle>
             <DialogDescription className="text-[13px] text-[#cd3d64]/80 mt-1">
                This entity already possesses an active resource. Override required.
             </DialogDescription>
          </div>
          <div className="p-5">
             <div className="text-[13px] text-stripe-dark italic text-center">
                "I certify that this override allocation complies with treasury-grade recovery frameworks."
             </div>
          </div>
          <DialogFooter className="px-5 py-3 bg-[#f8fafc] border-t border-stripe-border gap-2">
            <button className="stripe-button stripe-button-secondary" onClick={() => setIsDuplicateConfirmOpen(false)}>Abort</button>
            <button className="stripe-button bg-[#cd3d64] text-white hover:bg-[#b9375a]" onClick={() => submitMutation.mutate({ force: true })}>Authorize Override</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
