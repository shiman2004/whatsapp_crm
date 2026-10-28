import React, { useState, useEffect } from 'react';
import { displayCourseName } from './courseDisplayName';
import {
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Plus,
  BookOpen,
  Calendar,
  FileCheck2,
  HelpCircle,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import {
  examService,
  ExamGuidelinePlatform,
  ExamCourse
} from '../../services/examService';

interface ExamGuidelinesViewProps {
  initialCourseId?: string;
}

export const ExamGuidelinesView: React.FC<ExamGuidelinesViewProps> = ({ initialCourseId }) => {
  const [guidelines, setGuidelines] = useState<ExamGuidelinePlatform[]>([]);
  const [courses, setCourses] = useState<ExamCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(initialCourseId || 'all');
  const [activeSection, setActiveSection] = useState<string>('all');

  // Add Guideline Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState('Eligibility');
  const [newCourseId, setNewCourseId] = useState('course-dha-rn');
  const [newContent, setNewContent] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [guides, cs] = await Promise.all([
        examService.getExamGuidelines(selectedCourse),
        examService.getCourses().catch(() => [])
      ]);
      setGuidelines(guides);
      setCourses(cs);
    } catch (err) {
      console.error('Failed to load guidelines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourse]);

  const handleAddGuideline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert('Please fill guideline title and content');
      return;
    }

    try {
      setSubmitting(true);
      await examService.createExamGuideline({
        guidelineTitle: newTitle.trim(),
        section: newSection,
        courseId: newCourseId,
        content: newContent.trim(),
        officialReferenceUrl: newUrl.trim(),
      });

      setIsAddOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewUrl('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add guideline');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this guideline item?')) {
      try {
        await examService.deleteExamGuideline(id);
        await loadData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete guideline');
      }
    }
  };

  const sectionsList = [
    'all',
    'Overview',
    'Eligibility',
    'Required Documents',
    'Application Procedure',
    'Exam Format & Scoring',
    'Pass Criteria',
    'Exam Day Instructions',
    'Official References',
    'FAQs'
  ];

  const filteredGuidelines = guidelines.filter((g) => {
    if (activeSection !== 'all' && g.section !== activeSection) return false;
    return true;
  });

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <span>Licensing Examination Guidelines & Requirements</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Official regulations, credentialing procedures, exam blueprints, and test day requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Guideline Section</span>
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MANDATORY WARNING & DISCLAIMER BANNER (Spec 34)                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 p-4 sm:p-5 text-amber-200 text-xs shadow-lg space-y-1.5">
        <div className="flex items-center gap-2 font-black text-amber-300 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>Information Updated On: {currentDateFormatted}</span>
        </div>
        <p className="text-xs leading-relaxed text-amber-200/90 pl-7 font-medium">
          ⚠️ <span className="font-bold">Important Notice:</span> Please verify current requirements with the official licensing authority (DHA / DOH / MOH / Prometric / SCFHS) because examination policies, required verification documentation, and pass marks may change without prior notice.
        </p>
      </div>

      {/* Section Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {sectionsList.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => setActiveSection(sec)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeSection === sec
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {sec === 'all' ? 'All Sections' : sec}
          </button>
        ))}
      </div>

      {/* Guidelines Content Accordion / Cards */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading exam guidelines...</div>
      ) : filteredGuidelines.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-[#111b21] p-8">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Guidelines Found</h3>
          <p className="text-xs text-slate-400 mt-1">Select all sections or click above to add guidance.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGuidelines.map((guide) => (
            <div
              key={guide.id}
              className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 shadow-xl space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-0.5 font-bold uppercase tracking-wider text-[10px]">
                  {guide.section}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">
                    Updated: {new Date(guide.updatedDate || Date.now()).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(guide.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete Guideline"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-base font-black text-white">{guide.guidelineTitle}</h3>

              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                {guide.content}
              </div>

              {guide.officialReferenceUrl && (
                <div className="pt-3 border-t border-slate-800/80">
                  <a
                    href={guide.officialReferenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <span>Visit Official Authority Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL: ADD GUIDELINE                                              */}
      {/* ----------------------------------------------------------------- */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Add Exam Guideline Section</h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddGuideline} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Course *</label>
                <select
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseCode} - {displayCourseName(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Section</label>
                  <select
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Overview">Overview</option>
                    <option value="Eligibility">Eligibility</option>
                    <option value="Required Documents">Required Documents</option>
                    <option value="Application Procedure">Application Procedure</option>
                    <option value="Exam Format & Scoring">Exam Format & Scoring</option>
                    <option value="Pass Criteria">Pass Criteria</option>
                    <option value="Exam Day Instructions">Exam Day Instructions</option>
                    <option value="FAQs">Frequently Asked Questions (FAQs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Primary Source Verification"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Guideline Details & Bullet Points *</label>
                <textarea
                  rows={5}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter detailed eligibility criteria, required documents, or exam instructions..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white leading-relaxed focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Official Reference URL (Optional)</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.dha.gov.ae/..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-md cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Add Guideline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
