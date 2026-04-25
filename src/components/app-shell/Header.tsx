import { Search, Bell, HelpCircle, Menu, LogOut, Settings, User, Command, FileText, Ticket, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export default function Header({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const navigate = useNavigate();
  
  const user = (() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored || stored === 'undefined') return { role: 'AGENT', name: 'User', email: '' };
      const parsed = JSON.parse(stored);
      return { ...parsed, name: parsed.name || 'User' };
    } catch {
      return { role: 'AGENT', name: 'User', email: '' };
    }
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="h-[56px] bg-white flex items-center justify-between px-6 shrink-0 z-50 border-b border-stripe-border/60">
      {/* Search Bar */}
      <div className="flex items-center gap-6 flex-1 max-w-xl ml-4">
         <button 
           onClick={onToggleSidebar}
           className="p-1.5 hover:bg-gray-50 rounded-md text-stripe-slate transition-colors md:hidden"
         >
            <Menu className="w-4 h-4" />
         </button>
         
         <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stripe-light-slate" />
            <input 
              placeholder="Search" 
              className="w-full pl-9 pr-12 h-8 bg-stripe-card-bg border border-transparent rounded-[8px] text-[13px] outline-none focus:bg-white focus:ring-1 focus:ring-stripe-blurple/20 focus:border-stripe-blurple transition-all placeholder:text-stripe-light-slate"
            />
         </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-8 text-stripe-slate">
        <button className="p-1.5 hover:bg-gray-50 rounded-md transition-colors">
           <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 3H3V6.5H6.5V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 3H9.5V6.5H13V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.5 9.5H3V13H6.5V9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 9.5H9.5V13H13V9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
           </svg>
        </button>
        <button className="p-1.5 hover:bg-gray-50 rounded-md transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:bg-gray-50 rounded-md transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <button className="p-1.5 hover:bg-gray-50 rounded-md transition-colors">
          <Settings className="w-4 h-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-gray-50 rounded-md transition-colors text-stripe-blurple group focus:outline-none">
              <div className="w-[22px] h-[22px] rounded-full bg-stripe-blurple text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow-[0_2px_5px_rgba(99,91,255,0.3)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px] p-1.5 shadow-stripe-lg border-stripe-border rounded-[10px]">
             <DropdownMenuItem className="text-[13px] font-medium py-2 px-3 rounded-[6px] cursor-pointer hover:bg-[#f6f9fc] hover:text-stripe-dark" onClick={() => navigate('/cases/new')}>
                <FileText className="mr-3 w-4 h-4 text-[#8792a2]" /> New Refund Case
                <span className="ml-auto text-[10px] text-stripe-light-slate font-mono">C</span>
             </DropdownMenuItem>
             <DropdownMenuItem className="text-[13px] font-medium py-2 px-3 rounded-[6px] cursor-pointer hover:bg-[#f6f9fc] hover:text-stripe-dark" onClick={() => navigate('/compensation/issue')}>
                <Ticket className="mr-3 w-4 h-4 text-[#8792a2]" /> New Promo Code
                <span className="ml-auto text-[10px] text-stripe-light-slate font-mono">P</span>
             </DropdownMenuItem>
             <DropdownMenuItem className="text-[13px] font-medium py-2 px-3 rounded-[6px] cursor-pointer hover:bg-[#f6f9fc] hover:text-stripe-dark" onClick={() => navigate('/system')}>
                <Building2 className="mr-3 w-4 h-4 text-[#8792a2]" /> New Brand Asset
                <span className="ml-auto text-[10px] text-stripe-light-slate font-mono">B</span>
             </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-stripe-border">
          <button className="flex items-center gap-2 h-7 px-2.5 rounded-full bg-[#f6f9fc] hover:bg-[#e3e8ee] transition-colors text-[12px] font-semibold text-stripe-dark border border-stripe-border">
            Setup guide
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#c1c9d2] border-t-stripe-blurple" />
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center ml-2 p-1 hover:bg-gray-50 rounded-md transition-all group">
              <div className="w-[22px] h-[22px] rounded-full bg-stripe-blurple flex items-center justify-center text-white text-[10px] font-bold">
                {user.name.charAt(0)}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2">
            <div className="px-4 py-3 mb-2 bg-gray-50 rounded-lg">
               <p className="text-[14px] font-bold text-stripe-dark leading-tight">{user.name}</p>
               <p className="text-[12px] text-stripe-light-slate mt-0.5">{user.email || 'System Administrator'}</p>
            </div>
            <DropdownMenuItem className="cursor-pointer">
               <User className="mr-2 w-4 h-4" /> Account settings
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
               <Settings className="mr-2 w-4 h-4" /> Developer tools
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-stripe-error">
               <LogOut className="mr-2 w-4 h-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
