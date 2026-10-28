import React, { useState } from 'react';
import {
  FileText,
  Search,
  UploadCloud,
  Download,
  Trash2,
  ExternalLink,
  Tag,
  Briefcase,
  FileCode,
  HardDrive
} from 'lucide-react';
import { ExamMaterial, ExamCategory } from '../../services/examService';
import { API_BASE_URL } from '../../config/api';

const resolveMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface ExamMaterialsViewProps {
  materials: ExamMaterial[];
  categories: ExamCategory[];
  selectedCategoryCode?: string;
  onOpenUpload: () => void;
  onDeleteMaterial: (id: string) => void;
  onIncrementDownload: (id: string) => void;
}

export const ExamMaterialsView: React.FC<ExamMaterialsViewProps> = ({
  materials,
  categories,
  selectedCategoryCode,
  onOpenUpload,
  onDeleteMaterial,
  onIncrementDownload,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(selectedCategoryCode || 'all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredMaterials = materials.filter((mat) => {
    const matchesSearch =
      mat.title.toLowerCase().includes(search.toLowerCase()) ||
      (mat.description && mat.description.toLowerCase().includes(search.toLowerCase())) ||
      (mat.targetProfession && mat.targetProfession.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      categoryFilter === 'all' ||
      mat.categoryId === categoryFilter ||
      mat.categoryName.toUpperCase() === categoryFilter.toUpperCase();

    const matchesType = typeFilter === 'all' || mat.type === typeFilter;

    return matchesSearch && matchesCategory && matchesType;
  });

  const getFormatBadge = (fileType?: string, fileName?: string) => {
    const name = (fileName || '').toLowerCase();
    const mime = (fileType || '').toLowerCase();

    if (name.endsWith('.pdf') || mime.includes('pdf')) {
      return { label: 'PDF', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
    if (name.endsWith('.zip') || name.endsWith('.rar') || mime.includes('zip')) {
      return { label: 'ZIP', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    }
    if (name.endsWith('.mp4') || name.endsWith('.mov') || mime.includes('video')) {
      return { label: 'VIDEO', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    }
    if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) {
      return { label: 'DOC', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    }
    if (name.endsWith('.ppt') || name.endsWith('.pptx') || mime.includes('powerpoint')) {
      return { label: 'PPT', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
    }
    return { label: 'DOC', bg: 'bg-slate-700 text-slate-300 border-slate-600' };
  };

  const handleDownload = (mat: ExamMaterial) => {
    onIncrementDownload(mat.id);
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('rw_crm_auth_token') || localStorage.getItem('royal_crm_token') || '')
      : '';

    let targetUrl = mat.externalUrl;
    if (!targetUrl) {
      if (mat.fileUrl) {
        targetUrl = resolveMediaUrl(mat.fileUrl);
        if (!targetUrl.includes('?sig=') && token) {
          targetUrl += `${targetUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        }
      } else if (mat.id) {
        targetUrl = `${API_BASE_URL}/api/exam/materials/${mat.id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      }
    }
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Controls */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials by title, profession, syllabus..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2.5">
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-emerald-500 transition-all"
            >
              <option value="all">All Material Types</option>
              <option value="Study Material">Study Material</option>
              <option value="Mock Test">Mock Test</option>
              <option value="Question Bank">Question Bank</option>
              <option value="Video Lecture">Video Lecture</option>
              <option value="Clinical Notes">Clinical Notes</option>
            </select>

            <button
              type="button"
              onClick={onOpenUpload}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 shrink-0"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Material</span>
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white bg-[#202c33]/40'
            }`}
          >
            All Categories ({materials.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.code)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter.toUpperCase() === cat.code.toUpperCase()
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white bg-[#202c33]/40'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Materials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.length > 0 ? (
          filteredMaterials.map((mat) => {
            const format = getFormatBadge(mat.fileType, mat.fileName);
            return (
              <div
                key={mat.id}
                className="bg-[#111b21] hover:bg-[#15232b] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all group"
              >
                <div>
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#202c33] text-cyan-400 border border-cyan-500/20">
                      {mat.categoryName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${format.bg}`}>
                        {format.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {mat.fileSizeFormatted || '10 MB'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h4 className="text-sm font-bold text-white mb-1.5 group-hover:text-emerald-300 transition-colors line-clamp-2">
                    {mat.title}
                  </h4>
                  {mat.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                      {mat.description}
                    </p>
                  )}

                  {/* Profession Tag */}
                  {mat.targetProfession && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mb-4 bg-[#202c33]/40 px-2.5 py-1 rounded-lg border border-slate-800/80 w-fit">
                      <Briefcase className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{mat.targetProfession}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Downloads & Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    <strong className="text-slate-200">{mat.downloadCount || 0}</strong> downloads
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownload(mat)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-500/30"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Access</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMaterial(mat.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center bg-[#111b21] border border-slate-800 rounded-2xl">
            <HardDrive className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No exam materials found</p>
            <p className="text-xs text-slate-500 mt-1">Upload study files, question banks, or adjust filters</p>
          </div>
        )}
      </div>
    </div>
  );
};
