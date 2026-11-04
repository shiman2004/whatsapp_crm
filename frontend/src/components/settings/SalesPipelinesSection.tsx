import React, { useState, useMemo } from 'react';
import {
  Filter,
  Tag,
  Users,
  Settings as SettingsIcon,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Lock,
  ArrowUpDown,
  Info,
  RotateCcw,
  Check,
  GripVertical,
  SlidersHorizontal,
  X,
  AlertCircle,
  Building2,
  Trophy,
  Globe,
  Share2,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Percent
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';

interface SalesPipelinesProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'stages' | 'lost_reasons' | 'sources' | 'rules';

interface PipelineStageItem {
  id: string;
  name: string;
  color: string;
  probability?: number;
  isWon?: boolean;
  isLost?: boolean;
}

interface LeadSourceItem {
  id: string;
  name: string;
  channel: 'whatsapp' | 'social' | 'search' | 'referral' | 'direct' | 'web';
  color: string;
  active: boolean;
  isDefault?: boolean;
}

interface CompanyPipelinePreset {
  stages: PipelineStageItem[];
  lostReasons: { reason: string; category: string }[];
  leadSources: LeadSourceItem[];
  rules: {
    requireLostReason: boolean;
    protectWonLostStages: boolean;
    allowStageReordering: boolean;
    requireContactBeforeWon: boolean;
    enforceSequentialStages: boolean;
    staleDealDays: number;
    autoArchiveLostDays: number;
    wonNotification: boolean;
    mandatorySource: boolean;
    autoTagWhatsAppSource: boolean;
  };
}

const PIPELINE_PRESETS: Record<string, CompanyPipelinePreset> = {
  RWC: {
    stages: [
      { id: 'stage-1', name: 'New Lead', color: '#3B82F6', probability: 10, isWon: false, isLost: false },
      { id: 'stage-2', name: 'Contacted', color: '#06B6D4', probability: 25, isWon: false, isLost: false },
      { id: 'stage-3', name: 'Consultation Scheduled', color: '#8B5CF6', probability: 50, isWon: false, isLost: false },
      { id: 'stage-4', name: 'Proposal Sent', color: '#F59E0B', probability: 75, isWon: false, isLost: false },
      { id: 'stage-5', name: 'Closed Won / Registered', color: '#10B981', probability: 100, isWon: true, isLost: false },
      { id: 'stage-6', name: 'Closed Lost', color: '#EF4444', probability: 0, isWon: false, isLost: true }
    ],
    lostReasons: [
      { reason: 'Price too high / Unaffordable', category: 'Pricing' },
      { reason: 'Chose another clinic/college', category: 'Competitor' },
      { reason: 'No response after multiple follow-ups', category: 'Unresponsive' },
      { reason: 'Location too far', category: 'Logistics' },
      { reason: 'Not eligible for course/treatment', category: 'Qualification' }
    ],
    leadSources: [
      { id: 'src-1', name: 'WhatsApp Direct (+94 77 123 4567)', channel: 'whatsapp', color: '#25D366', active: true, isDefault: true },
      { id: 'src-2', name: 'Facebook & Instagram Ads', channel: 'social', color: '#1877F2', active: true },
      { id: 'src-3', name: 'Google Search & Maps', channel: 'search', color: '#EA4335', active: true },
      { id: 'src-4', name: 'Doctor & Specialist Referral', channel: 'referral', color: '#8B5CF6', active: true },
      { id: 'src-5', name: 'Walk-In Wellness Center', channel: 'direct', color: '#10B981', active: true },
      { id: 'src-6', name: 'Website Consultation Form', channel: 'web', color: '#06B6D4', active: true }
    ],
    rules: {
      requireLostReason: true,
      protectWonLostStages: true,
      allowStageReordering: true,
      requireContactBeforeWon: true,
      enforceSequentialStages: false,
      staleDealDays: 14,
      autoArchiveLostDays: 30,
      wonNotification: true,
      mandatorySource: true,
      autoTagWhatsAppSource: true
    }
  },
  CRAS: {
    stages: [
      { id: 'cras-1', name: 'New Student Enquiry', color: '#3B82F6', probability: 10, isWon: false, isLost: false },
      { id: 'cras-2', name: 'Counseling Call Completed', color: '#06B6D4', probability: 30, isWon: false, isLost: false },
      { id: 'cras-3', name: 'Campus Visit / Demo Lecture', color: '#8B5CF6', probability: 55, isWon: false, isLost: false },
      { id: 'cras-4', name: 'Application & Documents Submitted', color: '#F59E0B', probability: 80, isWon: false, isLost: false },
      { id: 'cras-5', name: 'Enrolled / Fees Paid', color: '#10B981', probability: 100, isWon: true, isLost: false },
      { id: 'cras-6', name: 'Inquiry Lost / Dropped', color: '#EF4444', probability: 0, isWon: false, isLost: true }
    ],
    lostReasons: [
      { reason: 'Course fees out of budget', category: 'Pricing' },
      { reason: 'Opted for government university', category: 'Competitor' },
      { reason: 'Failed academic prerequisites', category: 'Qualification' },
      { reason: 'Relocating overseas', category: 'Logistics' },
      { reason: 'Batch schedule time clash', category: 'Timing' }
    ],
    leadSources: [
      { id: 'cras-src-1', name: 'Admissions WhatsApp Hotline', channel: 'whatsapp', color: '#25D366', active: true, isDefault: true },
      { id: 'cras-src-2', name: 'Education Expo & Fairs', channel: 'direct', color: '#F59E0B', active: true },
      { id: 'cras-src-3', name: 'TikTok & Reels Campaigns', channel: 'social', color: '#EC4899', active: true },
      { id: 'cras-src-4', name: 'Alumni Student Referral', channel: 'referral', color: '#8B5CF6', active: true },
      { id: 'cras-src-5', name: 'Online Application Portal', channel: 'web', color: '#06B6D4', active: true },
      { id: 'cras-src-6', name: 'School Career Guidance Desk', channel: 'direct', color: '#10B981', active: true }
    ],
    rules: {
      requireLostReason: true,
      protectWonLostStages: true,
      allowStageReordering: true,
      requireContactBeforeWon: true,
      enforceSequentialStages: true,
      staleDealDays: 21,
      autoArchiveLostDays: 60,
      wonNotification: true,
      mandatorySource: true,
      autoTagWhatsAppSource: true
    }
  },
  AHC: {
    stages: [
      { id: 'ahc-1', name: 'Executive Inquiry', color: '#3B82F6', probability: 15, isWon: false, isLost: false },
      { id: 'ahc-2', name: 'Needs Assessment & Scoping', color: '#06B6D4', probability: 35, isWon: false, isLost: false },
      { id: 'ahc-3', name: 'Consultancy RFP Submitted', color: '#F59E0B', probability: 70, isWon: false, isLost: false },
      { id: 'ahc-4', name: 'Retainer Agreement Signed', color: '#10B981', probability: 100, isWon: true, isLost: false },
      { id: 'ahc-5', name: 'Engagement Closed Lost', color: '#EF4444', probability: 0, isWon: false, isLost: true }
    ],
    lostReasons: [
      { reason: 'Internal advisory selected', category: 'Competitor' },
      { reason: 'Corporate budget frozen', category: 'Pricing' },
      { reason: 'Project scope deferred to Q4', category: 'Timing' },
      { reason: 'Competitor selected', category: 'Competitor' }
    ],
    leadSources: [
      { id: 'ahc-src-1', name: 'Executive Peer Referral', channel: 'referral', color: '#8B5CF6', active: true, isDefault: true },
      { id: 'ahc-src-2', name: 'Corporate Advisory Website', channel: 'web', color: '#06B6D4', active: true },
      { id: 'ahc-src-3', name: 'LinkedIn Enterprise Outreach', channel: 'social', color: '#0A66C2', active: true },
      { id: 'ahc-src-4', name: 'Healthcare Executive Summit', channel: 'direct', color: '#F59E0B', active: true },
      { id: 'ahc-src-5', name: 'Executive Desk WhatsApp', channel: 'whatsapp', color: '#25D366', active: true }
    ],
    rules: {
      requireLostReason: true,
      protectWonLostStages: true,
      allowStageReordering: true,
      requireContactBeforeWon: true,
      enforceSequentialStages: true,
      staleDealDays: 30,
      autoArchiveLostDays: 90,
      wonNotification: true,
      mandatorySource: true,
      autoTagWhatsAppSource: true
    }
  },
  ALL: {
    stages: [
      { id: 'all-1', name: 'New Lead / Inquiry', color: '#3B82F6', probability: 10, isWon: false, isLost: false },
      { id: 'all-2', name: 'Contacted', color: '#06B6D4', probability: 25, isWon: false, isLost: false },
      { id: 'all-3', name: 'Assessment / Consultation', color: '#8B5CF6', probability: 50, isWon: false, isLost: false },
      { id: 'all-4', name: 'Proposal Sent', color: '#F59E0B', probability: 75, isWon: false, isLost: false },
      { id: 'all-5', name: 'Closed Won / Registered', color: '#10B981', probability: 100, isWon: true, isLost: false },
      { id: 'all-6', name: 'Closed Lost', color: '#EF4444', probability: 0, isWon: false, isLost: true }
    ],
    lostReasons: [
      { reason: 'Price too high / Unaffordable', category: 'Pricing' },
      { reason: 'Chose another clinic/college', category: 'Competitor' },
      { reason: 'No response after multiple follow-ups', category: 'Unresponsive' },
      { reason: 'Location too far', category: 'Logistics' },
      { reason: 'Not eligible for course/treatment', category: 'Qualification' }
    ],
    leadSources: [
      { id: 'all-src-1', name: 'WhatsApp Official Desk', channel: 'whatsapp', color: '#25D366', active: true, isDefault: true },
      { id: 'all-src-2', name: 'Meta Advertising (FB & IG)', channel: 'social', color: '#1877F2', active: true },
      { id: 'all-src-3', name: 'Google Search & SEO', channel: 'search', color: '#EA4335', active: true },
      { id: 'all-src-4', name: 'Direct Referrals', channel: 'referral', color: '#8B5CF6', active: true },
      { id: 'all-src-5', name: 'Physical Walk-In Inquiries', channel: 'direct', color: '#10B981', active: true },
      { id: 'all-src-6', name: 'Website Contact Forms', channel: 'web', color: '#06B6D4', active: true }
    ],
    rules: {
      requireLostReason: true,
      protectWonLostStages: true,
      allowStageReordering: true,
      requireContactBeforeWon: true,
      enforceSequentialStages: false,
      staleDealDays: 14,
      autoArchiveLostDays: 30,
      wonNotification: true,
      mandatorySource: true,
      autoTagWhatsAppSource: true
    }
  }
};

const STAGE_COLOR_PRESETS = [
  { label: 'Emerald', value: '#10B981' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Indigo', value: '#6366F1' }
];

const LOST_REASON_CATEGORIES = ['Pricing', 'Competitor', 'Unresponsive', 'Logistics', 'Qualification', 'Timing', 'Other'];

export const SalesPipelinesSection: React.FC<SalesPipelinesProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const { notify } = useCrm();
  const toast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'success') => {
    if (typeof notify === 'function') notify(title, message, type);
  };

  const {
    data,
    updateField,
    version,
    isLoading,
    isSaving,
    isDirty,
    error,
    saveSettings,
    discardChanges,
    conflictState
  } = useSettingsSection({
    sectionId: 'sales',
    scope: 'company',
    companyId: selectedCompanyId
  });

  const [activeTab, setActiveTab] = useState<TabType>('stages');
  
  // Pipeline active preset
  const activePreset = useMemo(() => {
    return PIPELINE_PRESETS[selectedCompanyId] || PIPELINE_PRESETS.RWC;
  }, [selectedCompanyId]);

  // Form Inputs for Stages
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#10B981');
  const [editingStage, setEditingStage] = useState<PipelineStageItem | null>(null);

  // Form Inputs for Lost Reasons
  const [newReasonText, setNewReasonText] = useState('');
  const [newReasonCategory, setNewReasonCategory] = useState('Pricing');
  const [reasonSearch, setReasonSearch] = useState('');
  const [reasonCategoryFilter, setReasonCategoryFilter] = useState('All');

  // Form Inputs for Lead Sources
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceChannel, setNewSourceChannel] = useState<'whatsapp' | 'social' | 'search' | 'referral' | 'direct' | 'web'>('whatsapp');
  const [newSourceColor, setNewSourceColor] = useState('#25D366');

  // Stages State Resolution
  const stages: PipelineStageItem[] = useMemo(() => {
    if (data && Array.isArray(data.stages) && data.stages.length > 0) {
      return data.stages;
    }
    return activePreset.stages;
  }, [data, activePreset]);

  // Lost Reasons State Resolution (accept string[] or object[])
  const lostReasons = useMemo(() => {
    if (data && Array.isArray(data.lostReasons) && data.lostReasons.length > 0) {
      return data.lostReasons.map((item: any) => {
        if (typeof item === 'string') {
          return { reason: item, category: 'General' };
        }
        return item;
      });
    }
    return activePreset.lostReasons;
  }, [data, activePreset]);

  // Lead Sources State Resolution
  const leadSources: LeadSourceItem[] = useMemo(() => {
    if (data && Array.isArray(data.leadSources) && data.leadSources.length > 0) {
      return data.leadSources;
    }
    return activePreset.leadSources;
  }, [data, activePreset]);

  // Toggle Rules State Resolution
  const requireLostReason = data?.requireLostReason !== undefined ? data.requireLostReason : activePreset.rules.requireLostReason;
  const protectWonLostStages = data?.protectWonLostStages !== undefined ? data.protectWonLostStages : activePreset.rules.protectWonLostStages;
  const allowStageReordering = data?.allowStageReordering !== undefined ? data.allowStageReordering : activePreset.rules.allowStageReordering;
  const requireContactBeforeWon = data?.requireContactBeforeWon !== undefined ? data.requireContactBeforeWon : activePreset.rules.requireContactBeforeWon;
  const enforceSequentialStages = data?.enforceSequentialStages !== undefined ? data.enforceSequentialStages : activePreset.rules.enforceSequentialStages;
  const staleDealDays = data?.staleDealDays !== undefined ? data.staleDealDays : activePreset.rules.staleDealDays;
  const autoArchiveLostDays = data?.autoArchiveLostDays !== undefined ? data.autoArchiveLostDays : activePreset.rules.autoArchiveLostDays;
  const wonNotification = data?.wonNotification !== undefined ? data.wonNotification : activePreset.rules.wonNotification;
  const mandatorySource = data?.mandatorySource !== undefined ? data.mandatorySource : activePreset.rules.mandatorySource;
  const autoTagWhatsAppSource = data?.autoTagWhatsAppSource !== undefined ? data.autoTagWhatsAppSource : activePreset.rules.autoTagWhatsAppSource;

  // Handlers for Stages
  const handleAddStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) {
      toast('Stage Name Required', 'Please provide a descriptive pipeline stage title.', 'warning');
      return;
    }

    const newStage: PipelineStageItem = {
      id: `stage-${Date.now()}`,
      name: newStageName.trim(),
      color: newStageColor,
      probability: 50,
      isWon: false,
      isLost: false
    };

    const wonIndex = stages.findIndex((s) => s.isWon);
    let updatedStages: PipelineStageItem[];
    if (wonIndex !== -1) {
      updatedStages = [...stages.slice(0, wonIndex), newStage, ...stages.slice(wonIndex)];
    } else {
      updatedStages = [...stages, newStage];
    }

    updateField('stages', updatedStages);
    setNewStageName('');
    toast('Stage Created', `Added "${newStage.name}" to pipeline stages.`);
  };

  const handleRemoveStage = (id: string) => {
    const target = stages.find((s) => s.id === id);
    if (protectWonLostStages && (target?.isWon || target?.isLost)) {
      toast('Stage Protected', 'Closed Won and Closed Lost stages are protected by pipeline rules.', 'warning');
      return;
    }

    const updated = stages.filter((s) => s.id !== id);
    updateField('stages', updated);
    toast('Stage Removed', `Removed "${target?.name || 'Stage'}" from pipeline.`);
  };

  const handleUpdateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage || !editingStage.name.trim()) return;

    const updated = stages.map((s) =>
      s.id === editingStage.id
        ? { ...s, name: editingStage.name.trim(), color: editingStage.color, probability: editingStage.probability }
        : s
    );
    updateField('stages', updated);
    setEditingStage(null);
    toast('Stage Updated', 'Pipeline stage details updated.');
  };

  const handleMoveStage = (index: number, direction: 'up' | 'down') => {
    if (!allowStageReordering) {
      toast('Action Locked', 'Stage reordering is disabled by pipeline rules.', 'warning');
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    if (protectWonLostStages) {
      if (stages[index].isWon || stages[index].isLost || stages[targetIndex].isWon || stages[targetIndex].isLost) {
        toast('Stage Protected', 'Won and Lost stages must remain at the end of the funnel.', 'warning');
        return;
      }
    }

    const updated = [...stages];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updateField('stages', updated);
  };

  // Handlers for Lost Reasons
  const handleAddReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReasonText.trim()) return;
    const updated = [...lostReasons, { reason: newReasonText.trim(), category: newReasonCategory }];
    updateField('lostReasons', updated);
    setNewReasonText('');
    toast('Reason Added', `Added lost reason under "${newReasonCategory}".`);
  };

  const handleRemoveReason = (index: number) => {
    const updated = lostReasons.filter((_, i) => i !== index);
    updateField('lostReasons', updated);
    toast('Reason Removed', 'Deal lost reason removed.');
  };

  // Handlers for Lead Sources
  const handleAddLeadSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) {
      toast('Name Required', 'Please enter a name for the lead source.', 'warning');
      return;
    }
    const newSource: LeadSourceItem = {
      id: `src-${Date.now()}`,
      name: newSourceName.trim(),
      channel: newSourceChannel,
      color: newSourceColor,
      active: true,
      isDefault: false
    };
    const updated = [...leadSources, newSource];
    updateField('leadSources', updated);
    setNewSourceName('');
    toast('Source Added', `Added "${newSource.name}" to acquisition channels.`);
  };

  const handleToggleLeadSource = (id: string) => {
    const updated = leadSources.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    updateField('leadSources', updated);
    toast('Status Updated', 'Lead source active state toggled.');
  };

  const handleRemoveLeadSource = (id: string) => {
    const target = leadSources.find((s) => s.id === id);
    if (target?.isDefault) {
      toast('Protected Source', 'The default company acquisition channel cannot be deleted.', 'warning');
      return;
    }
    const updated = leadSources.filter((s) => s.id !== id);
    updateField('leadSources', updated);
    toast('Source Removed', 'Acquisition channel removed.');
  };

  const handleManualSave = async () => {
    try {
      await saveSettings();
      toast('Pipeline Settings Saved', 'Stages, lost reasons, sources, and governance rules synchronized.');
    } catch (err: any) {
      toast('Save Failed', err.message || 'Unable to persist changes.', 'warning');
    }
  };

  const handleManualReset = () => {
    updateField('stages', activePreset.stages);
    updateField('lostReasons', activePreset.lostReasons);
    updateField('leadSources', activePreset.leadSources);
    updateField('requireLostReason', activePreset.rules.requireLostReason);
    updateField('protectWonLostStages', activePreset.rules.protectWonLostStages);
    updateField('allowStageReordering', activePreset.rules.allowStageReordering);
    updateField('requireContactBeforeWon', activePreset.rules.requireContactBeforeWon);
    updateField('enforceSequentialStages', activePreset.rules.enforceSequentialStages);
    updateField('staleDealDays', activePreset.rules.staleDealDays);
    updateField('autoArchiveLostDays', activePreset.rules.autoArchiveLostDays);
    updateField('wonNotification', activePreset.rules.wonNotification);
    updateField('mandatorySource', activePreset.rules.mandatorySource);
    updateField('autoTagWhatsAppSource', activePreset.rules.autoTagWhatsAppSource);
    toast('Defaults Restored', `Pipeline settings reset to default for ${selectedCompanyId}.`, 'info');
  };

  // Filtered reasons
  const filteredLostReasons = useMemo(() => {
    return lostReasons.filter((item) => {
      const matchesSearch = item.reason.toLowerCase().includes(reasonSearch.toLowerCase());
      const matchesCat = reasonCategoryFilter === 'All' || item.category === reasonCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [lostReasons, reasonSearch, reasonCategoryFilter]);

  if (isLoading) {
    return (
      <SettingsLayout
        currentSectionId={currentSectionId}
        onSelectSection={onSelectSection}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
      >
        <div className="flex items-center justify-center h-64 text-[#667781] dark:text-[#8696A0]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#128C7E] dark:border-[#25D366] mr-3" />
          <span>Loading pipeline configuration...</span>
        </div>
      </SettingsLayout>
    );
  }

  // Common Building Graphic
  const BuildingIllustration = () => (
    <div className="relative rounded-2xl overflow-hidden border border-[#E0E5E7] dark:border-[#222D34] bg-gradient-to-b from-[#112229] via-[#0E1A1F] to-[#0A1317] p-5 shadow-sm text-center">
      <div className="relative z-10 py-4 flex flex-col items-center">
        <div className="h-28 w-full max-w-[220px] relative flex items-center justify-center">
          <svg viewBox="0 0 200 120" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="50" r="45" fill="#128C7E" fillOpacity="0.2" filter="blur(20px)" />
            <rect x="40" y="35" width="120" height="75" rx="6" fill="#182A32" stroke="#25D366" strokeOpacity="0.4" strokeWidth="1.5" />
            <rect x="52" y="55" width="28" height="55" rx="3" fill="#203640" stroke="#355866" strokeWidth="1" />
            <rect x="120" y="55" width="28" height="55" rx="3" fill="#203640" stroke="#355866" strokeWidth="1" />
            <rect x="86" y="65" width="28" height="45" rx="2" fill="#2CE58B" fillOpacity="0.25" stroke="#25D366" strokeWidth="1.5" />
            <line x1="100" y1="65" x2="100" y2="110" stroke="#25D366" strokeWidth="1" />
            <path
              d="M100 20C100 20 105 28 111 31C117 34 119 40 114 45C109 50 100 52 100 52C100 52 91 50 86 45C81 40 83 34 89 31C95 28 100 20 100 20Z"
              fill="#25D366"
              fillOpacity="0.8"
            />
            <ellipse cx="35" cy="110" rx="15" ry="6" fill="#0D5C4A" />
            <ellipse cx="165" cy="110" rx="15" ry="6" fill="#0D5C4A" />
          </svg>
        </div>
        <h4 className="text-xs font-bold text-white tracking-wide mt-2">
          {selectedCompanyId === 'CRAS' ? 'CRAS Academic Tower' : selectedCompanyId === 'AHC' ? 'Alpha Health World Trade Center' : 'Royal Wellness Center Colombo Flagship'}
        </h4>
        <p className="text-[10px] text-emerald-400 mt-0.5">
          Live Enterprise Multi-Brand Pipeline
        </p>
      </div>
    </div>
  );

  return (
    <SettingsLayout
      currentSectionId={currentSectionId}
      onSelectSection={onSelectSection}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={onSelectCompany}
      isDirty={isDirty}
      isSaving={isSaving}
      version={version}
      conflictState={conflictState}
      onSave={handleManualSave}
      onDiscard={discardChanges}
    >
      <div className="w-full space-y-5">
        {error && (
          <div className="p-4 rounded-xl bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Navigation Tab Bar */}
        <div className="flex items-center space-x-1 border-b border-[#E0E5E7] dark:border-[#222D34] pb-px overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('stages')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'stages'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Pipeline Stages</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lost_reasons')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'lost_reasons'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Tag className="h-4 w-4" />
            <span>Lost Reasons</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sources')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'sources'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Lead Sources</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'rules'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Conversion Rules</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PIPELINE STAGES VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'stages' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN: Pipeline Stages + Lost Reasons Preview (col-span-8) */}
            <div className="lg:col-span-8 space-y-5">
              {/* CARD 1: PIPELINE STAGES */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">Pipeline Stages</h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Define and manage the stages of your deal pipeline. Drag to reorder, edit stage details, or add new stages.
                    </p>
                  </div>
                </div>

                {/* Add Stage Form */}
                <form onSubmit={handleAddStage} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Add stage name (e.g. Lab Assessment Pending)"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  {/* Color Selector Pill */}
                  <div className="flex items-center space-x-2 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 shrink-0">
                    <span
                      className="h-3.5 w-6 rounded-md shadow-xs"
                      style={{ backgroundColor: newStageColor }}
                    />
                    <select
                      value={newStageColor}
                      onChange={(e) => setNewStageColor(e.target.value)}
                      className="bg-transparent text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold focus:outline-none cursor-pointer"
                    >
                      {STAGE_COLOR_PRESETS.map((color) => (
                        <option key={color.value} value={color.value} className="bg-white dark:bg-[#202C33]">
                          {color.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Stage</span>
                  </button>
                </form>

                {/* Stages List */}
                <div className="space-y-2">
                  {stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 flex items-center justify-between transition-colors group hover:border-[#128C7E]/30"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Drag Handle & Reorder */}
                        <div className="flex items-center space-x-1 text-[#667781] dark:text-[#8696A0]">
                          <GripVertical className="h-3.5 w-3.5" />
                          <span className="font-mono text-xs font-bold">#{index + 1}</span>
                        </div>

                        {/* Color indicator dot */}
                        <span
                          className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: stage.color || '#10B981' }}
                        />

                        {/* Stage Name */}
                        <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] truncate">
                          {stage.name}
                        </span>

                        {/* Won / Lost Badge */}
                        {stage.isWon && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                            <Trophy className="h-3 w-3" />
                            <span>Won Stage</span>
                          </span>
                        )}

                        {stage.isLost && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
                            <span>⊗ Lost Stage</span>
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {allowStageReordering && (
                          <div className="hidden sm:flex items-center space-x-0.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveStage(index, 'up')}
                              className="p-1 rounded text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                              title="Move Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={index === stages.length - 1}
                              onClick={() => handleMoveStage(index, 'down')}
                              className="p-1 rounded text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                              title="Move Down"
                            >
                              ▼
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setEditingStage(stage)}
                          className="p-1.5 rounded-lg text-[#667781] hover:text-[#128C7E] dark:text-[#8696A0] dark:hover:text-[#25D366] hover:bg-[#E0E5E7]/50 dark:hover:bg-[#2A3942]/50 transition-colors cursor-pointer"
                          title="Edit Stage"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveStage(stage.id)}
                          disabled={protectWonLostStages && (stage.isWon || stage.isLost)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            protectWonLostStages && (stage.isWon || stage.isLost)
                              ? 'text-[#667781]/40 dark:text-[#8696A0]/30 cursor-not-allowed'
                              : 'text-[#667781] hover:text-rose-500 dark:text-[#8696A0] dark:hover:text-rose-400 hover:bg-rose-500/10'
                          }`}
                          title={protectWonLostStages && (stage.isWon || stage.isLost) ? 'Protected Terminal Stage' : 'Delete Stage'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CARD 2: STANDARD DEAL LOST REASONS PREVIEW */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Standard Deal Lost Reasons
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Standardized dropdown reasons required when marking a lead as Lost.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lost_reasons')}
                    className="text-xs font-bold text-[#128C7E] dark:text-[#25D366] hover:underline cursor-pointer"
                  >
                    Manage all ({lostReasons.length}) →
                  </button>
                </div>

                {/* Add Reason Form */}
                <form onSubmit={handleAddReason} className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="Add lost reason (e.g. Relocating abroad)"
                    value={newReasonText}
                    onChange={(e) => setNewReasonText(e.target.value)}
                    className="flex-1 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Reason</span>
                  </button>
                </form>

                {/* 2-Column Grid of Lost Reasons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {lostReasons.slice(0, 6).map((item, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 flex items-center justify-between text-xs text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/30 transition-colors"
                    >
                      <span className="font-medium truncate pr-2">{item.reason}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveReason(index)}
                        className="p-1 rounded text-[#667781] hover:text-rose-500 dark:text-[#8696A0] dark:hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
                        title="Remove Reason"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Pipeline Rules Preview + Aesthetic Illustration (col-span-4) */}
            <div className="lg:col-span-4 space-y-5">
              {/* CARD: PIPELINE RULES */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">Pipeline Rules</h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Control key behaviors and protections for your pipeline.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('rules')}
                    className="text-xs font-bold text-[#128C7E] dark:text-[#25D366] hover:underline cursor-pointer"
                  >
                    View all →
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Rule 1: Require lost reason */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                        <Tag className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Require lost reason</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Always ask for a reason when marking a deal as Lost.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateField('requireLostReason', !requireLostReason)}
                      className="focus:outline-none cursor-pointer"
                    >
                      <div
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                          requireLostReason ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            requireLostReason ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  {/* Rule 2: Protect won/lost stages */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Protect won/lost stages</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Prevent editing or deleting of Closed Won/Lost stages.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateField('protectWonLostStages', !protectWonLostStages)}
                      className="focus:outline-none cursor-pointer"
                    >
                      <div
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                          protectWonLostStages ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            protectWonLostStages ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  {/* Rule 3: Allow stage reordering */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Allow stage reordering</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Let admins reorder pipeline stages by drag and drop.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateField('allowStageReordering', !allowStageReordering)}
                      className="focus:outline-none cursor-pointer"
                    >
                      <div
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                          allowStageReordering ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            allowStageReordering ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  {/* Tip Box */}
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start space-x-2.5 text-xs text-blue-600 dark:text-blue-400">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Tip:</strong> Won/Lost stages are treated as final stages for reporting and conversion tracking.
                    </p>
                  </div>
                </div>
              </div>

              {/* Aesthetic Illustration */}
              <BuildingIllustration />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LOST REASONS MANAGEMENT VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'lost_reasons' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Standard Deal Lost Reasons
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Categorized rejection reasons required when marking a lead or deal as Lost.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366]">
                    {lostReasons.length} Configured
                  </span>
                </div>

                {/* Search & Category Filter */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667781] dark:text-[#8696A0]" />
                    <input
                      type="text"
                      placeholder="Search lost reasons..."
                      value={reasonSearch}
                      onChange={(e) => setReasonSearch(e.target.value)}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-[#667781] dark:text-[#8696A0]">Category:</span>
                    <select
                      value={reasonCategoryFilter}
                      onChange={(e) => setReasonCategoryFilter(e.target.value)}
                      className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="All">All Categories</option>
                      {LOST_REASON_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Add Reason Form with Category */}
                <form onSubmit={handleAddReason} className="flex flex-col sm:flex-row gap-2.5 p-3 rounded-xl bg-[#F0F2F5]/50 dark:bg-[#111B21]/50 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <input
                    type="text"
                    placeholder="New lost reason (e.g. Schedule mismatch with work shifts)"
                    value={newReasonText}
                    onChange={(e) => setNewReasonText(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                  <select
                    value={newReasonCategory}
                    onChange={(e) => setNewReasonCategory(e.target.value)}
                    className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold focus:outline-none cursor-pointer"
                  >
                    {LOST_REASON_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Reason</span>
                  </button>
                </form>

                {/* List of Reasons */}
                <div className="space-y-2">
                  {filteredLostReasons.map((item, index) => (
                    <div
                      key={index}
                      className="p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 flex items-center justify-between text-xs text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/30 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E0E5E7] dark:bg-[#2A3942] text-[#667781] dark:text-[#8696A0]">
                          {item.category || 'General'}
                        </span>
                        <span className="font-semibold truncate">{item.reason}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReason(index)}
                        className="p-1.5 rounded-lg text-[#667781] hover:text-rose-500 dark:text-[#8696A0] dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                        title="Remove Reason"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {filteredLostReasons.length === 0 && (
                    <div className="text-center py-8 text-xs text-[#667781] dark:text-[#8696A0]">
                      No lost reasons found matching "{reasonSearch}".
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Policies & Analytics */}
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <ShieldCheck className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Win/Loss Enforcement</h4>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div>
                      <h5 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Mandatory Reason</h5>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Cannot close deal as lost without selecting a reason.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('requireLostReason', !requireLostReason)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${requireLostReason ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${requireLostReason ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Accurate lost reasons feed into marketing re-engagement campaigns and clinical objection handling training.
                  </p>
                </div>
              </div>

              <BuildingIllustration />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LEAD SOURCES & ATTRIBUTION VIEW */}
        {/* ========================================================================= */}
        {activeTab === 'sources' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Inbound Lead Sources & Channels
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Manage attribution sources for incoming leads across marketing campaigns, WhatsApp, and referrals.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366]">
                    {leadSources.filter((s) => s.active).length} Active Channels
                  </span>
                </div>

                {/* Add Lead Source Form */}
                <form onSubmit={handleAddLeadSource} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-[#F0F2F5]/50 dark:bg-[#111B21]/50 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <input
                    type="text"
                    placeholder="Source Name (e.g. TikTok Influencer Campaign)"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                  <select
                    value={newSourceChannel}
                    onChange={(e: any) => setNewSourceChannel(e.target.value)}
                    className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="whatsapp">WhatsApp Direct</option>
                    <option value="social">Social Media Ads</option>
                    <option value="search">Search Engine / SEO</option>
                    <option value="referral">Doctor / Peer Referral</option>
                    <option value="direct">Physical Walk-in</option>
                    <option value="web">Web Booking Form</option>
                  </select>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Source</span>
                  </button>
                </form>

                {/* Sources List */}
                <div className="space-y-2">
                  {leadSources.map((source) => (
                    <div
                      key={source.id}
                      className="p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 flex items-center justify-between text-xs text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/30 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: source.color || '#128C7E' }}
                        >
                          {source.channel === 'whatsapp' ? (
                            <MessageSquare className="h-3.5 w-3.5" />
                          ) : source.channel === 'social' ? (
                            <Share2 className="h-3.5 w-3.5" />
                          ) : source.channel === 'search' ? (
                            <Search className="h-3.5 w-3.5" />
                          ) : (
                            <Globe className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold truncate">{source.name}</span>
                            {source.isDefault && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#128C7E]/10 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#667781] dark:text-[#8696A0] capitalize">
                            Channel: {source.channel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleLeadSource(source.id)}
                          className="cursor-pointer"
                          title="Toggle Active Status"
                        >
                          <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${source.active ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${source.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveLeadSource(source.id)}
                          disabled={source.isDefault}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            source.isDefault
                              ? 'text-[#667781]/40 dark:text-[#8696A0]/30 cursor-not-allowed'
                              : 'text-[#667781] hover:text-rose-500 dark:text-[#8696A0] dark:hover:text-rose-400 hover:bg-rose-500/10'
                          }`}
                          title={source.isDefault ? 'Protected Default Channel' : 'Delete Channel'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Attribution Governance */}
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <ShieldCheck className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Attribution Rules</h4>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div>
                      <h5 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Mandatory Source</h5>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Every new lead must have an attributed channel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('mandatorySource', !mandatorySource)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${mandatorySource ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${mandatorySource ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div>
                      <h5 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Auto-Tag WhatsApp</h5>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Auto-attribute WhatsApp Direct to new inbound numbers.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('autoTagWhatsAppSource', !autoTagWhatsAppSource)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${autoTagWhatsAppSource ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoTagWhatsAppSource ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <BuildingIllustration />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CONVERSION RULES VIEW (The tab highlighted by user!) */}
        {/* ========================================================================= */}
        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Stage Gates & Automation Lifecycles */}
            <div className="lg:col-span-8 space-y-5">
              {/* CARD 1: STAGE GATES & FUNNEL PROTECTIONS */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Pipeline Governance & Stage Gates
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Configure mandatory criteria, terminal stage locks, and conversion guardrails.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {/* Rule 1: Require lost reason */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                        <Tag className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Require lost reason</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                          Mandate coordinators to choose a standardized lost reason before marking a lead as Lost.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('requireLostReason', !requireLostReason)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${requireLostReason ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${requireLostReason ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Rule 2: Protect won/lost stages */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Protect won/lost stages</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                          Prevent accidental editing or deletion of Closed Won and Closed Lost terminal pipeline stages.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('protectWonLostStages', !protectWonLostStages)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${protectWonLostStages ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${protectWonLostStages ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Rule 3: Allow stage reordering */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Allow stage reordering</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                          Enable coordinators and admins to drag and rearrange funnel stage sequence.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('allowStageReordering', !allowStageReordering)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${allowStageReordering ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${allowStageReordering ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Rule 4: Require contact details before Won */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Require contact details before Won</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                          Mandate verified telephone number and patient/student email before moving deal to Closed Won.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('requireContactBeforeWon', !requireContactBeforeWon)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${requireContactBeforeWon ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${requireContactBeforeWon ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Rule 5: Enforce sequential stage advancement */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-start space-x-3">
                      <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Enforce sequential progression</h4>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                          Prevent skipping key funnel stages (leads cannot jump directly from New to Closed Won).
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('enforceSequentialStages', !enforceSequentialStages)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${enforceSequentialStages ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enforceSequentialStages ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 2: DEAL INACTIVITY & AUTO-CLOSE TIMERS */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Lifecycle Timers & Inactivity Rules
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Automated warning triggers for stagnant leads and archival rules.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                    <label className="block text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Flag Stale Deals After (Days)
                    </label>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      Highlight leads that have no coordinator communication or notes.
                    </p>
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={staleDealDays}
                        onChange={(e) => updateField('staleDealDays', parseInt(e.target.value) || 14)}
                        className="w-24 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                      />
                      <span className="text-xs text-[#667781] dark:text-[#8696A0] font-medium">days without activity</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                    <label className="block text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Auto-Archive Lost Deals (Days)
                    </label>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      Move Closed Lost inquiries to cold archive storage.
                    </p>
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="number"
                        min="7"
                        max="365"
                        value={autoArchiveLostDays}
                        onChange={(e) => updateField('autoArchiveLostDays', parseInt(e.target.value) || 30)}
                        className="w-24 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                      />
                      <span className="text-xs text-[#667781] dark:text-[#8696A0] font-medium">days in lost stage</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <div className="flex items-start space-x-3">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Won Stage Team Notification</h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        Automatically broadcast deal closure celebrations to internal coordinator feed.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('wonNotification', !wonNotification)}
                    className="cursor-pointer"
                  >
                    <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${wonNotification ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${wonNotification ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Stage Probability & Facility Illustration */}
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <TrendingUp className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Stage Probability Weights</h4>
                </div>

                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                  Target forecast probabilities applied to pipeline value calculations.
                </p>

                <div className="space-y-2">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      className="p-2.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">{stage.name}</span>
                      </div>
                      <span className="font-bold font-mono text-[#128C7E] dark:text-[#25D366]">
                        {stage.probability !== undefined ? stage.probability : stage.isWon ? 100 : stage.isLost ? 0 : 50}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start space-x-2 text-xs text-blue-600 dark:text-blue-400">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Tip:</strong> Won/Lost stages are treated as final stages for reporting and conversion tracking.
                  </p>
                </div>
              </div>

              <BuildingIllustration />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BOTTOM ACTION BAR */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E0E5E7] dark:border-[#222D34]">
          <button
            type="button"
            onClick={handleManualReset}
            className="px-4 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center space-x-1.5 hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODAL: EDIT STAGE */}
        {/* ========================================================================= */}
        {editingStage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366]">
                    <Edit2 className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Edit Pipeline Stage</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingStage(null)}
                  className="text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateStage} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    Stage Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStage.name}
                    onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    Stage Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <span
                      className="h-7 w-12 rounded-lg shadow-xs"
                      style={{ backgroundColor: editingStage.color }}
                    />
                    <select
                      value={editingStage.color}
                      onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    >
                      {STAGE_COLOR_PRESETS.map((c) => (
                        <option key={c.value} value={c.value} className="bg-white dark:bg-[#202C33]">
                          {c.label} ({c.value})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    Forecast Probability (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingStage.probability !== undefined ? editingStage.probability : 50}
                    onChange={(e) => setEditingStage({ ...editingStage, probability: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E0E5E7] dark:border-[#222D34]">
                  <button
                    type="button"
                    onClick={() => setEditingStage(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Save Stage
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
};

export default SalesPipelinesSection;