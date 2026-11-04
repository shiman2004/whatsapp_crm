import React from 'react';
import {
  Building2,
  Users,
  ShieldCheck,
  MessageSquare,
  KanbanSquare,
  Megaphone,
  Stethoscope,
  GraduationCap,
  Zap,
  Mail,
  FileEdit,
  Code2,
  Lock,
  HardDrive,
  Activity,
  BarChart3,
  Palette,
  AlertTriangle,
  RotateCw,
  Save,
  Undo2,
  ShieldAlert
} from 'lucide-react';
import {
  SETTINGS_SECTIONS,
  SettingsSectionMeta
} from './types';
import { useCrm } from '../../context/CrmContext';

interface SettingsLayoutProps {
  currentSectionId: string;
  onSelectSection: (sectionId: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  isDirty?: boolean;
  isSaving?: boolean;
  version?: number;
  conflictState?: {
    isOpen: boolean;
    serverVersion: number;
    onReload: () => void;
    onDismiss: () => void;
  };
  onSave?: () => void;
  onDiscard?: () => void;
  children: React.ReactNode;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Building2,
  Users,
  ShieldCheck,
  MessageSquare,
  KanbanSquare,
  Megaphone,
  Stethoscope,
  GraduationCap,
  Zap,
  Mail,
  FileEdit,
  Code2,
  Lock,
  HardDrive,
  Activity,
  BarChart3,
  Palette
};

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany,
  isDirty = false,
  isSaving = false,
  version = 1,
  conflictState,
  onSave,
  onDiscard,
  children
}) => {
  const { currentUser } = useCrm();

  const activeMeta = SETTINGS_SECTIONS.find(s => s.id === currentSectionId) || SETTINGS_SECTIONS[0];
  const ActiveIcon = ICON_MAP[activeMeta.iconName] || Building2;

  return (
    <div className="flex flex-col h-full w-full bg-[#F5F7F8] dark:bg-[#111B21] text-[#111B21] dark:text-[#E9EDEF] overflow-hidden font-sans transition-colors">
      {/* Clean Top Header Bar */}
      <header className="h-16 flex-shrink-0 border-b border-[#E0E5E7] dark:border-[#222D34] px-6 flex items-center justify-between bg-white dark:bg-[#202C33] shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="h-9 w-9 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/50 border border-[#128C7E]/20 dark:border-[#25D366]/20 flex items-center justify-center text-[#128C7E] dark:text-[#25D366] shadow-sm shrink-0">
            <ActiveIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">{activeMeta.label}</h1>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">{activeMeta.shortDesc}</p>
          </div>
        </div>

        {/* Company Scope Selector in the top bar */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 shadow-inner">
            <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Active Scope:</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => onSelectCompany(e.target.value)}
              className="bg-transparent text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-[#202C33]">🌐 Global (All Companies)</option>
              <option value="RWC" className="bg-white dark:bg-[#202C33]">🏥 Royal Wellness Center (RWC)</option>
              <option value="CRAS" className="bg-white dark:bg-[#202C33]">🎓 CRAS Academic (CRAS)</option>
              <option value="AHC" className="bg-white dark:bg-[#202C33]">💼 Alpha Health Consultancy (AHC)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F5F7F8] dark:bg-[#111B21]">
        {/* Dynamic Form View Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar relative">
          <div className="w-full space-y-6">
            {children}
          </div>
        </div>

        {/* Sticky Unsaved Changes Footer */}
        {isDirty && (
          <div className="flex-shrink-0 border-t border-amber-500/40 bg-white/95 dark:bg-[#202C33]/95 backdrop-blur-md px-6 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400/40">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Unsaved Changes Detected</p>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">You have unsaved changes in this module. Discarding will revert to server version {version}.</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onDiscard}
                disabled={isSaving}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-white bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Discard</span>
              </button>

              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] active:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-lg shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Optimistic Lock Conflict Resolution Modal (409 Conflict) */}
        {conflictState?.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#202C33] border border-red-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
                <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-500/20 border border-red-500/30">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">Concurrent Edit Conflict (409)</h3>
                  <p className="text-xs text-red-600 dark:text-red-300">Settings were updated by another administrator</p>
                </div>
              </div>

              <div className="p-3.5 bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl border border-[#E0E5E7] dark:border-[#222D34] text-xs space-y-1.5 text-[#111B21] dark:text-[#E9EDEF]">
                <p>
                  Your form is based on <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">version {version}</span>, but the database now contains <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">version {conflictState.serverVersion}</span>.
                </p>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                  To prevent overwriting another administrator's configuration changes, please reload the latest settings.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={conflictState.onDismiss}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-white transition-colors"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={conflictState.onReload}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-md flex items-center space-x-1.5"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Reload Latest (v{conflictState.serverVersion})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
