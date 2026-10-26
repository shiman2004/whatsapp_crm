import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  Trash2,
  PackageCheck
} from 'lucide-react';
import { ExamProvision, ExamCategory, examService } from '../../services/examService';

interface ExamProvisionViewProps {
  provisions: ExamProvision[];
  categories: ExamCategory[];
  onRefresh: () => void;
}

export const ExamProvisionView: React.FC<ExamProvisionViewProps> = ({
  provisions,
  categories,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [candidateName, setCandidateName] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-dha');
  const [packageName, setPackageName] = useState('');
  const [validMonths, setValidMonths] = useState(6);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredProvisions = provisions.filter((p) => {
    const matchesSearch =
      p.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      p.packageName.toLowerCase().includes(search.toLowerCase()) ||
      (p.candidatePhone && p.candidatePhone.includes(search));
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !packageName.trim()) return;

    try {
      setLoading(true);
      const selCat = categories.find(c => c.id === categoryId);
      const validUntil = new Date(Date.now() + validMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

      await examService.createProvision({
        candidateName: candidateName.trim(),
        candidatePhone: candidatePhone.trim(),
        candidateEmail: candidateEmail.trim(),
        categoryId,
        categoryName: selCat?.name || 'DHA',
        packageName: packageName.trim(),
        validUntil,
        notes: notes.trim(),
      });

      setCandidateName('');
      setCandidatePhone('');
      setCandidateEmail('');
      setPackageName('');
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to provision exam');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Revoke access and delete this exam provision record?')) {
      await examService.deleteProvision(id);
      onRefresh();
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate, phone, package..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Provision Exam Access</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 bg-[#16222a]/40">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Package Name</th>
                <th className="py-3 px-4">Provision Date</th>
                <th className="py-3 px-4">Valid Until</th>
                <th className="py-3 px-4">Access Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProvisions.length > 0 ? (
                filteredProvisions.map((prov, idx) => (
                  <tr key={prov.id} className="hover:bg-[#182730]/60 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100">
                      <div>{prov.candidateName}</div>
                      {prov.candidatePhone && (
                        <div className="text-[10px] text-slate-400 font-normal font-mono">{prov.candidatePhone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-300">
                      {prov.categoryName}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {prov.packageName}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {formatDate(prov.provisionDate)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {formatDate(prov.validUntil)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        prov.accessStatus === 'Active'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {prov.accessStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(prov.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                        title="Revoke access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No candidates provisioned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Provision Candidate Exam Package</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-xs">
                Close
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Candidate Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Candidate Name"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+971 50 xxx xxxx"
                    value={candidatePhone}
                    onChange={(e) => setCandidatePhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="candidate@example.com"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Validity</label>
                  <select
                    value={validMonths}
                    onChange={(e) => setValidMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                  >
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months (1 Year)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Package Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DHA Comprehensive Nurse Preparation Package"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Grant Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
