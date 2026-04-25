import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Search, 
  Send,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  ChevronRight,
  FileText,
  User,
  Zap,
  CheckCircle2,
  ArrowRight,
  History,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SCENARIOS = [
  {
    id: 'sc_1',
    title: 'Missing / Wrong Item Escalation',
    description: 'Alert the branch manager about a discrepancy in a customer order requiring immediate investigation.',
    icon: AlertTriangle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    variables: ['Order Number', 'Missing Item(s)', 'Customer Name']
  },
  {
    id: 'sc_2',
    title: 'Refund Approval Notification',
    description: 'Notify the store that a high-value refund has been cleared by L3 Operations and is ready to be processed on POS.',
    icon: ShieldCheck,
    color: 'text-stripe-green',
    bgColor: 'bg-stripe-green/10',
    variables: ['Case Number', 'Approved Amount', 'Approval Ref']
  },
  {
    id: 'sc_3',
    title: 'VIP Customer Follow-up',
    description: 'Trigger a priority check-in for VIP/Aura members who experienced service friction.',
    icon: User,
    color: 'text-stripe-blurple',
    bgColor: 'bg-stripe-blurple/10',
    variables: ['Customer Tier', 'Issue Summary', 'Expected Action']
  },
  {
    id: 'sc_4',
    title: 'POS Outage / System Sync Error',
    description: 'Technical dispatch to the branch regarding failed transaction synchronization.',
    icon: Zap,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    variables: ['Terminal ID', 'Error Code', 'Resolution Steps']
  }
];

