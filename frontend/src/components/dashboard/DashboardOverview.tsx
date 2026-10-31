import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Globe2,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { KpiCards } from './KpiCards';
import { LeadFunnelChart } from './LeadFunnelChart';
import { TreatmentDistributionChart } from './TreatmentDistributionChart';
import { CoordinatorLeaderboard } from './CoordinatorLeaderboard';
import { useCrm } from '../../context/CrmContext';
import { getLeadCompany, COMPANIES } from '../../utils/companyUtils';
import { CompanyCode, LeadStage } from '../../types';
import { navigateToPath } from '../../config/navigation';
import { formatChatListTimestamp } from '../../utils/dateUtils';
import { STAGE_CONFIG } from '../leads/StageBadge';
import {
  ActivityTimeline,
  DataTable,
  PageHeader,
  SectionCard,
  StatusBadge,
  type StatusTone,
  type TimelineEntry,
  cn,
} from '../ui';

const STAGE_TONE: Record<string, StatusTone> = {
  new: 'danger',
  assigned: 'success',
  contacted: 'info',
  potential: 'teal',
  under_discussion: 'warning',
  forwarded_to_exam_department: 'info',
  forwarded_to_processing_department: 'info',
  interested: 'teal',
  follow_up: 'warning',
  converted: 'success',
  lost: 'danger',
  not_relevant: 'neutral',
  not_eligible: 'neutral',
};

