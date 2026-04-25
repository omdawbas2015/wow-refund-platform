import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FileText,
  ArrowLeftRight,
  Ticket,
  BarChart3,
  Settings,
  Receipt,
  HelpCircle,
  Plus,
  Gift,
  ChevronDown,
  User,
  Zap,
  Mail,
  Home
} from 'lucide-react';

interface NavItem {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
}

type SidebarEntry = NavItem | { type: 'header'; label: string };

const navigation: SidebarEntry[] = [
  { icon: Home, label: 'Home', path: '/' },
  { type: 'header', label: 'Shortcuts' },
  { icon: FileText, label: 'Refund cases', path: '/cases' },
  { icon: Plus, label: 'New request', path: '/cases/new' },
  { icon: Receipt, label: 'Settlements', path: '/refunds/execution' },
  { icon: ArrowLeftRight, label: 'Operations hub', path: '/refunds/ops', adminOnly: true },
  { type: 'header', label: 'Products' },
  { icon: Ticket, label: 'Standard promo', path: '/compensation/issue' },
  { icon: Gift, label: 'Service recovery', path: '/compensation/internal', adminOnly: true },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { type: 'header', label: 'Help desk' },
  { icon: Mail, label: 'Store communications', path: '/automation-emails' },
  { icon: HelpCircle, label: 'Ticketing system', path: '/help-desk' },
  { type: 'header', label: 'More' },
  { icon: Settings, label: 'System settings', path: '/system', adminOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  const user = (() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored || stored === 'undefined') return { role: 'AGENT', name: 'User' };
      const parsed = JSON.parse(stored);
      return { ...parsed, name: parsed.name || 'User' };
    } catch {
      return { role: 'AGENT', name: 'User' };
    }
  })();

  const isAdmin = user.role === 'ADMIN';

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <aside
      className={cn(
        'h-screen flex flex-col bg-white border-r border-stripe-border/60 transition-all duration-300 shrink-0 overflow-hidden z-[100] relative shadow-[1px_0_10px_rgba(0,0,0,0.02)]',
        collapsed ? 'w-[64px]' : 'w-[250px]'
      )}
    >
      {/* Brand Header */}
      <div className="h-[56px] flex items-center px-3 shrink-0 mt-3 mb-1">
         {!collapsed ? (
           <div className="flex items-center justify-between w-full group cursor-pointer hover:bg-gray-50/70 p-2 rounded-[12px] transition-colors">
              <div className="flex items-center gap-3 w-full">
                 <div className="w-[28px] h-[28px] bg-gradient-to-tr from-[#f6f9fc] to-white border border-stripe-border/80 rounded-[8px] shadow-sm flex items-center justify-center shrink-0">
                    <span className="text-[12px] font-bold text-stripe-dark">N</span>
                 </div>
                 <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13px] font-bold text-stripe-dark truncate leading-tight">
                       Test mode
                    </span>
                    <span className="text-[12px] text-stripe-slate font-medium truncate leading-tight mt-0.5">
                       New business
                    </span>
                 </div>
                 <ChevronDown className="w-4 h-4 text-stripe-light-slate shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
           </div>
        ) : (
           <div className="w-full flex justify-center">
              <div className="w-[28px] h-[28px] bg-gradient-to-tr from-[#f6f9fc] to-white border border-stripe-border/80 rounded-[8px] shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                 <span className="text-[12px] font-bold text-stripe-dark">N</span>
              </div>
           </div>
        )}
      </div>

      {/* Navigation (Scrollbar hidden via tailwind arbitrary values) */}
      <nav className="flex-1 overflow-y-auto py-2 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navigation.map((entry, idx) => {
          if ('type' in entry && entry.type === 'header') {
            return !collapsed && (
              <div key={`head-${idx}`} className="mt-6 mb-2.5 first:mt-2 flex items-center justify-between group">
                <span className="text-[12px] font-medium text-stripe-light-slate">{entry.label}</span>
                {entry.label === 'More' && (
                  <ChevronDown className="w-3.5 h-3.5 text-stripe-light-slate opacity-0 group-hover:opacity-100 cursor-pointer" />
                )}
              </div>
            );
          }
          
          const item = entry as NavItem;
          if (item.adminOnly && !isAdmin) return null;
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center h-[34px] rounded-[10px] text-[13px] transition-colors mb-0.5 group',
                active 
                  ? 'text-stripe-blurple font-semibold bg-stripe-blurple/[0.04]' 
                  : 'text-[#425466] font-medium hover:text-stripe-dark hover:bg-gray-50',
                collapsed && 'justify-center px-0 h-[38px] w-[38px] mx-auto'
              )}
            >
              <Icon className={cn(
                'w-[16px] h-[16px] shrink-0 transition-colors',
                collapsed ? '' : 'ml-2.5',
                active ? 'text-stripe-blurple' : 'text-[#8792a2] group-hover:text-stripe-dark'
              )} strokeWidth={active ? 2.5 : 2} />
              {!collapsed && (
                <span className="ml-3 truncate">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings Shortcut */}
      <div className="p-4 bg-white mt-auto border-t border-transparent">
         {!collapsed && (
           <div className="flex items-center gap-2 text-[12px] text-stripe-slate hover:text-stripe-dark cursor-pointer font-medium mb-1 group px-2 py-1.5 rounded-[8px] hover:bg-gray-50 transition-colors">
              <span className="w-5 h-5 flex items-center justify-center bg-[#f6f9fc] rounded-[6px] text-stripe-slate group-hover:text-stripe-dark">...</span>
              <span>More</span>
              <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
           </div>
         )}
      </div>
    </aside>
  );
}
