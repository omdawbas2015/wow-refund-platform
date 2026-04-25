import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, 
  Plus, 
  Trash2,
  Loader2,
  ChevronRight,
  CreditCard,
  FileText,
  User,
  Search
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const componentSchema = z.object({
  paymentMethod: z.string().min(1, 'Payment method required'),
  amount: z.coerce.number().positive('Must be > 0'),
  externalRef: z.string().optional().nullable()
});

const caseSchema = z.object({
  caseNumber: z.string().min(1, 'Case number is required'),
  customerName: z.string().min(2, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email'),
  customerPhone: z.string().min(8, 'Valid phone number is required'),
  orderNumber: z.string().min(1, 'Order number is required'),
  orderDate: z.string().min(1, 'Order date is required'),
  orderAmount: z.coerce.number().positive('Amount must be positive'),
  components: z.array(componentSchema).min(1, 'At least one payment method is required'),
  countryId: z.string().min(1, 'Country is required'),
  branchId: z.string().min(1, 'Branch is required'),
  brandId: z.string().optional().nullable(),
  rootCauseId: z.string().min(1, 'Root cause is required'),
  refundReason: z.string().min(1, 'Reason is required'),
});

type CaseFormValues = z.infer<typeof caseSchema>;

export default function CaseCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: metaData, isLoading: isLoadingMeta } = useQuery({
    queryKey: ['metadata'],
    queryFn: async () => {
      const response = await axios.get('/api/metadata', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return response.data;
    }
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<CaseFormValues>({
    resolver: zodResolver(caseSchema) as any,
    defaultValues: {
      caseNumber: '', customerName: '', customerEmail: '', customerPhone: '',
      orderNumber: '', orderDate: '', orderAmount: 0,
      components: [{ paymentMethod: 'CREDIT_CARD', amount: 0, externalRef: '' }],
      countryId: '', branchId: '', brandId: '', rootCauseId: '', refundReason: '',
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "components" });
  const selectedCountryId = watch('countryId');
  const branches = metaData?.countries?.find((c: any) => c.id === selectedCountryId)?.branches || [];

  const onSubmit = async (data: CaseFormValues) => {
    setIsSubmitting(true);
    try {
      await axios.post('/api/cases', data, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Refund case created successfully');
      navigate('/cases');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create case');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingMeta) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-stripe-blurple" />
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto py-8 px-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-[#e3e8ee] rounded-md transition-colors text-stripe-slate">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-stripe-light-slate mb-1">
            <span className="hover:text-stripe-dark cursor-pointer transition-colors" onClick={() => navigate('/cases')}>Cases</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-stripe-slate">New</span>
          </div>
          <h1 className="text-[20px] font-bold text-stripe-dark leading-tight">Create refund case</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Section 1: Identification */}
        <div className="stripe-surface p-6">
          <h2 className="text-[14px] font-bold text-stripe-dark mb-4 pb-3 border-b border-stripe-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-stripe-slate" /> Identification
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="stripe-label">Case Reference ID</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stripe-light-slate" />
                <input 
                  placeholder="e.g. RC-KW-1001" 
                  {...register('caseNumber')} 
                  className="stripe-input-field pl-8" 
                />
              </div>
              {errors.caseNumber && <p className="text-[11px] text-[#cd3d64] mt-1 font-medium">{errors.caseNumber.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3 col-span-1 md:col-span-2">
              <div>
                <label className="stripe-label">Market</label>
                <Controller name="countryId" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {metaData?.countries?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div>
                <label className="stripe-label">Branch</label>
                <Controller name="branchId" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCountryId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div>
                <label className="stripe-label">Brand</label>
                <Controller name="brandId" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {metaData?.brands?.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Transaction */}
        <div className="stripe-surface p-6">
          <h2 className="text-[14px] font-bold text-stripe-dark mb-4 pb-3 border-b border-stripe-border flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-stripe-slate" /> Transaction Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <div>
              <label className="stripe-label">Order Number</label>
              <input placeholder="e.g. 50012345" {...register('orderNumber')} className="stripe-input-field" />
            </div>
            <div>
              <label className="stripe-label">Order Date</label>
              <input type="date" {...register('orderDate')} className="stripe-input-field" />
            </div>
            <div>
              <label className="stripe-label">Total Amount</label>
              <input type="number" step="0.01" {...register('orderAmount')} className="stripe-input-field" />
            </div>
          </div>

          <div className="pt-4 border-t border-stripe-border">
            <h3 className="text-[12px] font-bold text-stripe-dark mb-3 uppercase tracking-wide">Payment Sources</h3>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 p-3 bg-[#f8fafc] rounded-md border border-stripe-border">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-stripe-slate mb-1 block">Method</label>
                    <Controller name={`components.${index}.paymentMethod`} control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CREDIT_CARD">Credit / Debit Card</SelectItem>
                          <SelectItem value="KNET">KNET Debit</SelectItem>
                          <SelectItem value="AURA">Aura Points</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-stripe-slate mb-1 block">Amount</label>
                    <input type="number" step="0.01" {...register(`components.${index}.amount`)} className="stripe-input-field bg-white" />
                  </div>
                  <button type="button" onClick={() => remove(index)} className="h-8 w-8 flex items-center justify-center text-stripe-light-slate hover:text-[#cd3d64] hover:bg-[#fceceb] rounded-[4px] transition-colors border border-transparent">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button 
                type="button" 
                onClick={() => append({ paymentMethod: 'CREDIT_CARD', amount: 0, externalRef: '' })} 
                className="flex items-center gap-1.5 text-stripe-blurple text-[12px] font-bold hover:text-[#5851df] transition-colors mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add Payment Source
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Customer */}
        <div className="stripe-surface p-6">
          <h2 className="text-[14px] font-bold text-stripe-dark mb-4 pb-3 border-b border-stripe-border flex items-center gap-2">
            <User className="w-4 h-4 text-stripe-slate" /> Customer Contact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="stripe-label">Full Name</label>
              <input placeholder="John Doe" {...register('customerName')} className="stripe-input-field" />
            </div>
            <div>
              <label className="stripe-label">Email Address</label>
              <input type="email" placeholder="email@example.com" {...register('customerEmail')} className="stripe-input-field" />
            </div>
            <div>
              <label className="stripe-label">Phone Number</label>
              <input placeholder="+965" {...register('customerPhone')} className="stripe-input-field" />
            </div>
          </div>
        </div>

        {/* Section 4: Context */}
        <div className="stripe-surface p-6">
          <h2 className="text-[14px] font-bold text-stripe-dark mb-4 pb-3 border-b border-stripe-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-stripe-slate" /> Case Context
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
             <div>
               <label className="stripe-label">Root Cause</label>
               <Controller name="rootCauseId" control={control} render={({ field }) => (
                 <Select onValueChange={field.onChange} value={field.value}>
                   <SelectTrigger className="w-full">
                     <SelectValue placeholder="Select reason" />
                   </SelectTrigger>
                   <SelectContent>
                     {metaData?.rootCauses?.map((rc: any) => (
                       <SelectItem key={rc.id} value={rc.id}>{rc.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               )} />
             </div>
          </div>
          <div>
            <label className="stripe-label">Investigation Notes</label>
            <textarea 
              {...register('refundReason')} 
              className="stripe-input-field min-h-[80px] py-2 resize-none" 
              placeholder="Describe the outcome..." 
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            className="stripe-button stripe-button-secondary px-4"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="stripe-button stripe-button-primary px-6"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Create Resource
          </button>
        </div>

      </form>
    </div>
  );
}
