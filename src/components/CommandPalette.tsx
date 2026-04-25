import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search, Settings, FileText, Ticket, BarChart3, HelpCircle, LogOut } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-[600px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] overflow-hidden">
        <Command
          shouldFilter={true}
          className="w-full h-full flex flex-col"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        >
          <div className="flex items-center px-4 border-b border-[var(--color-border-subtle)]">
            <Search className="w-5 h-5 text-[var(--color-text-tertiary)] mr-2 shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search..."
              className="flex-1 h-14 bg-transparent outline-none text-[var(--color-text-primary)] text-[15px] placeholder:text-[var(--color-text-tertiary)]"
            />
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded text-[var(--color-text-tertiary)]">ESC</kbd>
            </div>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scroll-smooth">
            <Command.Empty className="py-6 text-center text-[var(--text-caption)] text-[var(--color-text-secondary)]">
              No results found.
            </Command.Empty>

            <Command.Group heading="Requests" className="text-[12px] font-medium text-[var(--color-text-tertiary)] px-2 py-1">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/cases'))}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] cursor-pointer mt-1"
              >
                <FileText className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                View All Requests
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/cases/new'))}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] cursor-pointer"
              >
                <FileText className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                Create New Request
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Operations & Processing" className="text-[12px] font-medium text-[var(--color-text-tertiary)] px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/refunds/execution'))}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] cursor-pointer mt-1"
              >
                <Ticket className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                Refund Execution Batch
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/refunds/ops'))}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] cursor-pointer"
              >
                <Ticket className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                Refund Ops Hub
              </Command.Item>
            </Command.Group>

            <Command.Group heading="System" className="text-[12px] font-medium text-[var(--color-text-tertiary)] px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/system?tab=brands'))}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] cursor-pointer mt-1"
              >
                <Settings className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                Manage Brands
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/system?tab=audit'))}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                Audit Trail
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/help-desk'))}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 mr-2 text-[var(--color-text-secondary)]" />
                Help Desk
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => { localStorage.clear(); navigate('/login'); })}
                className="flex items-center px-3 py-2 text-[14px] text-[var(--color-danger)] rounded-[var(--radius-md)] hover:bg-[var(--color-danger-subtle)] cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
