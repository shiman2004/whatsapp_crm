import React, { useState, useMemo, useRef } from 'react';
import {
  Building2,
  MapPin,
  Clock,
  Globe,
  Upload,
  Plus,
  Trash2,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  Check,
  Eye,
  Edit2,
  Image as ImageIcon,
  Layers,
  Network,
  Search,
  FileSpreadsheet,
  Users,
  X,
  AlertCircle,
  FileText,
  DollarSign,
  GraduationCap,
  Award,
  Briefcase
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';

interface CompanySettingsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'profile' | 'branches' | 'hours' | 'localization' | 'branding' | 'scope';

interface BranchItem {
  id: string;
  name: string;
  subtitle?: string;
  code: string;
  city: string;
  phone: string;
  active: boolean;
  address?: string;
  capacity?: number;
}

interface CompanyProfilePreset {
  companyName: string;
  shortName: string;
  tagline: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  companyType: string;
  incorporatedOn: string;
  registrationStatus: string;
  primaryBusiness: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  fiscalYearStart: string;
  brandColor: string;
  branches: BranchItem[];
}

const COMPANY_PRESETS: Record<string, CompanyProfilePreset> = {
  RWC: {
    companyName: 'Royal Wellness Center (Pvt) Ltd',
    shortName: 'RWC',
    tagline: 'Royal Wellness Center',
    taxId: 'PV-98124-LK',
    email: 'contact@royalwellness.lk',
    phone: '+94 11234 5678',
    address: 'No. 12, Alfred House Gardens, Colombo 03, Sri Lanka',
    companyType: 'Private Limited',
    incorporatedOn: 'Jan 15, 2018',
    registrationStatus: 'Registered',
    primaryBusiness: 'Wellness & Aesthetics',
    currency: 'LKR',
    timezone: 'Asia/Colombo',
    dateFormat: 'YYYY-MM-DD',
    fiscalYearStart: 'January',
    brandColor: '#128C7E',
    branches: [
      {
        id: 'rwc-1',
        name: 'RWC - Head Office',
        subtitle: 'Main branch & administration',
        code: 'RWC-HO',
        city: 'Colombo 03',
        phone: '+94 11234 5678',
        active: true,
        address: 'No. 12, Alfred House Gardens, Colombo 03',
        capacity: 45
      },
      {
        id: 'rwc-2',
        name: 'RWC - Negombo',
        subtitle: 'Wellness & treatment center',
        code: 'RWC-NGB',
        city: 'Negombo',
        phone: '+94 31222 4455',
        active: true,
        address: 'Beach Road, Negombo',
        capacity: 25
      },
      {
        id: 'rwc-3',
        name: 'RWC - Kandy',
        subtitle: 'Regional wellness center',
        code: 'RWC-KDY',
        city: 'Kandy',
        phone: '+94 81222 6677',
        active: false,
        address: 'Peradeniya Road, Kandy',
        capacity: 20
      }
    ]
  },
  CRAS: {
    companyName: 'College of Royal Aesthetic of Sri Lanka (Pvt) Ltd',
    shortName: 'CRAS',
    tagline: 'College of Royal Aesthetic',
    taxId: 'PV-104882-LK',
    email: 'admissions@cras.edu.lk',
    phone: '+94 11456 7890',
    address: 'Level 4, CRAS Academic Tower, Colombo 04, Sri Lanka',
    companyType: 'Higher Education Institute',
    incorporatedOn: 'Mar 22, 2020',
    registrationStatus: 'Accredited (TVEC)',
    primaryBusiness: 'Cosmetic & Aesthetic Education',
    currency: 'LKR',
    timezone: 'Asia/Colombo',
    dateFormat: 'DD/MM/YYYY',
    fiscalYearStart: 'April',
    brandColor: '#2563EB',
    branches: [
      {
        id: 'cras-1',
        name: 'CRAS - Main Campus',
        subtitle: 'Lecture halls & simulation lab',
        code: 'CRAS-MC',
        city: 'Colombo 04',
        phone: '+94 11456 7890',
        active: true,
        address: 'Level 4, CRAS Academic Tower, Colombo 04',
        capacity: 120
      },
      {
        id: 'cras-2',
        name: 'CRAS - Clinical Training Wing',
        subtitle: 'Hands-on practicals & viva facility',
        code: 'CRAS-CTW',
        city: 'Colombo 03',
        phone: '+94 11456 7892',
        active: true,
        address: 'No. 18, Duplication Road, Colombo 03',
        capacity: 60
      },
      {
        id: 'cras-3',
        name: 'CRAS - Northern Examination Center',
        subtitle: 'Regional assessment & proctoring hub',
        code: 'CRAS-NEC',
        city: 'Jaffna',
        phone: '+94 21222 1100',
        active: true,
        address: 'Hospital Road, Jaffna',
        capacity: 40
      }
    ]
  },
  AHC: {
    companyName: 'Alpha Health Group Consultancy (Pvt) Ltd',
    shortName: 'AHC',
    tagline: 'Alpha Health Consultancy',
    taxId: 'PV-77621-LK',
    email: 'corporate@alphahealth.lk',
    phone: '+94 11789 0123',
    address: 'Level 15, World Trade Center, Colombo 01, Sri Lanka',
    companyType: 'Corporate Advisory',
    incorporatedOn: 'Aug 10, 2016',
    registrationStatus: 'Registered',
    primaryBusiness: 'Healthcare Strategy & Consulting',
    currency: 'USD',
    timezone: 'Asia/Colombo',
    dateFormat: 'YYYY-MM-DD',
    fiscalYearStart: 'January',
    brandColor: '#7C3AED',
    branches: [
      {
        id: 'ahc-1',
        name: 'AHC - Corporate Headquarters',
        subtitle: 'Executive offices & boardrooms',
        code: 'AHC-HQ',
        city: 'Colombo 01',
        phone: '+94 11789 0123',
        active: true,
        address: 'Level 15, West Tower, WTC, Colombo 01',
        capacity: 50
      },
      {
        id: 'ahc-2',
        name: 'AHC - Operations Hub',
        subtitle: 'Client advisory & audit suites',
        code: 'AHC-OPS',
        city: 'Rajagiriya',
        phone: '+94 11789 0125',
        active: true,
        address: 'Parliament Road, Rajagiriya',
        capacity: 35
      }
    ]
  },
  ALL: {
    companyName: 'Alpha Health Group Holdings (Pvt) Ltd',
    shortName: 'AHG',
    tagline: 'Alpha Health Group Multi-Brand Hub',
    taxId: 'PV-00120-LK',
    email: 'governance@alphahealthgroup.lk',
    phone: '+94 11789 0000',
    address: 'Alpha Health Towers, Colombo 03, Sri Lanka',
    companyType: 'Parent Conglomerate',
    incorporatedOn: 'May 05, 2015',
    registrationStatus: 'Group Master',
    primaryBusiness: 'Healthcare, Education & Clinical Operations',
    currency: 'LKR',
    timezone: 'Asia/Colombo',
    dateFormat: 'YYYY-MM-DD',
    fiscalYearStart: 'January',
    brandColor: '#128C7E',
    branches: [
      {
        id: 'all-1',
        name: 'RWC - Head Office',
        subtitle: 'Main wellness facility & admin',
        code: 'RWC-HO',
        city: 'Colombo 03',
        phone: '+94 11234 5678',
        active: true,
        address: 'Colombo 03',
        capacity: 45
      },
      {
        id: 'all-2',
        name: 'CRAS - Main Academic Campus',
        subtitle: 'Lecture halls & simulation lab',
        code: 'CRAS-MC',
        city: 'Colombo 04',
        phone: '+94 11456 7890',
        active: true,
        address: 'Colombo 04',
        capacity: 120
      },
      {
        id: 'all-3',
        name: 'AHC - Corporate Headquarters',
        subtitle: 'Executive offices & boardrooms',
        code: 'AHC-HQ',
        city: 'Colombo 01',
        phone: '+94 11789 0123',
        active: true,
        address: 'Colombo 01',
        capacity: 50
      }
    ]
  }
};

export const CompanyBranchSection: React.FC<CompanySettingsProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const { notify } = useCrm();
  const toast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'success') => {
    if (typeof notify === 'function') {
      notify(title, message, type);
    }
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
    sectionId: 'company',
    scope: 'company',
    companyId: selectedCompanyId
  });

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [branchSearch, setBranchSearch] = useState('');
  
  // Modals State
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [viewingBranch, setViewingBranch] = useState<BranchItem | null>(null);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);

  // Active Company Preset based on current selectedCompanyId scope
  const activePreset: CompanyProfilePreset = useMemo(() => {
    return COMPANY_PRESETS[selectedCompanyId] || COMPANY_PRESETS.RWC;
  }, [selectedCompanyId]);

  // Form State for Add / Edit Branch
  const [branchForm, setBranchForm] = useState<{
    name: string;
    subtitle: string;
    code: string;
    city: string;
    phone: string;
    active: boolean;
    address: string;
  }>({
    name: '',
    subtitle: '',
    code: '',
    city: '',
    phone: '',
    active: true,
    address: ''
  });

  // Business Hours State
  const [businessHours, setBusinessHours] = useState([
    { day: 'Monday', open: '08:00 AM', close: '07:00 PM', isOpen: true },
    { day: 'Tuesday', open: '08:00 AM', close: '07:00 PM', isOpen: true },
    { day: 'Wednesday', open: '08:00 AM', close: '07:00 PM', isOpen: true },
    { day: 'Thursday', open: '08:00 AM', close: '07:00 PM', isOpen: true },
    { day: 'Friday', open: '08:00 AM', close: '07:00 PM', isOpen: true },
    { day: 'Saturday', open: '09:00 AM', close: '05:00 PM', isOpen: true },
    { day: 'Sunday', open: '10:00 AM', close: '02:00 PM', isOpen: false }
  ]);

  // Resolved values: server data takes precedence, otherwise fallback smoothly to active scope preset
  const resolvedCompanyName = (data && data.companyName) || activePreset.companyName;
  const resolvedTaxId = (data && data.taxId) || activePreset.taxId;
  const resolvedEmail = (data && data.email) || activePreset.email;
  const resolvedPhone = (data && data.phone) || activePreset.phone;
  const resolvedAddress = (data && data.address) || activePreset.address;
  const resolvedCurrency = (data && data.currency) || activePreset.currency;
  const resolvedTimezone = (data && data.timezone) || activePreset.timezone;
  const resolvedDateFormat = (data && data.dateFormat) || activePreset.dateFormat;
  const resolvedFiscalYearStart = (data && data.fiscalYearStart) || activePreset.fiscalYearStart;
  const resolvedCompanyType = (data && data.companyType) || activePreset.companyType;
  const resolvedIncorporatedOn = (data && data.incorporatedOn) || activePreset.incorporatedOn;
  const resolvedRegistrationStatus = (data && data.registrationStatus) || activePreset.registrationStatus;
  const resolvedPrimaryBusiness = (data && data.primaryBusiness) || activePreset.primaryBusiness;

  const branches: BranchItem[] = useMemo(() => {
    if (data && Array.isArray(data.branches) && data.branches.length > 0) {
      return data.branches.map((b: any, idx: number) => ({
        id: b.id || `branch-${idx + 1}`,
        name: b.name || `Facility ${idx + 1}`,
        subtitle: b.subtitle || (idx === 0 ? 'Main facility & admin' : 'Operational center'),
        code: b.code || `${activePreset.shortName}-${idx + 1}`,
        city: b.city || 'Colombo',
        phone: b.phone || activePreset.phone,
        active: b.active !== false,
        address: b.address || '',
        capacity: b.capacity || 25
      }));
    }
    return activePreset.branches;
  }, [data, activePreset]);

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const query = branchSearch.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.code.toLowerCase().includes(query) ||
        b.city.toLowerCase().includes(query) ||
        (b.subtitle && b.subtitle.toLowerCase().includes(query))
    );
  }, [branches, branchSearch]);

  const openAddModal = () => {
    setBranchForm({
      name: '',
      subtitle: '',
      code: `${activePreset.shortName}-${Math.floor(100 + Math.random() * 900)}`,
      city: '',
      phone: activePreset.phone.slice(0, 7) + ' ',
      active: true,
      address: ''
    });
    setEditingBranch(null);
    setIsAddBranchOpen(true);
  };

  const openEditModal = (branch: BranchItem) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      subtitle: branch.subtitle || '',
      code: branch.code,
      city: branch.city,
      phone: branch.phone,
      active: branch.active,
      address: branch.address || ''
    });
    setIsAddBranchOpen(true);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.city.trim()) {
      toast('Validation Error', 'Please enter both Branch Name and City.', 'warning');
      return;
    }

    let updatedList: BranchItem[];
    if (editingBranch) {
      updatedList = branches.map((b) =>
        b.id === editingBranch.id
          ? {
              ...b,
              name: branchForm.name.trim(),
              subtitle: branchForm.subtitle.trim() || 'Operational Facility',
              code: branchForm.code.trim().toUpperCase(),
              city: branchForm.city.trim(),
              phone: branchForm.phone.trim(),
              active: branchForm.active,
              address: branchForm.address.trim()
            }
          : b
      );
      toast('Branch Updated', `${branchForm.name} details have been saved.`);
    } else {
      const newBranch: BranchItem = {
        id: `branch-${Date.now()}`,
        name: branchForm.name.trim(),
        subtitle: branchForm.subtitle.trim() || 'Operational Facility',
        code: branchForm.code.trim().toUpperCase() || `${activePreset.shortName}-NEW`,
        city: branchForm.city.trim(),
        phone: branchForm.phone.trim() || activePreset.phone,
        active: branchForm.active,
        address: branchForm.address.trim(),
        capacity: 25
      };
      updatedList = [...branches, newBranch];
      toast('Branch Created', `${newBranch.name} added to ${activePreset.shortName} facilities.`);
    }

    updateField('branches', updatedList);
    setIsAddBranchOpen(false);
  };

  const handleDeleteBranch = (id: string) => {
    if (branches.length <= 1) {
      toast('Action Prevented', 'At least one operating facility must remain registered.', 'warning');
      setDeletingBranchId(null);
      return;
    }
    const target = branches.find((b) => b.id === id);
    const updatedList = branches.filter((b) => b.id !== id);
    updateField('branches', updatedList);
    setDeletingBranchId(null);
    toast('Branch Removed', `${target?.name || 'Facility'} has been removed.`);
  };

  const handleManualSave = async () => {
    try {
      await saveSettings();
      toast('Settings Saved', `${activePreset.shortName} profile and operational facilities synchronized.`);
    } catch (err: any) {
      toast('Save Failed', err.message || 'Unable to persist changes.', 'warning');
    }
  };

  const handleManualDiscard = () => {
    discardChanges();
    toast('Changes Discarded', `Reverted modifications for ${activePreset.shortName}.`);
  };

  // File Upload State & Handlers
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerLogoUpload = () => {
    fileInputRef.current?.click();
  };

  const processLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Invalid Format', 'Please upload a PNG, JPG, WebP, or SVG image file.', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('File Too Large', 'Please select an image smaller than 5MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimized = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
          updateField('logoUrl', optimized);
        } else {
          updateField('logoUrl', rawDataUrl);
        }
        toast('Logo Updated', `New logo set for ${activePreset.shortName}. Click Save Changes to persist.`);
      };
      img.onerror = () => {
        updateField('logoUrl', rawDataUrl);
        toast('Logo Updated', `New logo set for ${activePreset.shortName}. Click Save Changes to persist.`);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLogoFile(file);
    }
    e.target.value = '';
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processLogoFile(file);
    }
  };

  const handleResetLogo = () => {
    updateField('logoUrl', '');
    toast('Emblem Restored', `Restored default emblem for ${activePreset.shortName}.`);
  };

  // Helper renderer for dynamic company logo emblem
  const renderCompanyLogo = () => {
    const customLogo = data?.logoUrl;
    if (customLogo) {
      return (
        <div className="my-2 flex flex-col items-center">
          <div className="h-20 w-20 rounded-2xl overflow-hidden bg-white dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] flex items-center justify-center p-1.5 shadow-md">
            <img src={customLogo} alt={activePreset.shortName} className="h-full w-full object-contain" />
          </div>
          <h4 className="mt-3 text-base font-extrabold tracking-wider text-[#111B21] dark:text-[#E9EDEF]">
            {data?.displayName || activePreset.shortName}
          </h4>
          <p className="text-[9px] uppercase tracking-widest font-bold text-[#667781] dark:text-[#8696A0]">
            {data?.companyName || activePreset.companyName}
          </p>
        </div>
      );
    }

    if (selectedCompanyId === 'CRAS') {
      return (
        <div className="my-2 flex flex-col items-center">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg border border-blue-400/30">
            <GraduationCap className="h-10 w-10 text-amber-300 drop-shadow" />
          </div>
          <h4 className="mt-3 text-base font-extrabold tracking-wider text-[#111B21] dark:text-[#E9EDEF]">
            CRAS
          </h4>
          <p className="text-[9px] uppercase tracking-widest font-bold text-[#667781] dark:text-[#8696A0]">
            College of Royal Aesthetic
          </p>
        </div>
      );
    }

    if (selectedCompanyId === 'AHC') {
      return (
        <div className="my-2 flex flex-col items-center">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center text-white shadow-lg border border-purple-400/30">
            <Briefcase className="h-10 w-10 text-purple-200 drop-shadow" />
          </div>
          <h4 className="mt-3 text-base font-extrabold tracking-wider text-[#111B21] dark:text-[#E9EDEF]">
            AHC
          </h4>
          <p className="text-[9px] uppercase tracking-widest font-bold text-[#667781] dark:text-[#8696A0]">
            Alpha Health Consultancy
          </p>
        </div>
      );
    }

    if (selectedCompanyId === 'ALL') {
      return (
        <div className="my-2 flex flex-col items-center">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center text-white shadow-lg border border-teal-400/30">
            <Award className="h-10 w-10 text-emerald-200 drop-shadow" />
          </div>
          <h4 className="mt-3 text-base font-extrabold tracking-wider text-[#111B21] dark:text-[#E9EDEF]">
            AHG
          </h4>
          <p className="text-[9px] uppercase tracking-widest font-bold text-[#667781] dark:text-[#8696A0]">
            Alpha Health Group Holdings
          </p>
        </div>
      );
    }

    // Default RWC (Royal Wellness Center) Golden Lotus Logo
    return (
      <div className="my-2 flex flex-col items-center">
        <svg className="w-20 h-20 drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M50 15C50 15 57 32 68 38C79 44 85 58 75 68C65 78 50 82 50 82C50 82 35 78 25 68C15 58 21 44 32 38C43 32 50 15 50 15Z"
            fill="url(#lotus-gold)"
            stroke="#D4AF37"
            strokeWidth="1.5"
          />
          <path
            d="M50 35C50 35 55 45 62 49C69 53 71 62 64 68C57 74 50 76 50 76C50 76 43 74 36 68C29 62 31 53 38 49C45 45 50 35 50 35Z"
            fill="#F9F6EE"
            fillOpacity="0.85"
          />
          <path
            d="M50 48C50 48 52 54 56 56C60 58 60 63 56 66C52 69 50 70 50 70C50 70 48 69 44 66C40 63 40 58 44 56C48 54 50 48 50 48Z"
            fill="#D4AF37"
          />
          <defs>
            <linearGradient id="lotus-gold" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F5D061" />
              <stop offset="0.5" stopColor="#E6B325" />
              <stop offset="1" stopColor="#996515" />
            </linearGradient>
          </defs>
        </svg>

        <h4 className="mt-3 text-base font-extrabold tracking-wider text-[#111B21] dark:text-[#E9EDEF]">
          RWC
        </h4>
        <p className="text-[9px] uppercase tracking-widest font-bold text-[#667781] dark:text-[#8696A0]">
          Royal Wellness Center
        </p>
      </div>
    );
  };

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
          <span>Loading configuration for {activePreset.shortName}...</span>
        </div>
      </SettingsLayout>
    );
  }

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
      onDiscard={handleManualDiscard}
    >
      <div className="w-full space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Navigation Tab Bar */}
        <div className="flex items-center space-x-1 border-b border-[#E0E5E7] dark:border-[#222D34] pb-px overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Company Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'branches'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Network className="h-4 w-4" />
            <span>Branches & Facilities</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hours')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'hours'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Business Hours</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('localization')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'localization'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Localization & Fiscal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'branding'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>Branding & Assets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scope')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'scope'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Operational Scope</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MAIN OVERVIEW VIEW */}
        {/* ========================================================================= */}
        {(activeTab === 'profile' || activeTab === 'branches' || activeTab === 'localization') && (
          <div className="space-y-6">
            {/* CARD 1: COMPANY PROFILE & BRAND IDENTITY */}
            {activeTab === 'profile' && (
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-6 transition-colors">
                {/* Header of Card 1 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-2">
                      Company Profile & Brand Identity
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Configure details, legal identity and contact information for {activePreset.shortName}.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    {/* Active Status Badge */}
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Active</span>
                    </div>

                    {/* Discard Button */}
                    <button
                      type="button"
                      onClick={handleManualDiscard}
                      disabled={!isDirty || isSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF] bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Discard</span>
                    </button>

                    {/* Save Changes Button */}
                    <button
                      type="button"
                      onClick={handleManualSave}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-xl shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>

                {/* 3-Column Layout: Left (Logo), Middle (Form), Right (Metadata) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Dynamic Brand Logo Box */}
                  <div className="lg:col-span-3 flex flex-col items-center">
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={handleLogoDrop}
                      className="w-full relative rounded-2xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] p-6 flex flex-col items-center justify-center text-center group transition-colors hover:border-[#128C7E]/40"
                    >
                      {/* Hidden File Input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={handleLogoFileChange}
                      />

                      {/* Top Right Quick Edit Icon */}
                      <button
                        type="button"
                        onClick={handleTriggerLogoUpload}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] text-[#667781] hover:text-[#128C7E] dark:text-[#8696A0] dark:hover:text-[#25D366] transition-colors shadow-xs cursor-pointer"
                        title="Upload Custom Logo"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>

                      {/* Dynamic Logo Rendering */}
                      {renderCompanyLogo()}

                      {/* Upload / Change Logo Button */}
                      <div className="mt-4 w-full flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={handleTriggerLogoUpload}
                          className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] hover:border-[#128C7E] dark:hover:border-[#25D366] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                          <span>Change Logo</span>
                        </button>

                        {data?.logoUrl && (
                          <button
                            type="button"
                            onClick={handleResetLogo}
                            className="w-full py-1 text-[10px] font-semibold text-[#667781] hover:text-rose-500 dark:text-[#8696A0] dark:hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            Reset to Default Emblem
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Form Inputs */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Legal Name */}
                      <div>
                        <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                          Company Legal Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                          <input
                            type="text"
                            value={resolvedCompanyName}
                            onChange={(e) => updateField('companyName', e.target.value)}
                            placeholder={`e.g. ${activePreset.companyName}`}
                            className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                          />
                        </div>
                      </div>

                      {/* Tax ID */}
                      <div>
                        <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                          Tax / Registration No.
                        </label>
                        <div className="relative">
                          <FileSpreadsheet className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                          <input
                            type="text"
                            value={resolvedTaxId}
                            onChange={(e) => updateField('taxId', e.target.value)}
                            placeholder={activePreset.taxId}
                            className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                          />
                        </div>
                      </div>

                      {/* Corporate Email */}
                      <div>
                        <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                          Corporate Email <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                          <input
                            type="email"
                            value={resolvedEmail}
                            onChange={(e) => updateField('email', e.target.value)}
                            placeholder={activePreset.email}
                            className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                          />
                        </div>
                      </div>

                      {/* Corporate Phone */}
                      <div>
                        <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                          Corporate Telephone
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                          <input
                            type="tel"
                            value={resolvedPhone}
                            onChange={(e) => updateField('phone', e.target.value)}
                            placeholder={activePreset.phone}
                            className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                          />
                        </div>
                      </div>

                      {/* Registered Address */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                          Registered Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                          <input
                            type="text"
                            value={resolvedAddress}
                            onChange={(e) => updateField('address', e.target.value)}
                            placeholder={activePreset.address}
                            className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metadata Key-Value Box for Active Scope */}
                  <div className="lg:col-span-3">
                    <div className="h-full rounded-2xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] p-4 flex flex-col justify-around space-y-3">
                      {/* Company Type */}
                      <div className="flex items-center justify-between py-1 border-b border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs text-[#667781] dark:text-[#8696A0]">Company Type</span>
                        </div>
                        <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] text-right truncate ml-2">
                          {resolvedCompanyType}
                        </span>
                      </div>

                      {/* Incorporated On */}
                      <div className="flex items-center justify-between py-1 border-b border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
                            <Calendar className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs text-[#667781] dark:text-[#8696A0]">Incorporated On</span>
                        </div>
                        <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                          {resolvedIncorporatedOn}
                        </span>
                      </div>

                      {/* Registration Status */}
                      <div className="flex items-center justify-between py-1 border-b border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs text-[#667781] dark:text-[#8696A0]">Registration Status</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {resolvedRegistrationStatus}
                        </span>
                      </div>

                      {/* Primary Business */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
                            <Users className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs text-[#667781] dark:text-[#8696A0]">Primary Business</span>
                        </div>
                        <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] text-right truncate ml-2">
                          {resolvedPrimaryBusiness}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 2: LOCALIZATION & FISCAL CALENDAR */}
            {(activeTab === 'profile' || activeTab === 'localization') && (
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Localization & Fiscal Calendar
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Set default currency, timezone, date format and fiscal year cycle for {activePreset.shortName}.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Default Currency */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                      Default Currency
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                      <select
                        value={resolvedCurrency}
                        onChange={(e) => updateField('currency', e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer appearance-none"
                      >
                        <option value="LKR">LKR (Rs) — Sri Lankan Rupee</option>
                        <option value="USD">USD ($) — US Dollar</option>
                        <option value="AED">AED (د.إ) — UAE Dirham</option>
                        <option value="GBP">GBP (£) — British Pound</option>
                        <option value="EUR">EUR (€) — Euro</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#667781] dark:text-[#8696A0]">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Time Zone */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                      Time Zone
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                      <select
                        value={resolvedTimezone}
                        onChange={(e) => updateField('timezone', e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer appearance-none"
                      >
                        <option value="Asia/Colombo">Asia/Colombo (GMT+05:30)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GMT+04:00)</option>
                        <option value="Asia/Singapore">Asia/Singapore (GMT+08:00)</option>
                        <option value="Europe/London">Europe/London (GMT+00:00)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#667781] dark:text-[#8696A0]">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Date Display Format */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                      Date Display Format
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                      <select
                        value={resolvedDateFormat}
                        onChange={(e) => updateField('dateFormat', e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer appearance-none"
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-03)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (03/11/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (11/03/2026)</option>
                        <option value="DD-MMM-YYYY">DD-MMM-YYYY (03-Nov-2026)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#667781] dark:text-[#8696A0]">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Fiscal Year Start */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                      Fiscal Year Start
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                      <select
                        value={resolvedFiscalYearStart}
                        onChange={(e) => updateField('fiscalYearStart', e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer appearance-none"
                      >
                        <option value="January">January 1st</option>
                        <option value="April">April 1st (LK Standard)</option>
                        <option value="July">July 1st</option>
                        <option value="October">October 1st</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#667781] dark:text-[#8696A0]">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 3: PHYSICAL BRANCHES & FACILITIES */}
            {(activeTab === 'profile' || activeTab === 'branches') && (
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                {/* Header with Title and Search / + Add Branch */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <Network className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Physical Branches & Facilities
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Manage active operational branches for {activePreset.shortName}.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Search Input */}
                    <div className="relative min-w-[240px]">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                      <input
                        type="text"
                        placeholder="Search branch by name, city or code..."
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                      />
                    </div>

                    {/* Add Branch Button */}
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="h-8.5 px-3.5 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-sm shrink-0 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Branch</span>
                    </button>
                  </div>
                </div>

                {/* Branches Table */}
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E0E5E7] dark:border-[#222D34] text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                        <th className="pb-3 pr-2 w-8">#</th>
                        <th className="pb-3 px-3">Branch Name</th>
                        <th className="pb-3 px-3">Branch Code</th>
                        <th className="pb-3 px-3">City / District</th>
                        <th className="pb-3 px-3">Contact Number</th>
                        <th className="pb-3 px-3">Operational Status</th>
                        <th className="pb-3 pl-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E5E7]/50 dark:divide-[#222D34]/50">
                      {filteredBranches.length > 0 ? (
                        filteredBranches.map((branch, index) => (
                          <tr
                            key={branch.id}
                            className="hover:bg-[#F0F2F5]/60 dark:hover:bg-[#111B21]/60 transition-colors"
                          >
                            {/* # Index */}
                            <td className="py-3.5 pr-2 font-mono text-[11px] text-[#667781] dark:text-[#8696A0]">
                              {index + 1}
                            </td>

                            {/* Branch Name with icon & subtitle */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center space-x-3">
                                <div className="h-8 w-8 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-[#111B21] dark:text-[#E9EDEF] truncate">
                                    {branch.name}
                                  </p>
                                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0] truncate">
                                    {branch.subtitle || 'Branch facility'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Branch Code */}
                            <td className="py-3.5 px-3">
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF]">
                                {branch.code}
                              </span>
                            </td>

                            {/* City / District */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center space-x-1.5 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">
                                <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span>{branch.city}</span>
                              </div>
                            </td>

                            {/* Contact Number */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center space-x-1.5 text-xs text-[#667781] dark:text-[#8696A0]">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span>{branch.phone}</span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  branch.active
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    branch.active ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                />
                                {branch.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 pl-3 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingBranch(branch)}
                                  className="p-1.5 rounded-lg text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] hover:bg-[#F0F2F5] dark:hover:bg-[#111B21] transition-colors cursor-pointer"
                                  title="View Facility"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(branch)}
                                  className="p-1.5 rounded-lg text-[#667781] hover:text-[#128C7E] dark:text-[#8696A0] dark:hover:text-[#25D366] hover:bg-[#F0F2F5] dark:hover:bg-[#111B21] transition-colors cursor-pointer"
                                  title="Edit Facility"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingBranchId(branch.id)}
                                  className="p-1.5 rounded-lg text-[#667781] hover:text-rose-600 dark:text-[#8696A0] dark:hover:text-rose-400 hover:bg-[#F0F2F5] dark:hover:bg-[#111B21] transition-colors cursor-pointer"
                                  title="Delete Facility"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-[#667781] dark:text-[#8696A0]">
                            No branches found for {activePreset.shortName} matching "{branchSearch}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: BUSINESS HOURS */}
        {/* ========================================================================= */}
        {activeTab === 'hours' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
            <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Operating Business Hours ({activePreset.shortName})
                  </h3>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                    Define regular clinic working hours, consultation shifts, and holiday policies.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toast('Schedule Synchronized', `Weekly hours applied to all ${activePreset.shortName} facilities.`)}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Apply to All Facilities
              </button>
            </div>

            <div className="space-y-3">
              {businessHours.map((schedule, idx) => (
                <div
                  key={schedule.day}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 gap-3"
                >
                  <div className="flex items-center space-x-3 w-36">
                    <input
                      type="checkbox"
                      checked={schedule.isOpen}
                      onChange={(e) => {
                        const updated = [...businessHours];
                        updated[idx].isOpen = e.target.checked;
                        setBusinessHours(updated);
                      }}
                      className="rounded accent-[#128C7E] dark:accent-[#25D366] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{schedule.day}</span>
                  </div>

                  {schedule.isOpen ? (
                    <div className="flex items-center space-x-3 text-xs">
                      <span className="text-[#667781] dark:text-[#8696A0]">Opens:</span>
                      <input
                        type="text"
                        value={schedule.open}
                        onChange={(e) => {
                          const updated = [...businessHours];
                          updated[idx].open = e.target.value;
                          setBusinessHours(updated);
                        }}
                        className="w-24 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-2.5 py-1 text-xs text-[#111B21] dark:text-[#E9EDEF] text-center"
                      />
                      <span className="text-[#667781] dark:text-[#8696A0]">Closes:</span>
                      <input
                        type="text"
                        value={schedule.close}
                        onChange={(e) => {
                          const updated = [...businessHours];
                          updated[idx].close = e.target.value;
                          setBusinessHours(updated);
                        }}
                        className="w-24 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-2.5 py-1 text-xs text-[#111B21] dark:text-[#E9EDEF] text-center"
                      />
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg">
                      Closed (Emergency Cover On Call)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: BRANDING & ASSETS */}
        {/* ========================================================================= */}
        {activeTab === 'branding' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
            <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
              <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  Branding & Visual Assets ({activePreset.shortName})
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Manage emblems, invoice letterheads, and message badges for {activePreset.companyName}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] space-y-3 text-center">
                <p className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Header Emblem (Dark Mode)</p>
                <div className="h-28 rounded-lg bg-[#202C33] flex items-center justify-center border border-[#222D34]">
                  <span className="text-sm font-bold text-[#25D366]">{activePreset.shortName} • {activePreset.tagline}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toast('Asset Upload', `Dark mode emblem selected for ${activePreset.shortName}.`)}
                  className="w-full py-1.5 rounded-lg bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-semibold cursor-pointer"
                >
                  Upload Dark Emblem
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] space-y-3 text-center">
                <p className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Header Emblem (Light Mode)</p>
                <div className="h-28 rounded-lg bg-white flex items-center justify-center border border-[#E0E5E7]">
                  <span className="text-sm font-bold text-[#128C7E]">{activePreset.shortName} • {activePreset.tagline}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toast('Asset Upload', `Light mode emblem selected for ${activePreset.shortName}.`)}
                  className="w-full py-1.5 rounded-lg bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-semibold cursor-pointer"
                >
                  Upload Light Emblem
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] space-y-3 text-center">
                <p className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Official Invoice Letterhead</p>
                <div className="h-28 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 flex flex-col items-center justify-center border border-emerald-500/20">
                  <FileText className="h-6 w-6 text-[#128C7E] dark:text-[#25D366] mb-1" />
                  <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">{activePreset.companyName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toast('Asset Upload', `Invoice stationery updated for ${activePreset.shortName}.`)}
                  className="w-full py-1.5 rounded-lg bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-semibold cursor-pointer"
                >
                  Configure Letterhead
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: OPERATIONAL SCOPE */}
        {/* ========================================================================= */}
        {activeTab === 'scope' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
            <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
              <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">Multi-Tenant Operational Scope</h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Configure corporate partition boundaries across Royal Wellness Center, CRAS College, and Alpha Health.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Scope 1: RWC */}
              <div
                className={`p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border-2 transition-all ${
                  selectedCompanyId === 'RWC'
                    ? 'border-[#128C7E] dark:border-[#25D366] shadow-sm'
                    : 'border-[#E0E5E7] dark:border-[#222D34]'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Royal Wellness Center</span>
                  {selectedCompanyId === 'RWC' ? (
                    <span className="text-[10px] font-bold text-[#128C7E] dark:text-[#25D366] bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      CURRENT SCOPE
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectCompany('RWC')}
                      className="text-[10px] font-bold text-[#128C7E] dark:text-[#25D366] hover:underline cursor-pointer"
                    >
                      Switch Scope →
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Aesthetic & Clinical patient care, room appointments, treatment logs.</p>
                <p className="text-xs font-mono font-bold text-[#111B21] dark:text-[#E9EDEF] pt-2">Scope ID: RWC</p>
              </div>

              {/* Scope 2: CRAS */}
              <div
                className={`p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border-2 transition-all ${
                  selectedCompanyId === 'CRAS'
                    ? 'border-[#128C7E] dark:border-[#25D366] shadow-sm'
                    : 'border-[#E0E5E7] dark:border-[#222D34]'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">CRAS Academic</span>
                  {selectedCompanyId === 'CRAS' ? (
                    <span className="text-[10px] font-bold text-[#128C7E] dark:text-[#25D366] bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      CURRENT SCOPE
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectCompany('CRAS')}
                      className="text-[10px] font-bold text-[#128C7E] dark:text-[#25D366] hover:underline cursor-pointer"
                    >
                      Switch Scope →
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Cosmetic examination engine, MCQ practice tests, course batches.</p>
                <p className="text-xs font-mono font-bold text-[#111B21] dark:text-[#E9EDEF] pt-2">Scope ID: CRAS</p>
              </div>

              {/* Scope 3: AHC */}
              <div
                className={`p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border-2 transition-all ${
                  selectedCompanyId === 'AHC'
                    ? 'border-[#128C7E] dark:border-[#25D366] shadow-sm'
                    : 'border-[#E0E5E7] dark:border-[#222D34]'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Alpha Health Consultancy</span>
                  {selectedCompanyId === 'AHC' ? (
                    <span className="text-[10px] font-bold text-[#128C7E] dark:text-[#25D366] bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      CURRENT SCOPE
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectCompany('AHC')}
                      className="text-[10px] font-bold text-[#128C7E] dark:text-[#25D366] hover:underline cursor-pointer"
                    >
                      Switch Scope →
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Consulting, executive governance and cross-brand analytics.</p>
                <p className="text-xs font-mono font-bold text-[#111B21] dark:text-[#E9EDEF] pt-2">Scope ID: AHC</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD / EDIT BRANCH */}
        {/* ========================================================================= */}
        {isAddBranchOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366]">
                    <Network className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    {editingBranch ? `Edit ${activePreset.shortName} Facility` : `Add Facility for ${activePreset.shortName}`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddBranchOpen(false)}
                  className="text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveBranch} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Facility Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={`e.g. ${activePreset.shortName} - City Hub`}
                      value={branchForm.name}
                      onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Facility Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={`e.g. ${activePreset.shortName}-HUB`}
                      value={branchForm.code}
                      onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      City / District <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Colombo 03"
                      value={branchForm.city}
                      onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Contact Line
                    </label>
                    <input
                      type="text"
                      placeholder={activePreset.phone}
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Operational Status
                    </label>
                    <select
                      value={branchForm.active ? 'ACTIVE' : 'INACTIVE'}
                      onChange={(e) => setBranchForm({ ...branchForm, active: e.target.value === 'ACTIVE' })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Physical Location Address
                    </label>
                    <input
                      type="text"
                      placeholder="Street address, building number"
                      value={branchForm.address}
                      onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E0E5E7] dark:border-[#222D34]">
                  <button
                    type="button"
                    onClick={() => setIsAddBranchOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    {editingBranch ? 'Update Facility' : 'Save Facility'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: VIEW BRANCH DETAILS */}
        {/* ========================================================================= */}
        {viewingBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366]">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">{viewingBranch.name}</h3>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">{viewingBranch.code}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingBranch(null)}
                  className="text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#667781] dark:text-[#8696A0]">City / District</span>
                    <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">{viewingBranch.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667781] dark:text-[#8696A0]">Direct Line</span>
                    <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">{viewingBranch.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667781] dark:text-[#8696A0]">Operational Status</span>
                    <span className={`font-bold ${viewingBranch.active ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {viewingBranch.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667781] dark:text-[#8696A0]">Operational Capacity</span>
                    <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">{viewingBranch.capacity || 25} capacity</span>
                  </div>
                </div>

                {viewingBranch.address && (
                  <div>
                    <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Physical Location</span>
                    <p className="text-xs text-[#111B21] dark:text-[#E9EDEF] mt-0.5">{viewingBranch.address}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-[#E0E5E7] dark:border-[#222D34]">
                <button
                  type="button"
                  onClick={() => setViewingBranch(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: DELETE CONFIRMATION */}
        {/* ========================================================================= */}
        {deletingBranchId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Remove Operational Facility?</h4>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">This will unassign all linked scheduling rooms for {activePreset.shortName}.</p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingBranchId(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBranch(deletingBranchId)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
};
