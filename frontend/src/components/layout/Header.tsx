import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Radio,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { MetaApiModal } from './MetaApiModal';
import { WhatsAppQrModal } from './WhatsAppQrModal';
import { Breadcrumbs } from './Breadcrumbs';
import { NotificationCenter } from './NotificationCenter';
import { CommandPalette } from './CommandPalette';
import { CompanyTagBadge } from '../common/CompanyTagBadge';
import { cn } from '../ui';

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
  onOpenLead: (leadId: string) => void;
}

const roleTitle = (user: any): string => {
  if (!user) return 'Team Member';
  if (user.role === 'super_admin') return 'Super Admin';
  return user.roleTitle || String(user.role || '').replace(/_/g, ' ');
};

type ThemeMode = 'light' | 'dark' | 'system';

export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar, onOpenLead }) => {
  const {
    currentUser,
    users,
    logout,
    isSuperAdmin,
    qrModalOpen,
    setQrModalOpen,
    theme,
    resolvedTheme,
    setTheme,
  } = useCrm() as any;

  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (event.key === 'Escape') {
        setAccountOpen(false);
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const scope = currentUser?.company || 'All brands';

  const themeOptions: Array<{ id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  const currentThemeIcon = () => {
    if (theme === 'system') return <Monitor className="h-4 w-4" />;
    if (resolvedTheme === 'dark') return <Moon className="h-4 w-4" />;
    return <Sun className="h-4 w-4" />;
  };

  return (
    <>
      <header className="sticky top-0 z-[60] flex h-14 w-full shrink-0 items-center gap-2 border-b border-[#E0E5E7] bg-white/95 px-2.5 backdrop-blur transition-colors sm:gap-4 sm:px-4 dark:border-[#222D34] dark:bg-[#202C33]/95">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#667781] transition-colors hover:bg-[#F0F2F5] hover:text-[#111B21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] md:hidden dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5 ring-1 ring-[#E0E5E7] dark:ring-[#222D34]">
            <img src="/logo.png" alt="Alpha Health Group" className="h-full w-full object-contain" />
          </div>
          <span className="truncate text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Alpha Health CRM</span>
        </div>

        <div className="hidden min-w-0 flex-1 md:block">
          <Breadcrumbs />
        </div>

        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
          {/* Global search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="group hidden h-9 items-center gap-2 rounded-lg border border-[#E0E5E7] bg-[#F0F2F5] px-2.5 text-left text-[11px] text-[#667781] transition-colors hover:border-[#128C7E] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] sm:flex dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#8696A0] dark:hover:bg-[#202C33]"
            aria-label="Open global search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Search modules…</span>
            <kbd className="ml-4 hidden rounded border border-[#E0E5E7] bg-white px-1.5 py-0.5 text-[9px] font-semibold lg:inline dark:border-[#222D34] dark:bg-[#202C33]">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0E5E7] bg-white text-[#667781] hover:bg-[#F0F2F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] sm:hidden dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#8696A0]"
            aria-label="Open global search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Company scope — read-only, server-enforced */}
          <span
            title="Company scope is enforced by the server. Change the active brand inside a module."
            className="hidden items-center gap-1.5 rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-[10px] font-semibold text-[#111B21] lg:flex dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF]"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
            {scope === 'All brands' ? 'All brands' : <CompanyTagBadge company={scope} />}
          </span>

          {/* Meta API bridge */}
          <button
            type="button"
            onClick={() => setMetaModalOpen(true)}
            title="Meta Cloud API settings and live status"
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] sm:flex dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <Radio className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
            <span className="hidden xl:inline">Meta API</span>
          </button>

          <NotificationCenter onOpenLead={onOpenLead} />

          {/* Theme Selector (3 Modes: Light, Dark, System) */}
          <div className="relative" ref={themeRef}>
            <button
              type="button"
              onClick={() => setThemeMenuOpen((v) => !v)}
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0E5E7] bg-white text-[#667781] transition-colors hover:bg-[#F0F2F5] hover:text-[#111B21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#8696A0] dark:hover:bg-[#202C33] dark:hover:text-[#E9EDEF]"
              aria-label={`Theme: currently ${theme} mode. Click to choose theme.`}
              title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} mode`}
            >
              {currentThemeIcon()}
            </button>

            {themeMenuOpen && (
              <div
                role="menu"
                aria-label="Select color theme"
                className="absolute right-0 z-[70] mt-2 w-36 overflow-hidden rounded-xl border border-[#E0E5E7] bg-white p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100 dark:border-[#222D34] dark:bg-[#202C33]"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696A0]">
                  Theme
                </div>
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setTheme(opt.id);
                        setThemeMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]',
                        isSelected
                          ? 'bg-[#DDF5EC] text-[#075E54] font-semibold dark:bg-[#005C4B] dark:text-[#E9EDEF]'
                          : 'text-[#111B21] hover:bg-[#F0F2F5] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]',
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0]')} />
                      <span>{opt.label}</span>
                      {isSelected && <Check className="ml-auto h-3 w-3 text-[#128C7E] dark:text-[#25D366]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account menu */}
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-lg border border-[#E0E5E7] bg-white p-1 pr-1.5 transition-colors hover:bg-[#F0F2F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] sm:pr-2 dark:border-[#222D34] dark:bg-[#2A3942] dark:hover:bg-[#202C33]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#128C7E] text-[11px] font-bold text-white dark:bg-[#005C4B] dark:text-[#25D366]">
                {currentUser?.fullName?.charAt(0) || 'U'}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block max-w-[110px] truncate text-[11px] font-semibold leading-tight text-[#111B21] dark:text-[#E9EDEF]">
                  {currentUser?.fullName}
                </span>
                <span className="block truncate text-[9.5px] leading-tight text-[#075E54] dark:text-[#25D366]">{roleTitle(currentUser)}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
            </button>

            {accountOpen && (
              <div
                role="menu"
                className="absolute right-0 z-[70] mt-2 w-72 overflow-hidden rounded-xl border border-[#E0E5E7] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-100 dark:border-[#222D34] dark:bg-[#202C33]"
              >
                <div className="border-b border-[#E0E5E7] px-3 py-3 dark:border-[#222D34]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DDF5EC] text-sm font-bold text-[#075E54] ring-1 ring-[#128C7E]/30 dark:bg-[#005C4B] dark:text-[#25D366] dark:ring-[#25D366]/30">
                      {currentUser?.fullName?.charAt(0) || 'U'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{currentUser?.fullName}</p>
                      <p className="truncate text-[10px] text-[#667781] dark:text-[#8696A0]">{currentUser?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="rounded bg-[#F0F2F5] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#667781] dark:bg-[#2A3942] dark:text-[#8696A0]">
                      {roleTitle(currentUser)}
                    </span>
                    {currentUser?.company && <CompanyTagBadge company={currentUser.company} />}
                    <span className="ml-auto flex items-center gap-1 text-[9.5px] text-[#128C7E] dark:text-[#25D366]">
                      <ShieldCheck className="h-3 w-3" /> Verified session
                    </span>
                  </div>
                </div>

                {isSuperAdmin && users.length > 0 && (
                  <div className="border-b border-[#E0E5E7] p-1 dark:border-[#222D34]">
                    <button
                      type="button"
                      onClick={() => setShowAccounts((v) => !v)}
                      aria-expanded={showAccounts}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#111B21] hover:bg-[#F0F2F5] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
                    >
                      <Users className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" /> Switch account
                      <ChevronDown className={cn('ml-auto h-3 w-3 transition-transform', showAccounts && 'rotate-180')} />
                    </button>
                    {showAccounts && (
                      <div className="mt-1">
                        <p className="px-2 pb-1 text-[9.5px] leading-snug text-[#667781] dark:text-[#8696A0]">
                          Selecting a team member signs you out. Sign in with their own credentials.
                        </p>
                        <div className="max-h-40 space-y-0.5 overflow-y-auto pr-0.5">
                          {users.map((u: any) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setAccountOpen(false);
                                logout();
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors',
                                currentUser?.id === u.id
                                  ? 'bg-[#DDF5EC] font-semibold text-[#075E54] dark:bg-[#005C4B] dark:text-[#E9EDEF]'
                                  : 'text-[#111B21] hover:bg-[#F0F2F5] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]',
                              )}
                            >
                              <UserRound className="h-3 w-3 shrink-0 text-[#667781] dark:text-[#8696A0]" />
                              <span className="truncate">{u.fullName}</span>
                              <span className="ml-auto shrink-0 text-[9px] text-[#667781] dark:text-[#8696A0]">{roleTitle(u)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Lock & log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <WhatsAppQrModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} />
      <MetaApiModal isOpen={metaModalOpen} onClose={() => setMetaModalOpen(false)} />
    </>
  );
};