export const DashboardOverview: React.FC = () => {
  const { leads, currentUser, followups, unreadBroadcastsCount, stageHistories, setSelectedLeadId, setActiveNavTab } = useCrm();

  const canSwitchCompany = currentUser?.role === 'super_admin' || currentUser?.role === 'leads_officer';

  const [activeCompany, setActiveCompany] = useState<CompanyCode | 'all'>(() => {
    if (currentUser?.role === 'coordinator') {
      return currentUser.company === 'CRAS' ? 'CRAS' : currentUser.company === 'AHC' ? 'AHC' : 'RWC';
    }
    return 'all';
  });

  React.useEffect(() => {
    if (currentUser?.role === 'coordinator') {
      setActiveCompany(currentUser.company === 'CRAS' ? 'CRAS' : currentUser.company === 'AHC' ? 'AHC' : 'RWC');
    }
  }, [currentUser?.role, currentUser?.company]);

  const filteredLeads = useMemo(
    () => (activeCompany === 'all' ? leads : leads.filter((l) => getLeadCompany(l).code === activeCompany)),
    [leads, activeCompany],
  );

  const scopedLeadIds = useMemo(() => new Set(filteredLeads.map((l) => l.id)), [filteredLeads]);

  const rwcCount = useMemo(() => leads.filter((l) => getLeadCompany(l).code === 'RWC').length, [leads]);
  const crasCount = useMemo(() => leads.filter((l) => getLeadCompany(l).code === 'CRAS').length, [leads]);
  const ahcCount = useMemo(() => leads.filter((l) => getLeadCompany(l).code === 'AHC').length, [leads]);

  const enCount = filteredLeads.filter((l) => l.language === 'en').length;
  const siCount = filteredLeads.filter((l) => l.language === 'si').length;
  const taCount = filteredLeads.filter((l) => l.language === 'ta').length;

  const unassigned = filteredLeads.filter((l) => l.stage === 'new' && !l.assignedTo).length;
  const pendingFollowups = followups.filter((f) => f.status === 'pending' && scopedLeadIds.has(f.leadId)).length;

  const openLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveNavTab('chat');
    navigateToPath('/inbox');
  };

  const recentLeads = useMemo(
    () =>
      [...filteredLeads]
        .sort((a, b) => new Date(b.lastCustomerMessageAt || b.updatedAt).getTime() - new Date(a.lastCustomerMessageAt || a.updatedAt).getTime())
        .slice(0, 6),
    [filteredLeads],
  );

  const activity: TimelineEntry[] = useMemo(
    () =>
      stageHistories
        .filter((h) => scopedLeadIds.has(h.leadId))
        .slice(0, 5)
        .map((h) => {
          const lead = leads.find((l) => l.id === h.leadId);
          const fromLabel = STAGE_CONFIG[h.fromStage as LeadStage]?.label || h.fromStage;
          const toLabel = STAGE_CONFIG[h.toStage as LeadStage]?.label || h.toStage;
          return {
            id: h.id,
            tone: STAGE_TONE[h.toStage] || 'neutral',
            title: (
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">{lead?.customer?.displayName || 'Contact'}</span>
                <span className="text-[#667781] dark:text-[#8696A0]">moved to</span>
                <span className="font-medium text-[#128C7E] dark:text-[#25D366]">{toLabel}</span>
              </span>
            ),
            detail: (
              <span className="text-[10.5px] text-[#667781] dark:text-[#8696A0]">
                From {fromLabel} · {h.changedByName || 'System'}
              </span>
            ),
            time: formatChatListTimestamp(h.createdAt),
          };
        }),
    [stageHistories, scopedLeadIds, leads],
  );

  const companies: Array<{ code: CompanyCode | 'all'; label: string; count: number; icon: React.ComponentType<{ className?: string }> }> = [
    { code: 'all', label: 'All Brands', count: leads.length, icon: Sparkles },
    { code: 'RWC', label: COMPANIES.RWC.name, count: rwcCount, icon: Building2 },
    { code: 'CRAS', label: COMPANIES.CRAS.name, count: crasCount, icon: GraduationCap },
    { code: 'AHC', label: COMPANIES.AHC.name, count: ahcCount, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operations Overview"
        description="Unified lead performance, team workloads, and WhatsApp conversion funnel across all brands."
        eyebrow="Alpha Health Group"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateToPath('/leads/all')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E5E7] bg-white px-3 py-1.5 text-xs font-semibold text-[#111B21] shadow-xs transition-colors hover:bg-[#F0F2F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
            >
              View pipeline <ArrowRight className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
            </button>
            <button
              type="button"
              onClick={() => navigateToPath('/inbox')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#128C7E] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#075E54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] dark:bg-[#005C4B] dark:text-[#25D366] dark:hover:bg-[#00705a]"
            >
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp inbox
            </button>
          </div>
        }
      />

      {(unassigned > 0 || pendingFollowups > 0 || unreadBroadcastsCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="font-bold uppercase tracking-wide">Needs attention</span>
          {unassigned > 0 && (
            <button type="button" onClick={() => navigateToPath('/leads/all')} className="rounded-md bg-white/70 px-2 py-0.5 font-semibold text-amber-950 hover:bg-white dark:bg-[#202C33] dark:text-amber-200 dark:hover:bg-[#2A3942]">
              {unassigned} unassigned {unassigned === 1 ? 'lead' : 'leads'}
            </button>
          )}
          {pendingFollowups > 0 && (
            <button type="button" onClick={() => navigateToPath('/templates')} className="rounded-md bg-white/70 px-2 py-0.5 font-semibold text-amber-950 hover:bg-white dark:bg-[#202C33] dark:text-amber-200 dark:hover:bg-[#2A3942]">
              {pendingFollowups} pending follow-ups
            </button>
          )}
          {unreadBroadcastsCount > 0 && (
            <button type="button" onClick={() => navigateToPath('/broadcast')} className="rounded-md bg-white/70 px-2 py-0.5 font-semibold text-amber-950 hover:bg-white dark:bg-[#202C33] dark:text-amber-200 dark:hover:bg-[#2A3942]">
              {unreadBroadcastsCount} unread broadcasts
            </button>
          )}
        </div>
      )}

      {/* Brand scope */}
      <div className="flex flex-col gap-2 rounded-xl border border-[#E0E5E7] bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#222D34] dark:bg-[#202C33]">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {companies.map(({ code, label, count, icon: Icon }) => {
            const active = activeCompany === code;
            const disabled = !canSwitchCompany && (code === 'all' || code !== activeCompany);
            return (
              <button
                key={code}
                type="button"
                disabled={disabled}
                onClick={() => setActiveCompany(code)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]',
                  active
                    ? 'bg-[#128C7E] text-white shadow-xs dark:bg-[#005C4B] dark:text-[#E9EDEF] dark:border dark:border-[#25D366]/40'
                    : 'text-[#667781] hover:bg-[#F0F2F5] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]',
                  disabled && !active && 'cursor-default opacity-40',
                )}
                aria-pressed={active}
              >
                <Icon className={cn('h-3.5 w-3.5', active ? 'text-white dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0]')} />
                {label}
                <span className={cn('rounded px-1 text-[10px] font-mono', active ? 'bg-white/20 text-white dark:bg-black/25 dark:text-[#25D366]' : 'bg-[#F0F2F5] text-[#667781] dark:bg-[#2A3942] dark:text-[#8696A0]')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 px-2 text-[10.5px] text-[#667781] dark:text-[#8696A0]">
          <Globe2 className="h-3 w-3 text-[#128C7E] dark:text-[#25D366]" />
          {activeCompany === 'all'
            ? 'Unified multi-brand performance'
            : `${COMPANIES[activeCompany].name} · scoped metrics`}
        </p>
      </div>

      <KpiCards leads={filteredLeads} />

      {/* Language distribution */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { code: 'EN', label: 'English', count: enCount, color: 'blue' },
          { code: 'SI', label: 'Sinhala', count: siCount, color: 'amber' },
          { code: 'TA', label: 'Tamil', count: taCount, color: 'rose' },
        ].map((lang) => {
          const pct = filteredLeads.length > 0 ? Math.round((lang.count / filteredLeads.length) * 100) : 0;
          const bar = lang.color === 'blue' ? 'bg-[#34B7F1]' : lang.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500';
          const chip = lang.color === 'blue'
            ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
            : lang.color === 'amber'
            ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
          return (
            <div key={lang.code} className="rounded-xl border border-[#E0E5E7] bg-white p-3.5 shadow-sm dark:border-[#222D34] dark:bg-[#202C33]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold', chip)}>{lang.code}</span>
                  <div>
                    <p className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{lang.label}</p>
                    <p className="text-[10px] text-[#667781] dark:text-[#8696A0]">{lang.count} conversations</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">{pct}%</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#F0F2F5] dark:bg-[#2A3942]">
                <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LeadFunnelChart leads={filteredLeads} />
        <TreatmentDistributionChart leads={filteredLeads} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Recent conversations"
          description="Latest customer activity in the selected brand"
          action={
            <button type="button" onClick={() => navigateToPath('/inbox')} className="text-[11px] font-semibold text-[#128C7E] hover:underline dark:text-[#25D366]">
              Open inbox
            </button>
          }
          className="xl:col-span-2"
          bodyClassName="p-0"
        >
          <DataTable
            caption="Recent conversations"
            rows={recentLeads}
            getRowKey={(lead) => lead.id}
            onRowClick={(lead) => openLead(lead.id)}
            empty={
              <div className="px-4 py-10 text-center">
                <Users className="mx-auto h-5 w-5 text-[#667781] dark:text-[#8696A0]" />
                <p className="mt-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">No conversations in this scope</p>
                <p className="mt-0.5 text-[10.5px] text-[#667781] dark:text-[#8696A0]">New WhatsApp inquiries will appear here.</p>
              </div>
            }
            columns={[
              {
                key: 'contact',
                header: 'Contact',
                render: (lead) => (
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF]">{lead.customer?.displayName || 'Unknown contact'}</p>
                    <p className="truncate font-mono text-[10px] text-[#667781] dark:text-[#8696A0]">{lead.customer?.whatsappNumber || lead.serialNumber || lead.id.slice(0, 8)}</p>
                  </div>
                ),
              },
              {
                key: 'company',
                header: 'Brand',
                render: (lead) => (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#667781] dark:text-[#8696A0]">{getLeadCompany(lead).code}</span>
                ),
              },
              {
                key: 'stage',
                header: 'Stage',
                render: (lead) => (
                  <StatusBadge tone={STAGE_TONE[lead.stage] || 'neutral'}>
                    {STAGE_CONFIG[lead.stage as LeadStage]?.label || lead.stage}
                  </StatusBadge>
                ),
              },
              {
                key: 'activity',
                header: 'Last activity',
                align: 'right',
                render: (lead) => (
                  <span className="whitespace-nowrap text-[10.5px] text-[#667781] dark:text-[#8696A0]">
                    {formatChatListTimestamp(lead.lastCustomerMessageAt || lead.updatedAt)}
                  </span>
                ),
              },
            ]}
          />
        </SectionCard>

        <SectionCard title="Recent lead activity" description="Stage changes from the audit history">
          <ActivityTimeline
            entries={activity}
            empty={
              <div className="py-6 text-center">
                <p className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">No stage changes yet</p>
                <p className="mt-0.5 text-[10.5px] text-[#667781] dark:text-[#8696A0]">Lead movements will be listed here.</p>
              </div>
            }
          />
        </SectionCard>
      </div>

      <CoordinatorLeaderboard leads={filteredLeads} companyFilter={activeCompany} />
    </div>
  );
};
