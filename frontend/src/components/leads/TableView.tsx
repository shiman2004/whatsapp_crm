import React, { useState, useEffect, useRef } from 'react';
import { Lead } from '../../types';
import { StageBadge } from './StageBadge';
import { useCrm } from '../../context/CrmContext';
import { CompanyTagBadge } from '../common/CompanyTagBadge';
import { PatientContactDrawer } from './PatientContactDrawer';
import { 
  ChevronRight, 
  Clock, 
  UserCheck, 
  AlertTriangle,
  Lock,
  Globe,
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
  StickyNote,
  Plus,
  X,
  Pencil,
  Save,
  User,
  Clock as NoteClock
} from 'lucide-react';
import { 
  getWindowStatus, 
  formatWindowCountdown, 
  formatWindowTimestamp,
  getLatestCustomerMessageTime 
} from '../../utils/window24hUtils';

interface TableViewProps {
  leads: Lead[];
  onSelectLead: (leadId: string) => void;
  company?: 'RWC' | 'CRAS' | 'ALL';
}

/**
 * Generates clean 2-letter initials from customer display name
 */
function getCustomerInitials(name?: string): string {
  if (!name) return 'WA';
  const clean = name.replace(/[\u{1F600}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '')
                    .replace(/[^a-zA-Z0-9\s]/g, '')
                    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 1) return parts[0].slice(0, 2).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || 'WA';
}

/**
 * Deterministically assigns a vibrant, premium avatar color based on customer name
 */