export default function AutomationEmails() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const activeScenario = SCENARIOS.find(s => s.id === selectedScenario);

  const filteredScenarios = SCENARIOS.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDispatch = () => {
    setIsDispatching(true);
    setTimeout(() => {
      setIsDispatching(false);
      toast.success('Communication dispatched to branch successfully');
      setSelectedScenario(null);
      setFormValues({});
    }, 1500);
  };

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <div className="flex items-center gap-2 text-[12px] font-bold text-stripe-light-slate uppercase tracking-widest mb-2">
              <Building2 className="w-3.5 h-3.5 text-stripe-blurple" />
              <span>Help Desk</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-stripe-blurple">Store Communications</span>
           </div>
           <h1 className="stripe-h1">Dispatch Console</h1>
           <p className="text-[16px] text-stripe-slate max-w-2xl mt-2">
             Standardize daily store communications. Select a scenario, fill the context, and automatically dispatch formatted instructions to branch managers.
           </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
           <button className="stripe-button stripe-button-secondary bg-white">
              <History className="w-4 h-4" />
              <span>Dispatch Logs</span>
           </button>
           <button className="stripe-button stripe-button-primary">
              <FileText className="w-4 h-4" /> 
              <span>Manage Templates</span>
           </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Pane: Scenario Selection */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
          className="lg:col-span-5 flex flex-col h-[calc(100vh-220px)]"
        >
           <div className="stripe-surface flex flex-col h-full overflow-hidden shadow-stripe-lg">
              <div className="p-5 border-b border-stripe-border bg-white/60 backdrop-blur-md shrink-0">
                 <div className="relative w-full group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-light-slate group-focus-within:text-stripe-blurple transition-colors" />
                    <input 
                      placeholder="Find communication scenario..." 
                      className="stripe-input-field pl-10 h-11 border-transparent bg-gray-50/50 focus:bg-white transition-all text-[14px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f6f9fc]/50">
                 {filteredScenarios.map((scenario) => {
                    const isSelected = selectedScenario === scenario.id;
                    const Icon = scenario.icon;
                    return (
                      <div 
                        key={scenario.id}
                        onClick={() => setSelectedScenario(scenario.id)}
                        className={cn(
                           "p-4 rounded-xl cursor-pointer transition-all border",
                           isSelected 
                             ? "bg-white border-stripe-blurple shadow-stripe-md ring-1 ring-stripe-blurple" 
                             : "bg-white border-transparent hover:border-stripe-border hover:shadow-stripe-sm"
                        )}
                      >
                         <div className="flex items-start gap-4">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", scenario.bgColor, scenario.color)}>
                               <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <h3 className={cn("text-[14px] font-bold truncate mb-1 transition-colors", isSelected ? "text-stripe-blurple" : "text-stripe-dark")}>
                                 {scenario.title}
                               </h3>
                               <p className="text-[13px] text-stripe-slate leading-relaxed line-clamp-2">
                                 {scenario.description}
                               </p>
                            </div>
                            {isSelected && (
                               <div className="w-5 h-5 rounded-full bg-stripe-blurple flex items-center justify-center shrink-0 mt-1">
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                               </div>
                            )}
                         </div>
                      </div>
                    );
                 })}
                 {filteredScenarios.length === 0 && (
                    <div className="p-8 text-center">
                       <Search className="w-8 h-8 text-stripe-light-slate mx-auto mb-3 opacity-50" />
                       <p className="text-[14px] font-bold text-stripe-slate">No scenarios found</p>
                    </div>
                 )}
              </div>
           </div>
        </motion.div>

        {/* Right Pane: Dispatch Console */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-7 flex flex-col h-[calc(100vh-220px)]"
        >
           <div className="stripe-surface flex flex-col h-full overflow-hidden shadow-stripe-lg">
              <AnimatePresence mode="wait">
                 {!activeScenario ? (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/30"
                    >
                       <div className="relative w-24 h-24 mb-6">
                          <div className="absolute inset-0 bg-stripe-blurple/[0.05] rounded-full animate-ping duration-1000" />
                          <div className="relative w-full h-full bg-white border border-stripe-border shadow-stripe-md rounded-full flex items-center justify-center">
                             <Mail className="w-10 h-10 text-stripe-light-slate" />
                          </div>
                          <div className="absolute -right-2 -bottom-2 w-10 h-10 bg-stripe-blurple rounded-full flex items-center justify-center shadow-stripe-lg border-2 border-white">
                             <Zap className="w-5 h-5 text-white fill-white" />
                          </div>
                       </div>
                       <h2 className="text-[20px] font-bold text-stripe-dark mb-2 tracking-tight">Select a Scenario</h2>
                       <p className="text-[14px] text-stripe-slate max-w-sm leading-relaxed">
                          Choose an operational scenario from the left panel to populate the communication template and dispatch to the store.
                       </p>
                    </motion.div>
                 ) : (
                    <motion.div 
                      key="console"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="flex-1 flex flex-col"
                    >
                       <div className="p-6 border-b border-stripe-border flex items-center gap-4 bg-white shrink-0">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-stripe-border shadow-sm", activeScenario.bgColor, activeScenario.color)}>
                             <activeScenario.icon className="w-6 h-6" />
                          </div>
                          <div>
                             <h2 className="text-[18px] font-bold text-stripe-dark">{activeScenario.title}</h2>
                             <p className="text-[13px] text-stripe-slate flex items-center gap-1.5 mt-0.5">
                                <Info className="w-3.5 h-3.5" /> Template loaded & ready for dispatch
                             </p>
                          </div>
                       </div>

                       <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/20">
                          
                          <div className="space-y-5">
                             <div className="grid grid-cols-2 gap-5">
                                <div>
                                   <label className="stripe-label">Target Branch / Store</label>
                                   <select className="stripe-input-field text-[14px]">
                                      <option>Select destination...</option>
                                      <option>Avenues Mall - KW</option>
                                      <option>Marina Mall - KW</option>
                                      <option>Dubai Mall - UAE</option>
                                   </select>
                                </div>
                                <div>
                                   <label className="stripe-label">Priority Level</label>
                                   <select className="stripe-input-field text-[14px]">
                                      <option>Standard</option>
                                      <option>High (Urgent)</option>
                                      <option>Critical (Escalation)</option>
                                   </select>
                                </div>
                             </div>

                             <div className="p-6 rounded-xl border border-stripe-border bg-white shadow-sm space-y-5">
                                <h3 className="text-[12px] font-bold text-stripe-dark uppercase tracking-widest flex items-center gap-2">
                                   <Zap className="w-4 h-4 text-stripe-blurple" /> Dynamic Variables
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                   {activeScenario.variables.map((v, i) => (
                                      <div key={i}>
                                         <label className="stripe-label text-[11px]">{v}</label>
                                         <input 
                                           placeholder={`Enter ${v.toLowerCase()}...`}
                                           className="stripe-input-field"
                                           value={formValues[v] || ''}
                                           onChange={(e) => setFormValues(prev => ({ ...prev, [v]: e.target.value }))}
                                         />
                                      </div>
                                   ))}
                                </div>
                             </div>
                          </div>

                          <div className="space-y-3">
                             <label className="stripe-label flex items-center justify-between">
                                <span>Preview Payload</span>
                                <span className="text-[11px] font-normal text-stripe-light-slate">Sent via Internal SMTP</span>
                             </label>
                             <div className="p-6 rounded-xl bg-gray-900 text-gray-300 font-mono text-[13px] leading-relaxed shadow-inner overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-stripe-blurple to-indigo-500" />
                                <p><span className="text-gray-500">Subject:</span> [ACTION REQUIRED] {activeScenario.title}</p>
                                <p><span className="text-gray-500">To:</span> store_manager@alshaya.com</p>
                                <div className="my-4 border-t border-gray-800" />
                                <p className="text-gray-100 mb-4">Dear Store Team,</p>
                                <p className="mb-4">Please be advised of the following operational request regarding <span className="text-stripe-blurple font-bold bg-stripe-blurple/20 px-1 rounded">{formValues[activeScenario.variables[0]] || `[${activeScenario.variables[0]}]`}</span>.</p>
                                <p className="mb-4 text-gray-400">Additional Context:<br/>{formValues[activeScenario.variables[1]] || `[${activeScenario.variables[1]}]`}</p>
                                <p>Kindly action this within standard SLA.</p>
                             </div>
                          </div>

                       </div>

                       <div className="p-5 border-t border-stripe-border bg-white shrink-0 flex items-center justify-between">
                          <button 
                            onClick={() => setSelectedScenario(null)}
                            className="stripe-button stripe-button-secondary px-5"
                          >
                             Cancel
                          </button>
                          <button 
                            onClick={handleDispatch}
                            disabled={isDispatching}
                            className="stripe-button stripe-button-primary px-8 h-11 bg-stripe-dark hover:bg-black shadow-stripe-lg"
                          >
                             {isDispatching ? (
                                <div className="flex items-center gap-2">
                                   <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                   <span>Transmitting...</span>
                                </div>
                             ) : (
                                <div className="flex items-center gap-2">
                                   <Send className="w-4 h-4" />
                                   <span>Dispatch Communication</span>
                                </div>
                             )}
                          </button>
                       </div>
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>
        </motion.div>
      </div>
    </div>
  );
}
