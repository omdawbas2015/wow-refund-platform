import { useState } from 'react';
import { 
  Users, 
  Globe, 
  ShieldCheck, 
  Building2, 
  Key, 
  Bell, 
  Activity,
  ChevronRight,
  Database,
  Lock,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UsersTab from './tabs/UsersTab';
import GeographyTab from './tabs/GeographyTab';
import AuditTab from './tabs/AuditTab';

const categories = [
  { id: 'users', label: 'Team & Access', icon: Users, description: 'Manage members and IAM permissions' },
  { id: 'geography', label: 'Market Regions', icon: Globe, description: 'Configure sectors and physical nodes' },
  { id: 'audit', label: 'Immutable Ledger', icon: ShieldCheck, description: 'System-wide activity and audit trail' },
  { id: 'security', label: 'Security & API', icon: Key, description: 'Token management and security policies' },
  { id: 'infrastructure', label: 'Infrastructure', icon: Database, description: 'Database health and cloud resources' }
];

export default function SystemPanel() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="max-w-[1400px] mx-auto py-10 px-8 animate-stripe">
      {/* Page Header */}
      <div className="mb-10">
         <h1 className="stripe-page-title">Settings</h1>
         <p className="stripe-page-subtitle">Configure your platform's operational parameters and administrative governance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Navigation Sidebar (Settings Style) */}
        <div className="lg:col-span-3 space-y-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-left",
                activeTab === cat.id 
                  ? "bg-white text-stripe-blurple shadow-stripe-sm border border-stripe-border" 
                  : "text-stripe-slate hover:bg-gray-50 hover:text-stripe-dark"
              )}
            >
              <cat.icon className={cn(
                "w-5 h-5 shrink-0",
                activeTab === cat.id ? "text-stripe-blurple" : "text-stripe-light-slate group-hover:text-stripe-slate"
              )} />
              <div className="flex-1 min-w-0">
                 <p className={cn("text-[14px] truncate", activeTab === cat.id ? "font-bold" : "font-semibold")}>{cat.label}</p>
                 {activeTab === cat.id && !cat.description.includes('Manage') && (
                    <p className="text-[11px] text-stripe-light-slate font-medium truncate mt-0.5">{cat.description}</p>
                 )}
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 transition-transform",
                activeTab === cat.id ? "text-stripe-blurple opacity-100" : "opacity-0 group-hover:opacity-100"
              )} />
            </button>
          ))}
          
          <div className="mt-8 pt-8 border-t border-stripe-border space-y-4">
             <div className="px-4">
                <p className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-widest mb-4">Account Metadata</p>
                <div className="space-y-4">
                   <div className="flex justify-between text-[12px] font-semibold">
                      <span className="text-stripe-light-slate">Organization ID</span>
                      <span className="text-stripe-dark">ORG_WOW_2026</span>
                   </div>
                   <div className="flex justify-between text-[12px] font-semibold">
                      <span className="text-stripe-light-slate">SLA Level</span>
                      <span className="text-stripe-blurple">Enterprise</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
           <div className="stripe-card min-h-[600px] overflow-hidden flex flex-col">
              <div className="px-8 py-5 border-b border-stripe-border bg-gray-50/50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    {(() => {
                       const cat = categories.find(c => c.id === activeTab);
                       if (!cat) return null;
                       return (
                          <>
                             <div className="w-8 h-8 rounded bg-white border border-stripe-border flex items-center justify-center text-stripe-blurple shadow-stripe-sm">
                                <cat.icon className="w-4 h-4" />
                             </div>
                             <div>
                                <h2 className="text-[15px] font-bold text-stripe-dark">{cat.label}</h2>
                                <p className="text-[12px] text-stripe-light-slate font-medium">{cat.description}</p>
                             </div>
                          </>
                       );
                    })()}
                 </div>
                 {activeTab === 'users' && (
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stripe-light-slate" />
                       <input placeholder="Search members..." className="stripe-input pl-10 h-9 w-48 text-[12px]" />
                    </div>
                 )}
              </div>
              
              <div className="p-8 flex-1">
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'geography' && <GeographyTab />}
                {activeTab === 'audit' && <AuditTab />}
                {(activeTab === 'security' || activeTab === 'infrastructure') && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-20">
                    <div className="w-16 h-16 bg-stripe-bg rounded-full flex items-center justify-center mb-4">
                      <Lock className="w-8 h-8 text-stripe-light-slate opacity-20" />
                    </div>
                    <h3 className="text-[16px] font-bold text-stripe-dark">Advanced Configuration Restricted</h3>
                    <p className="text-[14px] text-stripe-light-slate mt-1 max-w-sm">
                      Access to security tokens and infrastructure parameters requires a multi-factor override from the technical operations team.
                    </p>
                    <button className="stripe-btn-secondary mt-6">Request Elevation</button>
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
