import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Eye,
  Plus,
  Search,
  Filter,
  Trash2,
  FileSpreadsheet,
  Video,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import {
  examService,
  ExamStudyMaterialPlatform,
  ExamCourse
} from '../../services/examService';

interface StudyMaterialsViewProps {
  initialCourseId?: string;
}

export const StudyMaterialsView: React.FC<StudyMaterialsViewProps> = ({ initialCourseId }) => {
  const [materials, setMaterials] = useState<ExamStudyMaterialPlatform[]>([]);
  const [courses, setCourses] = useState<ExamCourse[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId || 'all');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  // Document Viewer Modal State (Spec 32)
  const [viewingMaterial, setViewingMaterial] = useState<ExamStudyMaterialPlatform | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 12; // Standard study guide page count

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newCourseId, setNewCourseId] = useState('course-dha-rn');
  const [newMaterialType, setNewMaterialType] = useState<'PDF' | 'DOC' | 'PPT' | 'Video' | 'Notes' | 'Web Link'>('PDF');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mats, cs] = await Promise.all([
        examService.getPlatformStudyMaterials({ courseId: selectedCourse }),
        examService.getCourses().catch(() => [])
      ]);
      setMaterials(mats);
      setCourses(cs);
    } catch (err) {
      console.error('Failed to load study materials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourse]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Please enter title');
      return;
    }

    try {
      setUploading(true);
      await examService.createPlatformStudyMaterial({
        title: newTitle.trim(),
        topic: newTopic.trim() || 'Clinical Review',
        courseId: newCourseId,
        materialType: newMaterialType,
        fileUrl: newFileUrl.trim(),
        description: newDescription.trim(),
        allowDownload: true,
      });

      setIsUploadOpen(false);
      setNewTitle('');
      setNewTopic('');
      setNewDescription('');
      setNewFileUrl('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to upload material');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this study material?')) {
      try {
        await examService.deletePlatformStudyMaterial(id);
        await loadData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete material');
      }
    }
  };

  const filteredMaterials = materials.filter((m) => {
    const matchSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.topic && m.topic.toLowerCase().includes(search.toLowerCase())) ||
      (m.description && m.description.toLowerCase().includes(search.toLowerCase()));
    const matchType = selectedType === 'all' || m.materialType === selectedType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            <span>Healthcare Licensing Study Materials</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Clinical PDFs, pharmacology drug charts, formulas, guidelines, and high-yield study notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Upload Study Material</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111b21] p-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search study guides, clinical calculations, or topics..."
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Course:</span>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white focus:outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} - {c.profession}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Format:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white focus:outline-none"
            >
              <option value="all">All Formats</option>
              <option value="PDF">PDF Documents</option>
              <option value="DOC">Word Docs</option>
              <option value="PPT">Presentations</option>
              <option value="Video">Video Lectures</option>
            </select>
          </div>
        </div>
      </div>

      {/* Materials Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading study materials...</div>
      ) : filteredMaterials.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-[#111b21] p-8">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Study Materials Found</h3>
          <p className="text-xs text-slate-400 mt-1">Click above to upload study materials for this course.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              className="rounded-2xl border border-slate-800 bg-[#111b21] p-5 shadow-xl flex flex-col justify-between hover:border-teal-500/50 transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    {mat.materialType === 'PDF' ? (
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                    ) : mat.materialType === 'Video' ? (
                      <Video className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{mat.materialType} • 12 Pages</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDelete(mat.id)}
                    title="Delete Material"
                    className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-[11px] font-semibold text-slate-400 block">{mat.topic}</span>
                <h3 className="text-base font-black text-white group-hover:text-teal-400 transition-colors">
                  {mat.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {mat.description || 'Clinical licensing examination study material.'}
                </p>
              </div>

              {/* View & Download Buttons (Spec 31) */}
              <div className="flex items-center gap-2 pt-5 border-t border-slate-800/80 mt-4">
                <button
                  type="button"
                  onClick={() => setViewingMaterial(mat)}
                  className="flex-1 py-2 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Material</span>
                </button>

                {mat.allowDownload && (
                  <button
                    type="button"
                    onClick={() => {
                      alert(`Downloading ${mat.title}...`);
                    }}
                    className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* IN-APP DOCUMENT / PDF VIEWER MODAL (Spec 32)                       */}
      {/* ----------------------------------------------------------------- */}
      {viewingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#0e171e] w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Viewer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#111b21] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white leading-tight">{viewingMaterial.title}</h3>
                  <span className="text-[11px] text-slate-400">{viewingMaterial.topic} • Document Reader</span>
                </div>
              </div>

              {/* Viewer Controls: Zoom, Page, Close */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-slate-300">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                    className="p-1 hover:text-white"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[11px] font-bold w-12 text-center">{zoomLevel}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                    className="p-1 hover:text-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300 font-mono text-[11px]">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="disabled:opacity-30 p-0.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="disabled:opacity-30 p-0.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingMaterial(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Viewer Document Canvas Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex items-center justify-center bg-slate-950">
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                className="w-full max-w-2xl bg-white text-slate-900 rounded-xl shadow-2xl p-8 sm:p-12 space-y-6 transition-transform duration-200 min-h-[600px]"
              >
                <div className="border-b border-slate-200 pb-4">
                  <span className="text-[10px] uppercase font-bold text-teal-700 tracking-wider">
                    Official Healthcare Preparation Guide
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    {viewingMaterial.title}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1">{viewingMaterial.description}</p>
                </div>

                <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wide text-xs">
                    Chapter {currentPage}: High-Yield Clinical Protocols & Rationale
                  </h4>
                  <p>
                    Healthcare professionals preparing for licensing examinations must maintain acute vigilance regarding patient safety standards, sterile barrier techniques, and medication safety thresholds.
                  </p>
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-950 text-xs space-y-1.5 font-medium">
                    <p className="font-bold text-teal-900">Key Clinical Takeaways for Examination:</p>
                    <p>• Immediate cessation of blood infusions upon the first onset of systemic reaction.</p>
                    <p>• Calculation verification for high-alert pediatric infusions and inotropes.</p>
                    <p>• Priority assessment protocol: Airway, Breathing, Circulation, Neurological disability.</p>
                  </div>
                  <p>
                    Ensure thorough familiarity with official licensing competencies for your selected exam authority. Document every step according to institutional policy.
                  </p>
                </div>

                <div className="pt-8 border-t border-slate-200 text-center text-[10px] text-slate-500 font-mono">
                  Page {currentPage} of {totalPages} • Alpha Health Group Licensing Preparation
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL: UPLOAD STUDY MATERIAL                                      */}
      {/* ----------------------------------------------------------------- */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Upload New Study Material</h3>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Course *</label>
                <select
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode} - {c.courseName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Material Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Pharmacology – Important Drug Calculations"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Topic / Subject</label>
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="e.g. Drug Calculations"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Material Type</label>
                  <select
                    value={newMaterialType}
                    onChange={(e) => setNewMaterialType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="DOC">Word Document (DOCX)</option>
                    <option value="PPT">PowerPoint (PPTX)</option>
                    <option value="Video">Video Link</option>
                    <option value="Notes">Study Notes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief overview of learning points inside this document..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-md cursor-pointer"
                >
                  {uploading ? 'Uploading...' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
