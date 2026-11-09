import React, { useState, useEffect } from 'react';
import { CompanyBranchSection } from './CompanyBranchSection';
import { UserManagementSection } from './UserManagementSection';
import { RolesPermissionsSection } from './RolesPermissionsSection';
import { WhatsAppMessagingSection } from './WhatsAppMessagingSection';
import { SalesPipelinesSection } from './SalesPipelinesSection';
import { MarketingSettingsSection } from './MarketingSettingsSection';
import { ClinicalSettingsSection } from './ClinicalSettingsSection';
import { AcademicSettingsSection } from './AcademicSettingsSection';
import { AutomationSection } from './AutomationSection';
import { EmailNotificationsSection } from './EmailNotificationsSection';
import { CustomFieldsSection } from './CustomFieldsSection';
import { IntegrationsSection } from './IntegrationsSection';
import { SecurityAuditSection } from './SecurityAuditSection';
import { DataManagementSection } from './DataManagementSection';
import { SystemMonitoringSection } from './SystemMonitoringSection';
import { ReportingSettingsSection } from './ReportingSettingsSection';
import { AppearanceSection } from './AppearanceSection';
import { SettingsLayout } from './SettingsLayout';
import { LabelManagementTab } from '../admin/SuperAdminSettings/LabelManagementTab';

export const EnterpriseSettingsHub: React.FC = () => {
  const getHashSection = () => {
    const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    if (hash.startsWith('settings/')) {
      const parts = hash.split('/');
      const section = parts[1] || 'company';
      if (section === 'courses') return 'academic';
      if (section === 'treatments') return 'clinical';
      if (section === 'stages') return 'sales';
      if (section === 'labels') return 'labels';
      return section;
    }
    return 'company';
  };

  const [currentSectionId, setCurrentSectionId] = useState<string>(getHashSection());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('RWC');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentSectionId(getHashSection());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectSection = (id: string) => {
    setCurrentSectionId(id);
    window.location.hash = `/settings/${id}`;
  };

  const commonProps = {
    currentSectionId,
    onSelectSection: handleSelectSection,
    selectedCompanyId,
    onSelectCompany: setSelectedCompanyId
  };

  switch (currentSectionId) {
    case 'company':
      return <CompanyBranchSection {...commonProps} />;
    case 'users':
      return <UserManagementSection {...commonProps} />;
    case 'roles':
      return <RolesPermissionsSection {...commonProps} />;
    case 'labels':
      return (
        <SettingsLayout {...commonProps}>
          <div className="p-6 overflow-y-auto max-w-6xl mx-auto flex-1">
            <LabelManagementTab />
          </div>
        </SettingsLayout>
      );
    case 'whatsapp_messaging':
      return <WhatsAppMessagingSection {...commonProps} />;
    case 'sales':
      return <SalesPipelinesSection {...commonProps} />;
    case 'marketing':
      return <MarketingSettingsSection {...commonProps} />;
    case 'clinical':
      return <ClinicalSettingsSection {...commonProps} />;
    case 'academic':
      return <AcademicSettingsSection {...commonProps} />;
    case 'automation':
      return <AutomationSection {...commonProps} />;
    case 'email_notifications':
      return <EmailNotificationsSection {...commonProps} />;
    case 'custom_fields':
      return <CustomFieldsSection {...commonProps} />;
    case 'integrations':
      return <IntegrationsSection {...commonProps} />;
    case 'security_policy':
      return <SecurityAuditSection {...commonProps} />;
    case 'data_management':
      return <DataManagementSection {...commonProps} />;
    case 'system_monitoring':
      return <SystemMonitoringSection {...commonProps} />;
    case 'reporting':
      return <ReportingSettingsSection {...commonProps} />;
    case 'appearance':
      return <AppearanceSection {...commonProps} />;
    default:
      return <CompanyBranchSection {...commonProps} />;
  }
};

export default EnterpriseSettingsHub;

