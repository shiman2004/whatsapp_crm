import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  MoreHorizontal,
  ArrowUpDown,
  Download
} from 'lucide-react';
import { ExamMaterialRequest, ExamCategory } from '../../services/examService';

interface MaterialRequestsViewProps {
  requests: ExamMaterialRequest[];
  categories: ExamCategory[];
  onOpenNewRequest: () => void;
  onViewRequest: (request: ExamMaterialRequest) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onDeleteRequest: (id: string) => void;
}

export const MaterialRequestsView: React.FC<MaterialRequestsViewProps> = ({
  requests,
  categories,
  onOpenNewRequest,
  onViewRequest,
  onUpdateStatus,
  onDeleteRequest,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.title.toLowerCase().includes(search.toLowerCase()) ||
      req.requestedBy.toLowerCase().includes(search.toLowerCase()) ||
      (req.candidateName && req.candidateName.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' ||
      req.categoryId === selectedCategory ||
      req.categoryName === selectedCategory;

    const matchesStatus =
      selectedStatus === 'all' ||
      req.status.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-[#3d2a08] text-[#fbbf24] border border-[#fbbf24]/30';
      case 'In Progress':
        return 'bg-[#0e2c4d] text-[#60a5fa] border border-[#60a5fa]/30';
      case 'Approved':
        return 'bg-[#0c3120] text-[#4ade80] border border-[#4ade80]/30';
      case 'Rejected':
        return 'bg-[#3b1219] text-[#f87171] border border-[#f87171]/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const getMaterialTypeBadge = (type: string) => {
    switch (type) {
      case 'Mock Test':
        return 'bg-[#0f2d35] text-[#2dd4bf] border border-[#2dd4bf]/30';
      case 'Study Material':
        return 'bg-[#0c2f24] text-[#34d399] border border-[#34d399]/30';
      case 'Question Bank':
        return 'bg-[#122b47] text-[#38bdf8] border border-[#38bdf8]/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, requester, candidate..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-blue-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-blue-500 transition-all"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-blue-500 transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in progress">In Progress</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Right CTA */}
        <button
          type="button"
          onClick={onOpenNewRequest}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Material Request</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 bg-[#16222a]/40">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Request Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Urgency</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-[#182730]/60 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100">
                      {req.title}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-300">
                      {req.categoryName || 'DHA'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getMaterialTypeBadge(req.type)}`}>
                        {req.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {req.requestedBy}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {req.candidateName || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold ${
                        req.urgency === 'Urgent' ? 'text-rose-400' :
                        req.urgency === 'High' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {req.urgency || 'Normal'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5 relative">
                        <button
                          type="button"
                          onClick={() => onViewRequest(req)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveDropdownId(activeDropdownId === req.id ? null : req.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {activeDropdownId === req.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-[#202c33] border border-slate-700 rounded-xl shadow-xl py-1 z-30">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStatus(req.id, 'Approved');
                                  setActiveDropdownId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-emerald-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStatus(req.id, 'In Progress');
                                  setActiveDropdownId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-blue-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Clock className="w-3 h-3" />
                                In Progress
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStatus(req.id, 'Rejected');
                                  setActiveDropdownId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-rose-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteRequest(req.id);
                                  setActiveDropdownId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-slate-400 hover:text-rose-400 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-700/50 mt-1"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No requests match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