function getAvatarColor(name?: string): string {
  const colors = [
    'bg-teal-600 text-white',
    'bg-sky-600 text-white',
    'bg-indigo-600 text-white',
    'bg-purple-600 text-white',
    'bg-rose-600 text-white',
    'bg-amber-600 text-white',
    'bg-emerald-600 text-white',
    'bg-blue-600 text-white',
    'bg-cyan-600 text-white'
  ];
  let hash = 0;
  const str = name || 'Customer';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Filter out known placeholder stock photos
 */
function isFakeAvatar(url?: string): boolean {
  if (!url) return true;
  return url.includes('photo-1534528741775-53994a69daeb') || url.includes('unsplash.com/photo-');
}

export const TableView: React.FC<TableViewProps> = ({ leads, onSelectLead, company = 'RWC' }) => {
  const { 
    categories, 
    treatments, 
    users, 
    messages, 
    selectedLeadId, 
    isLeadsOfficer, 
    canModifyAssignment, 
    assignLead,
    updateLeadSource,
    notes,
    addLeadNote,
    updateLeadNote
  } = useCrm();

  // Scroll container ref for direct "Scroll to Bottom" and "Scroll to Top"
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [noteLeadId, setNoteLeadId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [patientDrawerLeadId, setPatientDrawerLeadId] = useState<string | null>(null);
  const patientClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [treatmentSort, setTreatmentSort] = useState<'asc' | 'desc' | null>(null);

  // Real-time ticking clock (ticks every 1s for accurate 24h countdown)
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor scroll position to show back to top helper
  const handleScroll = () => {
    if (tableContainerRef.current) {
      const { scrollTop } = tableContainerRef.current;
      setShowScrollTop(scrollTop > 200);
    }
  };

  const scrollToBottom = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({
        top: tableContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const isCras = company === 'CRAS';
  const coordinators = users.filter(u => u.role === 'coordinator');
  const displayedLeads = treatmentSort
    ? [...leads].sort((a, b) => {
        const getTreatmentName = (lead: Lead) => {
          const treatment = treatments.find(t => t.id === lead.treatmentId)?.name;
          const category = categories.find(c => c.id === lead.categoryId)?.name;
          return (treatment || category || '').toLocaleLowerCase();
        };
        const comparison = getTreatmentName(a).localeCompare(getTreatmentName(b));
        return treatmentSort === 'asc' ? comparison : -comparison;
      })
    : leads;
  const noteLead = noteLeadId ? leads.find(lead => lead.id === noteLeadId) : null;
  const leadNotes = noteLeadId ? notes.filter(note => note.leadId === noteLeadId) : [];
  const patientDrawerLead = patientDrawerLeadId ? leads.find(lead => lead.id === patientDrawerLeadId) : null;

  const handlePatientClick = (leadId: string) => {
    if (patientClickTimerRef.current) clearTimeout(patientClickTimerRef.current);
    patientClickTimerRef.current = setTimeout(() => {
      setPatientDrawerLeadId(leadId);
      patientClickTimerRef.current = null;
    }, 220);
  };

  const handlePatientDoubleClick = (leadId: string) => {
    if (patientClickTimerRef.current) clearTimeout(patientClickTimerRef.current);
    patientClickTimerRef.current = null;
    setPatientDrawerLeadId(null);
    onSelectLead(leadId);
  };

  const openNotes = (lead: Lead) => {
    setNoteLeadId(lead.id);
    setNoteText('');
    setEditingNoteId(null);
  };

  const closeNotes = () => {
    setNoteLeadId(null);
    setNoteText('');
    setEditingNoteId(null);
  };

  const saveNote = (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteText.trim() || !noteLeadId) return;
    if (editingNoteId) updateLeadNote(editingNoteId, noteText);
    else addLeadNote(noteLeadId, noteText);
    setNoteText('');
    setEditingNoteId(null);
  };

  /**
   * Resolves visual badge & icon for lead acquisition source (Facebook, Instagram, WhatsApp, Website)
   */
  const resolveSourceInfo = (src?: string) => {
    const s = String(src || '').toLowerCase().trim();
    if (s === 'facebook' || s === 'fb' || s.includes('fb') || s.includes('facebook')) {
      return {
        key: 'facebook',
        label: 'Facebook',
        badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25',
        icon: (
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )
      };
    }
    if (s === 'instagram' || s === 'insta' || s === 'ig' || s.includes('insta')) {
      return {
        key: 'instagram',
        label: 'Instagram',
        badgeClass: 'bg-gradient-to-r from-pink-500/15 via-rose-500/15 to-purple-500/15 text-pink-400 border-pink-500/30 hover:opacity-90',
        icon: (
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        )
      };
    }
    if (s === 'website' || s === 'web') {
      return {
        key: 'website',
        label: 'Website',
        badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25',
        icon: <Globe className="w-3.5 h-3.5 shrink-0" />
      };
    }
    // Default WhatsApp
    return {
      key: 'whatsapp',
      label: 'WhatsApp',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
      icon: (
        <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
      )
    };
  };

  /**
   * Renders the authentic customer profile avatar (Initials circle or verified custom uploaded image)
   */
  const renderCustomerAvatar = (displayName?: string, avatarUrl?: string) => {
    const hasCustomPhoto = Boolean(avatarUrl && !isFakeAvatar(avatarUrl));
    const initials = getCustomerInitials(displayName);
    const colorClass = getAvatarColor(displayName);

    if (hasCustomPhoto) {
      return (
        <img
          src={avatarUrl}
          alt={displayName || 'Customer'}
          className="w-9 h-9 rounded-full object-cover border border-slate-700/80 shrink-0 shadow-xs"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      );
    }

    return (
      <div 
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border border-white/10 shadow-xs ${colorClass}`}
        title={displayName || 'Customer'}
      >
        {initials}
      </div>
    );
  };

  /**
   * Renders Real 24-Hour WhatsApp Service Window countdown & status badge
   */
  const render24hWindowCell = (lead: Lead) => {
    const lastCustomerMsgTime = getLatestCustomerMessageTime(lead, messages);
    const hasCustomerMessage = lastCustomerMsgTime > 0 && !isNaN(lastCustomerMsgTime);
    const expiresAt = hasCustomerMessage ? lastCustomerMsgTime + (24 * 60 * 60 * 1000) : 0;
    const remainingMs = expiresAt > 0 ? Math.max(0, expiresAt - now) : 0;
    const isExpired = !hasCustomerMessage || remainingMs <= 0;

    if (isExpired) {
      return (
        <div 
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-slate-800/80 border-slate-700 text-slate-400 whitespace-nowrap shadow-xs"
          title={hasCustomerMessage ? `24H Window Expired.\nCustomer last replied: ${formatWindowTimestamp(lastCustomerMsgTime)}` : 'No customer messages received yet'}
        >
          <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
          <span>Expired</span>
        </div>
      );
    }

    const countdownText = formatWindowCountdown(remainingMs);
    const remainingHours = remainingMs / (1000 * 60 * 60);

    let statusStyle = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    let dotStyle = 'bg-emerald-400';

    if (remainingHours <= 1) {
      statusStyle = 'bg-rose-500/15 border-rose-500/30 text-rose-400';
      dotStyle = 'bg-rose-500 animate-ping';
    } else if (remainingHours <= 6) {
      statusStyle = 'bg-amber-500/15 border-amber-500/30 text-amber-400';
      dotStyle = 'bg-amber-400';
    }

    return (
      <div 
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shadow-xs transition-colors ${statusStyle}`}
        title={`24H Service Window Active (${countdownText} remaining)\nCustomer Last Replied: ${formatWindowTimestamp(lastCustomerMsgTime)}\nExpires: ${formatWindowTimestamp(expiresAt)}`}
      >
        <span className={`w-2 h-2 rounded-full ${dotStyle} shrink-0`} />
        <span className="font-mono font-bold tracking-tight text-xs">{countdownText}</span>
      </div>
    );
  };

  /**
   * Renders Coordinator's First Message Time and response latency after lead assignment
   */
  const renderFirstResponseCell = (lead: Lead) => {
    if (!lead.assignedTo) {
      return <span className="text-slate-500 font-mono text-xs">—</span>;
    }

    const assignedTime = lead.assignedAt ? new Date(lead.assignedAt).getTime() : 0;

    // Outbound messages for this lead
    const leadMsgs = (messages || []).filter(m => m.leadId === lead.id);
    const outbound = leadMsgs.filter(m => m.direction === 'outbound');

    // Find first outbound message sent at or after assignment
    const coordReplies = outbound.filter(m => {
      const t = new Date(m.timestamp || m.createdAt).getTime();
      if (assignedTime > 0 && t < assignedTime - 60000) return false;
      return true;
    }).sort((a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime());

    const firstReply = coordReplies[0];

    if (firstReply) {
      const replyTime = new Date(firstReply.timestamp || firstReply.createdAt).getTime();
      const delayMs = assignedTime > 0 ? Math.max(0, replyTime - assignedTime) : 0;

      let delayText = '< 1m';
      let delayColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

      if (assignedTime > 0) {
        const delayMinutes = Math.floor(delayMs / 60000);
        const delayHours = Math.floor(delayMinutes / 60);
        const delayDays = Math.floor(delayHours / 24);

        if (delayDays > 0) {
          delayText = `+${delayDays}d ${delayHours % 24}h`;
          delayColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        } else if (delayHours > 0) {
          delayText = `+${delayHours}h ${delayMinutes % 60}m`;
          delayColor = delayHours >= 2 
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-sky-500/15 text-sky-400 border-sky-500/30';
        } else if (delayMinutes > 0) {
          delayText = `+${delayMinutes}m`;
          delayColor = delayMinutes > 15
            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        }
      }

      const d = new Date(replyTime);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return (
        <div 
          className="flex flex-col gap-1 whitespace-nowrap"
          title={`First reply sent on ${d.toLocaleString()}${assignedTime > 0 ? ` (${delayText} after assignment)` : ''}`}
        >
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold font-mono text-xs whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{dateStr}, {timeStr}</span>
          </div>
          {assignedTime > 0 && (
            <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-mono font-bold border whitespace-nowrap ${delayColor}`}>
              {delayText}
            </span>
          )}
        </div>
      );
    }

    // No coordinator message sent yet
    if (assignedTime > 0) {
      const elapsedMs = Math.max(0, now - assignedTime);
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      const elapsedHours = Math.floor(elapsedMinutes / 60);
      const elapsedDays = Math.floor(elapsedHours / 24);

      let elapsedText = `${elapsedMinutes}m`;
      if (elapsedDays > 0) elapsedText = `${elapsedDays}d ${elapsedHours % 24}h`;
      else if (elapsedHours > 0) elapsedText = `${elapsedHours}h ${elapsedMinutes % 60}m`;

      const isLongWait = elapsedMinutes >= 30;

      return (
        <div 
          className="flex flex-col gap-1 whitespace-nowrap"
          title={`Assigned at ${new Date(assignedTime).toLocaleString()}.\nNo coordinator reply sent yet (${elapsedText} waiting).`}
        >
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
            isLongWait 
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' 
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}>
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>No Reply Yet</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
            Waiting {elapsedText}
          </span>
        </div>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
        No Reply Yet
      </span>
    );
  };

  /**
   * Renders Assigner info (Assigned By)
   */
  const renderAssignedByCell = (lead: Lead) => {
    if (!lead.assignedTo) {
      return <span className="text-slate-500 font-mono text-xs">—</span>;
    }

    const assignerName = lead.assignedByName ||
      lead.assignmentHistories?.[0]?.assignedByName ||
      (lead.assignedById ? users.find(u => u.id === lead.assignedById)?.fullName : null) ||
      'System';

    return (
      <div 
        className="flex items-center gap-2 whitespace-nowrap"
        title={`Assigned by ${assignerName}`}
      >
        <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-teal-400 shrink-0 shadow-xs">
          {assignerName.charAt(0).toUpperCase()}
        </div>
        <span className="font-semibold text-slate-200 text-xs whitespace-nowrap leading-tight">{assignerName}</span>
      </div>
    );
  };

  /**
   * Renders Assigned Time and Date between Assigned By and 1st Response
   */
  const renderAssignedTimeAndDateCell = (lead: Lead) => {
    if (!lead.assignedTo) {
      return <span className="text-slate-500 font-mono text-xs">—</span>;
    }

    const rawDate = lead.assignedAt || lead.assignmentHistories?.[0]?.assignedAt;
    if (!rawDate) {
      return <span className="text-slate-500 font-mono text-xs">—</span>;
    }

    const d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      return <span className="text-slate-500 font-mono text-xs">—</span>;
    }

    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div 
        className="flex items-center gap-1.5 text-slate-300 font-mono text-xs whitespace-nowrap"
        title={`Assigned at ${d.toLocaleString()}`}
      >
        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>{dateStr}, <span className="text-slate-400">{timeStr}</span></span>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl mt-3 flex flex-col">
      {/* Sub-header Controls Bar with Direct Scroll Navigation */}
      <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-slate-200 text-sm">
            {leads.length} {leads.length === 1 ? 'Lead' : 'Leads'}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-xs text-slate-400">
            Pipeline Management Table
          </span>
        </div>

        {/* Scroll Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scrollToBottom}
            className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Scroll directly to the bottom of the table"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Scroll to Bottom</span>
          </button>
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Scroll back to top of the table"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Back to Top</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Table View with Sticky Header and Guaranteed Column Widths */}
      <div 
        ref={tableContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
      >
        <table className="w-full text-left border-collapse text-xs min-w-[2040px]">
          <thead className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/95 shadow-md">
            <tr className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[11px] whitespace-nowrap">
              <th className="py-3.5 px-3 min-w-[60px] text-center">No.</th>
              <th className="py-3.5 px-3 min-w-[120px]">Serial No.</th>
              <th className="py-3.5 px-4 min-w-[240px]">{isCras ? 'Student / Contact' : 'Patient / Contact'}</th>
              <th className="py-3.5 px-2 min-w-[90px]">Source</th>
              <th className="py-3.5 px-2 text-center min-w-[65px] max-w-[120px]">Lang</th>
              <th className="py-3.5 px-2 text-center min-w-[70px]">Notes</th>
              <th className="py-3.5 px-4 min-w-[220px]">
                <button
                  type="button"
                  onClick={() => setTreatmentSort(current => current === null ? 'asc' : current === 'asc' ? 'desc' : null)}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                  title="Sort by treatment or service"
                >
                  {isCras ? 'Course / Program' : 'Treatment / Service'}
                  <span className="text-[9px]">{treatmentSort === 'asc' ? '↑' : treatmentSort === 'desc' ? '↓' : '↕'}</span>
                </button>
              </th>
              <th className="py-3.5 px-3 min-w-[130px]">Source</th>
              <th className="py-3.5 px-2 text-center min-w-[65px]">Lang</th>
              <th className="py-3.5 px-4 min-w-[220px]">{isCras ? 'Course / Program' : 'Treatment / Service'}</th>
              <th className="py-3.5 px-4 min-w-[150px]">{isCras ? 'Admissions Stage' : 'Stage'}</th>
              <th className="py-3.5 px-4 min-w-[260px]">{isCras ? 'Assigned Counsellor' : 'Assigned Coordinator'}</th>
              <th className="py-3.5 px-3 min-w-[160px]">Assigned By</th>
              <th className="py-3.5 px-3 min-w-[160px]">In_Receive Time</th>
              <th className="py-3.5 px-3 min-w-[180px]">Assign Time</th>
              <th className="py-3.5 px-3 min-w-[170px]">1st Response</th>
              <th className="py-3.5 px-3 min-w-[160px]">24h Window</th>
              <th className="py-3.5 px-4 text-right min-w-[90px]">Action</th>
              {/* Treatment / Service remains available through the existing sort state but is omitted from this compact table order. */}
              {/*
                <button
                  type="button"
                  onClick={() => setTreatmentSort(current => current === null ? 'asc' : current === 'asc' ? 'desc' : null)}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                  title="Sort by treatment or service"
                >
                  {isCras ? 'Course / Program' : 'Treatment / Service'}
                  <span className="text-[9px]">{treatmentSort === 'asc' ? '↑' : treatmentSort === 'desc' ? '↓' : '↕'}</span>
                </button>
              */}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <SlidersHorizontal className="w-8 h-8 text-slate-600" />
                    <p className="text-sm font-medium">No leads found matching your filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayedLeads.map((lead, index) => {
                const category = categories.find(c => c.id === lead.categoryId);
                const treatment = treatments.find(t => t.id === lead.treatmentId);
                const coordinator = users.find(u => u.id === lead.assignedTo);
                const isSelected = selectedLeadId === lead.id;
                const isCrasLead = lead.company === 'CRAS';
                const sourceInfo = resolveSourceInfo(lead.source);

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-950/40' : ''
                    }`}
                  >
                    {/* 1. Sequential row number for the current displayed order */}
                    <td className="py-3.5 px-3 text-center min-w-[60px] whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-300">{String(index + 1).padStart(3, '0')}</span>
                    </td>

                    {/* 2. Company-scoped unique lead serial */}
                    <td className="py-3.5 px-3 min-w-[120px] whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md border text-[10px] font-mono font-bold ${isCrasLead ? 'bg-rose-950/60 text-rose-300 border-rose-500/40' : 'bg-teal-950/60 text-teal-300 border-teal-500/40'}`} title="Unique company lead serial">
                        {lead.serialNumber || 'Pending'}
                      </span>
                    </td>

                    {/* 5. Customer Contact & Authentic Avatar */}
                    <td className="py-3.5 px-4 min-w-[240px]" onClick={(event) => { event.stopPropagation(); handlePatientClick(lead.id); }} onDoubleClick={(event) => { event.stopPropagation(); handlePatientDoubleClick(lead.id); }}>
                      <div className="flex items-center gap-3">
                        {renderCustomerAvatar(lead.customer?.displayName, lead.customer?.avatarUrl)}
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-100 text-xs truncate">{lead.customer?.displayName}</p>
                            <CompanyTagBadge lead={lead} size="xs" />
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{lead.customer?.whatsappNumber}</p>
                        </div>
                      </div>
                    </td>

                    {/* 6. Source Channel (icon-only) */}
                    <td className="py-3.5 px-2 min-w-[90px]" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <div 
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-all shadow-xs whitespace-nowrap ${sourceInfo.badgeClass}`}
                          title={`Source: ${sourceInfo.label}. Click to switch acquisition channel.`}
                        >
                          {sourceInfo.icon}
                        </div>
                        {canModifyAssignment(lead) && (
                          <select
                            value={sourceInfo.key}
                            onChange={(e) => updateLeadSource(lead.id, e.target.value)}
                            aria-label="Change Lead Source"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title={`Current Source: ${sourceInfo.label}. Click to change (WhatsApp, Facebook, Instagram, Website).`}
                          >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="facebook">Facebook</option>
                            <option value="instagram">Instagram</option>
                            <option value="website">Website</option>
                          </select>
                        )}
                      </div>
                    </td>

                    {/* 7. Language */}
                    <td className="py-3.5 px-2 text-center min-w-[65px] max-w-[120px]">
                      <span className="inline-block max-w-full px-2 py-0.5 rounded font-mono font-bold uppercase text-[10px] leading-relaxed bg-slate-800 text-slate-300 border border-slate-700 break-words">
                        {lead.language}
                      </span>
                    </td>

                    {/* 6. Internal Notes */}
                    <td className="py-3.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => openNotes(lead)} className={`relative inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${lead.notesCount ? 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25' : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-teal-300 hover:border-teal-500/40'}`} title={`Open notes${lead.notesCount ? ` (${lead.notesCount})` : ''}`} aria-label={`Open notes for ${lead.customer?.displayName || 'lead'}`}>
                        <StickyNote className="w-4 h-4" />
                        {lead.notesCount ? <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-teal-500 text-[9px] leading-3.5 text-slate-950 font-bold">{lead.notesCount}</span> : null}
                      </button>
                    </td>

                    {/* 7. Treatment / Course */}
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="flex flex-col gap-0.5">
                        <p className={`font-semibold text-xs leading-tight ${isCrasLead ? 'text-rose-400' : 'text-teal-400'}`}>
                          {treatment?.name || category?.name || (isCrasLead ? 'Course Not Selected' : 'Treatment Not Selected')}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-tight">{category?.name}</p>
                      </div>
                    </td>

                    {/* 7. Stage */}
                    <td className="py-3.5 px-4 min-w-[150px] whitespace-nowrap">
                      <StageBadge stage={lead.stage} />
                    </td>

                    {/* 8. Coordinator (Wide, Clear, Never Truncated) */}
                    <td className="py-3.5 px-4 min-w-[260px]" onClick={(e) => e.stopPropagation()}>
                      {canModifyAssignment(lead) ? (
                        <select
                          value={lead.assignedTo || ''}
                          onChange={(e) => assignLead(lead.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-teal-500 cursor-pointer w-full min-w-[240px] shadow-sm"
                        >
                          <option value="">{lead.assignedTo ? '-- Unassign Staff --' : (isCrasLead ? '-- Assign Counsellor --' : '-- Assign Coordinator --')}</option>
                          {coordinators.filter(c => isCrasLead ? c.company === 'CRAS' : (c.company === 'RWC' || !c.company)).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName} ({c.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator'})
                            </option>
                          ))}
                        </select>
                      ) : isLeadsOfficer && lead.assignedTo ? (
                        <div 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 font-medium whitespace-nowrap"
                          title="Assignment locked. Once assigned, only Super Admin can reassign this lead."
                        >
                          <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span className="truncate">{coordinator?.fullName || 'Assigned Coordinator'}</span>
                          <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-0.5 shrink-0 font-bold">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-300 whitespace-nowrap">
                          {coordinator ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span className="font-medium text-slate-200">{coordinator.fullName}</span>
                            </>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Unassigned
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 9. Assigned By (Clear Avatar + Name) */}
                    <td className="py-3.5 px-3 min-w-[160px] whitespace-nowrap">
                      {renderAssignedByCell(lead)}
                    </td>

                    {/* 10. Receive */}
                    <td className="py-3.5 px-3 text-slate-300 font-mono text-xs whitespace-nowrap min-w-[160px]">
                      {new Date(lead.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{', '}
                      <span className="text-slate-400">{new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>

                    {/* 11. Assigned Time and Date */}
                    <td className="py-3.5 px-3 min-w-[180px] whitespace-nowrap">
                      {renderAssignedTimeAndDateCell(lead)}
                    </td>

                    {/* 11. 1st Response Time from Coordinator (Single-line timestamp + Latency Badge) */}
                    <td className="py-3.5 px-3 min-w-[170px] whitespace-nowrap">
                      {renderFirstResponseCell(lead)}
                    </td>

                    {/* 11. Real 24h Window Remaining Time */}
                    <td className="py-3.5 px-3 min-w-[160px] whitespace-nowrap">
                      {render24hWindowCell(lead)}
                    </td>

                    {/* 12. Action */}
                    <td className="py-3.5 px-4 text-right min-w-[90px] whitespace-nowrap">
                      <button
                        onClick={() => onSelectLead(lead.id)}
                        className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 border border-teal-500/30 text-xs font-semibold inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        <span>Chat</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {patientDrawerLead && <PatientContactDrawer lead={patientDrawerLead} onClose={() => setPatientDrawerLeadId(null)} />}

      {noteLead && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4" onMouseDown={closeNotes}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">Notes · {noteLead.customer?.displayName || 'Lead'}</p>
                <p className="text-[10px] text-slate-500 font-mono">{noteLead.serialNumber || 'Lead record'} · Internal only</p>
              </div>
              <button type="button" onClick={closeNotes} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close notes"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto p-4 space-y-2.5">
              {leadNotes.length === 0 ? <p className="py-5 text-center text-xs text-slate-500">No internal notes added yet.</p> : leadNotes.map((note) => (
                <div key={note.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="text-teal-300 font-semibold flex items-center gap-1"><User className="w-3 h-3" />{note.authorName}</span>
                    <span className="font-mono flex items-center gap-1"><NoteClock className="w-2.5 h-2.5" />{new Date(note.updatedAt || note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">{note.note}</p>
                  <button type="button" onClick={() => { setEditingNoteId(note.id); setNoteText(note.note); }} className="text-[10px] text-slate-400 hover:text-teal-300 inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit note</button>
                </div>
              ))}
            </div>
            <form onSubmit={saveNote} className="p-4 border-t border-slate-800 space-y-2">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5 text-teal-400" />{editingNoteId ? 'Edit internal note' : 'Add internal note'}</label>
              <textarea rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder={isCras ? 'Add academic background, course requirements, or tuition fee quotes...' : 'Add clinical observations, consultant availability, or price quotes...'} className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500" autoFocus />
              <div className="flex justify-end gap-2">
                {editingNoteId && <button type="button" onClick={() => { setEditingNoteId(null); setNoteText(''); }} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white">Cancel</button>}
                <button type="submit" disabled={!noteText.trim()} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold inline-flex items-center gap-1.5">{editingNoteId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}{editingNoteId ? 'Update Note' : 'Save Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom status footer */}
      <div className="px-5 py-2.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-xs" /> Active Window (&gt;6h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-xs" /> Expiring Soon (1-6h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-xs" /> Urgent (&lt;1h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500 inline-block shadow-xs" /> Expired (&gt;24h)
          </span>
        </div>

        <button
          type="button"
          onClick={scrollToTop}
          className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer text-xs font-medium"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Back to Top</span>
        </button>
      </div>
    </div>
  );
};
