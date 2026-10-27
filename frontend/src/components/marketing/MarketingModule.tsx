import React from 'react';
import { API_BASE_URL } from '../../config/api';
import { useCrm } from '../../context/CrmContext';
import './marketing-redesign.css';

import {
  LayoutDashboard,
  Plus,
  Upload,
  Contact,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  RefreshCw,
  Loader2,
  AlertCircle,
  XCircle,
} from 'lucide-react';

import { MarketingPage, MarketingContact, MarketingImportBatch, MarketingTask } from './types';
import { MarketingHeader } from './MarketingHeader';
import { MarketingStats } from './MarketingStats';
import { MarketingDashboard } from './MarketingDashboard';
import { MarketingAddNumbers } from './MarketingAddNumbers';
import { MarketingUploads } from './MarketingUploads';
import { MarketingContacts } from './MarketingContacts';
import { MarketingAssignment } from './MarketingAssignment';
import { MarketingTasks } from './MarketingTasks';
import { MarketingCampaigns } from './MarketingCampaigns';
import { MarketingReports } from './MarketingReports';
import { MarketingContactDrawer } from './MarketingContactDrawer';

const pages: Array<{ id: MarketingPage; label: string; icon: React.ElementType; description: string }> = [
  { id: 'dashboard', label: 'Marketing Dashboard', icon: LayoutDashboard, description: 'Module health, KPIs and conversion rates' },
  { id: 'add', label: 'Add Public Numbers', icon: Plus, description: 'Add contacts individually, in bulk, or from CSV' },
  { id: 'uploads', label: 'My Uploads', icon: Upload, description: 'Batch ingestion records & upload error reports' },
  { id: 'contacts', label: 'Contact Database', icon: Contact, description: 'Centralized directory, consent governance & contact profiles' },
  { id: 'assignment', label: 'Contact Assignment', icon: Users, description: 'Round-robin or direct coordinator allocation' },
  { id: 'tasks', label: 'My Marketing Tasks', icon: ClipboardList, description: 'Due today, overdue follow-ups, outreach & qualification' },
  { id: 'campaigns', label: 'Campaign Content', icon: FileText, description: 'Prepare campaign drafts and approved-template content' },
  { id: 'reports', label: 'Marketing Reports', icon: BarChart3, description: 'Performance metrics, source analytics & CSV export' },
];

