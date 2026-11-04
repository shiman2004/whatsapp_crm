import React, { useState } from 'react';
import {
  FileEdit,
  Plus,
  Trash2,
  CheckCircle2,
  Type,
  Hash,
  List,
  Calendar,
  Layers
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';

interface CustomFieldsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const CustomFieldsSection: React.FC<CustomFieldsProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
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
    sectionId: 'custom_fields',
    scope: 'company',
    companyId: selectedCompanyId
  });

  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [targetEntity, setTargetEntity] = useState('lead');
  const [isRequired, setIsRequired] = useState(false);

  if (isLoading) {
    return (
      <SettingsLayout
        currentSectionId={currentSectionId}
        onSelectSection={onSelectSection}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
      >
        <div className="flex items-center justify-center h-64 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3" />
          <span>Loading custom fields...</span>
        </div>
      </SettingsLayout>
    );
  }

  const fields = data.fields || [
    { id: 'f-1', entity: 'lead', name: 'NIC / Passport No', type: 'text', required: true },
    { id: 'f-2', entity: 'lead', name: 'Blood Group', type: 'dropdown', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-'], required: false },
    { id: 'f-3', entity: 'appointment', name: 'Medical History Summary', type: 'textarea', required: false },
    { id: 'f-4', entity: 'student', name: 'Student Batch Intake Year', type: 'number', required: true }
  ];

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;
    const newF = {
      id: `f-${Date.now()}`,
      entity: targetEntity,
      name: fieldLabel.trim(),
      type: fieldType,
      required: isRequired
    };
    updateField('fields', [...fields, newF]);
    setFieldLabel('');
    setIsRequired(false);
  };

  const handleRemoveField = (id: string) => {
    updateField('fields', fields.filter((f: any) => f.id !== id));
  };

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
      onSave={saveSettings}
      onDiscard={discardChanges}
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* 1. Custom Field Creator */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Entity Custom Fields & Dynamic Attributes
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Add custom attributes to Leads, Appointments, Patients and Student records</p>
          </div>

          <form onSubmit={handleAddField} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-[#F0F2F5] dark:bg-[#111B21]/80 border border-[#E0E5E7] dark:border-[#222D34] rounded-xl">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Field Label</label>
              <input
                type="text"
                placeholder="e.g. Previous Surgery History"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Target Entity</label>
              <select
                value={targetEntity}
                onChange={(e) => setTargetEntity(e.target.value)}
                className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="lead">Lead / Deal</option>
                <option value="appointment">Appointment</option>
                <option value="patient">Patient Record</option>
                <option value="student">Student Account</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Field Type</label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="text">Single Line Text</option>
                <option value="number">Number</option>
                <option value="dropdown">Dropdown Select</option>
                <option value="date">Date Picker</option>
                <option value="textarea">Multi-line Text</option>
              </select>
            </div>

            <div className="md:col-span-4 flex justify-between items-center pt-2">
              <label className="flex items-center space-x-2 text-xs text-[#111B21] dark:text-[#E9EDEF] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 rounded bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] focus:ring-emerald-500"
                />
                <span>Enforce as mandatory required field</span>
              </label>

              <button
                type="submit"
                className="px-4 py-1.5 bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Field</span>
              </button>
            </div>
          </form>

          {/* Fields List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((field: any) => (
              <div
                key={field.id}
                className="p-3.5 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl flex items-center justify-between hover:border-[#E0E5E7] dark:border-[#222D34] transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{field.name}</span>
                    {field.required && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0] font-mono">
                    Entity: <span className="text-[#128C7E] dark:text-[#25D366]">{field.entity}</span> • Type: <span className="text-[#111B21] dark:text-[#E9EDEF]">{field.type}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveField(field.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