const pageFromHash = (): MarketingPage => {
  const hash = window.location.hash;
  if (hash.includes('content-hub') || hash.includes('/content')) {
    window.location.hash = '#/marketing/dashboard';
    return 'dashboard';
  }
  const page = hash.match(/^#\/marketing\/([^/?#]+)/)?.[1] as MarketingPage | undefined;
  return page && pages.some(item => item.id === page) ? page : 'dashboard';
};

function authToken() {
  return localStorage.getItem('rw_crm_auth_token') || '';
}

async function marketingRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken()}`,
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || 'Marketing request failed');
  }
  return body;
}

export const MarketingModule: React.FC = () => {
  const { currentUser } = useCrm();
  const [page, setPage] = React.useState<MarketingPage>(pageFromHash);

  // Core Data
  const [contacts, setContacts] = React.useState<MarketingContact[]>([]);
  const [uploads, setUploads] = React.useState<MarketingImportBatch[]>([]);
  const [tasks, setTasks] = React.useState<MarketingTask[]>([]);
  const [totalContacts, setTotalContacts] = React.useState(0);

  // Pagination & Filtering for Contact Database
  const [contactPage, setContactPage] = React.useState(1);
  const [contactPageSize] = React.useState(50);
  const [search, setSearch] = React.useState('');
  const [consentFilter, setConsentFilter] = React.useState('all');
  const [lifecycleFilter, setLifecycleFilter] = React.useState('all');
  const [assignmentFilter, setAssignmentFilter] = React.useState('all');
  const [staffFilter, setStaffFilter] = React.useState('all');
  const [batchFilter, setBatchFilter] = React.useState('all');
  const [leadStatusFilter, setLeadStatusFilter] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('all');
  const [sortFilter, setSortFilter] = React.useState('date_desc');

  const handleResetFilters = React.useCallback(() => {
    setSearch('');
    setConsentFilter('all');
    setLifecycleFilter('all');
    setAssignmentFilter('all');
    setStaffFilter('all');
    setBatchFilter('all');
    setLeadStatusFilter('all');
    setDateFilter('all');
    setSortFilter('date_desc');
    setContactPage(1);
  }, []);

  // Selected Contact Drawer
  const [selectedContactId, setSelectedContactId] = React.useState<string | null>(null);
  const [transferredContactIds, setTransferredContactIds] = React.useState<string[]>([]);

  // States
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  // Load contacts with server-side filtering
  const loadContacts = React.useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        page: String(contactPage),
        pageSize: String(contactPageSize),
        ...(search ? { search } : {}),
        ...(consentFilter !== 'all' ? { consentStatus: consentFilter } : {}),
        ...(lifecycleFilter !== 'all' ? { lifecycleStatus: lifecycleFilter } : {}),
        ...(assignmentFilter !== 'all' ? { assigned: assignmentFilter } : {}),
        ...(staffFilter !== 'all' ? { ownerId: staffFilter } : {}),
        ...(batchFilter !== 'all' ? { batchId: batchFilter } : {}),
        ...(leadStatusFilter !== 'all' ? { leadStatus: leadStatusFilter } : {}),
      });

      let sortBy = 'createdAt';
      let sortOrder = 'desc';
      if (sortFilter === 'date_asc') { sortBy = 'createdAt'; sortOrder = 'asc'; }
      else if (sortFilter === 'date_desc') { sortBy = 'createdAt'; sortOrder = 'desc'; }
      else if (sortFilter === 'phone_asc') { sortBy = 'phone'; sortOrder = 'asc'; }
      else if (sortFilter === 'phone_desc') { sortBy = 'phone'; sortOrder = 'desc'; }
      else if (sortFilter === 'serial_asc') { sortBy = 'serial'; sortOrder = 'asc'; }
      else if (sortFilter === 'serial_desc') { sortBy = 'serial'; sortOrder = 'desc'; }
      else if (sortFilter === 'source_asc') { sortBy = 'source'; sortOrder = 'asc'; }
      else if (sortFilter === 'source_desc') { sortBy = 'source'; sortOrder = 'desc'; }

      if (dateFilter !== 'all') {
        queryParams.set('dateRange', dateFilter);
      }
      queryParams.set('sortBy', sortBy);
      queryParams.set('sortOrder', sortOrder);

      const res = await marketingRequest(`/api/marketing/contacts?${queryParams.toString()}`);
      if (res?.data) {
        setContacts(res.data);
        setTotalContacts(res.pagination?.total ?? res.data.length);
      }
    } catch (e) { throw e; }
  }, [contactPage, contactPageSize, search, consentFilter, lifecycleFilter, assignmentFilter, staffFilter, batchFilter, leadStatusFilter, dateFilter, sortFilter]);

  // Load uploads
  const loadUploads = React.useCallback(async () => {
    try {
      const res = await marketingRequest('/api/marketing/uploads');
      if (res?.data) {
        setUploads(res.data);
      }
    } catch (e) { throw e; }
  }, []);

  // Load tasks
  const loadTasks = React.useCallback(async () => {
    try {
      const res = await marketingRequest('/api/marketing/tasks');
      if (res?.data) {
        setTasks(res.data);
      }
    } catch (e) { throw e; }
  }, []);

  // Master refresh
  const refreshAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadContacts(), loadUploads(), loadTasks()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to refresh marketing data');
    } finally {
      setLoading(false);
    }
  }, [loadContacts, loadUploads, loadTasks]);

  // Initial load
  React.useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Listen to sidebar sub-link navigation events
  React.useEffect(() => {
    const handleMarketingPage = (event: Event) => {
      const targetPage = (event as CustomEvent<MarketingPage>).detail;
      if (targetPage && pages.some(item => item.id === targetPage)) {
        setPage(targetPage);
        window.history.pushState({}, '', `#/marketing/${targetPage}`);
      }
    };
    window.addEventListener('marketing-page-change', handleMarketingPage);
    const handleBrowserNavigation = () => {
      const targetPage = pageFromHash();
      setPage(targetPage);
      window.dispatchEvent(new CustomEvent('marketing-page-change', { detail: targetPage }));
    };
    window.addEventListener('popstate', handleBrowserNavigation);
    window.addEventListener('hashchange', handleBrowserNavigation);
    return () => {
      window.removeEventListener('marketing-page-change', handleMarketingPage);
      window.removeEventListener('popstate', handleBrowserNavigation);
      window.removeEventListener('hashchange', handleBrowserNavigation);
    };
  }, []);

  const navigateToPage = (target: MarketingPage | string) => {
    const nextPage = target as MarketingPage;
    setPage(nextPage);
    setError('');
    setNotice('');
    window.history.pushState({}, '', `#/marketing/${nextPage}`);
    window.dispatchEvent(new CustomEvent('marketing-page-change', { detail: nextPage }));
  };

  const currentTab = pages.find(item => item.id === page) || pages[0];

  return (
    <section className="h-full min-h-0 flex flex-col gap-4 text-slate-100 p-3 sm:p-5 overflow-y-auto">
      {/* 1. Header & Breadcrumbs */}
      <MarketingHeader pageLabel={currentTab.label} onNavigate={navigateToPage} />

      {page !== 'dashboard' && (
        <MarketingStats
          contactsCount={totalContacts || contacts.length}
          batchesCount={uploads.length}
        />
      )}

      {/* 3. Module Workspace with Sub-Navigation */}
      <div className="flex-1 min-h-0 grid grid-cols-1 gap-4 items-start">
        {/* Main Content Pane */}
        <main className={page === 'dashboard' ? 'min-w-0 flex flex-col' : 'min-w-0 rounded-xl border border-slate-800 bg-[#0D1526]/60 overflow-hidden shadow-lg flex flex-col'}>
          {page !== 'dashboard' && (
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60 shrink-0">
              <div>
                <h2 className="font-extrabold text-white text-sm">{currentTab.label}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{currentTab.description}</p>
              </div>
              <button
                type="button"
                onClick={() => void refreshAll()}
                className="p-2 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition-colors"
                aria-label="Refresh marketing data"
                title="Refresh marketing data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
              </button>
            </div>
          )}

          {/* Inline Feedback Alerts */}
          {error && (
            <div className="mx-4 mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss error">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {notice && (
            <div className="mx-4 mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1">{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Module Views */}
          <div className="min-h-[500px]">
            {page === 'dashboard' && (
              <MarketingDashboard
                contacts={contacts}
                uploads={uploads}
                loading={loading}
                onNavigate={navigateToPage}
                onRequestApi={marketingRequest}
              />
            )}

            {page === 'add' && (
              <MarketingAddNumbers
                onContactCreated={() => {
                  void refreshAll();
                  setNotice('Contact successfully added and normalized.');
                }}
                onRequestApi={marketingRequest}
                onNavigateToAssignment={() => navigateToPage('assignment')}
              />
            )}

            {page === 'uploads' && (
              <MarketingUploads
                uploads={uploads}
                loading={loading}
                onRequestApi={marketingRequest}
                onRefresh={loadUploads}
              />
            )}

            {page === 'contacts' && (
              <MarketingContacts
                contacts={contacts}
                loading={loading}
                onRequestApi={marketingRequest}
                onRefresh={loadContacts}
                onSelectContact={c => setSelectedContactId(c.id)}
                onBulkAssign={contactIds => {
                  navigateToPage('assignment');
                }}
                onBulkSuppress={async contactIds => {
                  try {
                    await Promise.all(
                      contactIds.map(id =>
                        marketingRequest(`/api/marketing/contacts/${id}/suppress`, {
                          method: 'POST',
                          body: JSON.stringify({ reason: 'Bulk suppression' }),
                        })
                      )
                    );
                    setNotice(`Suppressed ${contactIds.length} contact(s) to DND.`);
                    void refreshAll();
                  } catch (e) {
                    setError('Failed to suppress contacts');
                  }
                }}
                totalContacts={totalContacts}
                page={contactPage}
                pageSize={contactPageSize}
                onPageChange={newPage => {
                  setContactPage(newPage);
                }}
                search={search}
                onSearchChange={val => {
                  setSearch(val);
                  setContactPage(1);
                }}
                consentFilter={consentFilter}
                onConsentFilterChange={val => {
                  setConsentFilter(val);
                  setContactPage(1);
                }}
                lifecycleFilter={lifecycleFilter}
                onLifecycleFilterChange={val => {
                  setLifecycleFilter(val);
                  setContactPage(1);
                }}
                assignmentFilter={assignmentFilter}
                onAssignmentFilterChange={val => {
                  setAssignmentFilter(val);
                  setContactPage(1);
                }}
                staffFilter={staffFilter}
                onStaffFilterChange={val => {
                  setStaffFilter(val);
                  setContactPage(1);
                }}
                batchFilter={batchFilter}
                onBatchFilterChange={val => {
                  setBatchFilter(val);
                  setContactPage(1);
                }}
                leadStatusFilter={leadStatusFilter}
                onLeadStatusFilterChange={val => {
                  setLeadStatusFilter(val);
                  setContactPage(1);
                }}
                dateFilter={dateFilter}
                onDateFilterChange={val => {
                  setDateFilter(val);
                  setContactPage(1);
                }}
                sortFilter={sortFilter}
                onSortFilterChange={val => {
                  setSortFilter(val);
                  setContactPage(1);
                }}
                uploads={uploads}
                onResetFilters={handleResetFilters}
              />
            )}

            {page === 'assignment' && (
              <MarketingAssignment
                loading={loading}
                onRequestApi={marketingRequest}
                onAssignmentComplete={() => {
                  void refreshAll();
                  navigateToPage('contacts');
                }}
              />
            )}

            {page === 'tasks' && (
              <MarketingTasks
                tasks={tasks}
                loading={loading}
                onRequestApi={marketingRequest}
                onSelectContact={c => setSelectedContactId(c.id)}
                onRefresh={() => void loadTasks()}
              />
            )}

            {page === 'campaigns' && (
              <MarketingCampaigns
                loading={loading}
                onRequestApi={marketingRequest}
              />
            )}

            {page === 'reports' && (
              <MarketingReports
                loading={loading}
                onRequestApi={marketingRequest}
              />
            )}
          </div>
        </main>
      </div>

      {/* Slide-over Contact Detail & Follow-up Drawer */}
      {selectedContactId && (
        <MarketingContactDrawer
          contactId={selectedContactId}
          onClose={() => setSelectedContactId(null)}
          onRequestApi={marketingRequest}
          onContactUpdated={() => void refreshAll()}
        />
      )}
    </section>
  );
};
