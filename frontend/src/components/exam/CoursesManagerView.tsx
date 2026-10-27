import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  BookOpen,
  FileCheck2,
  FileText,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { examService, ExamCourse, ExamCategory } from '../../services/examService';

interface CoursesManagerViewProps {
  categories?: ExamCategory[];
  onNavigateToSection?: (section: string, courseId?: string) => void;
}

export const CoursesManagerView: React.FC<CoursesManagerViewProps> = ({
  onNavigateToSection,
}) => {
  const [courses, setCourses] = useState<ExamCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [authorityFilter, setAuthorityFilter] = useState('all');

  // Selected course for Course Detail Hub (Spec 3 & Spec 95)
  const [selectedCourse, setSelectedCourse] = useState<ExamCourse | null>(null);

  // Add Course Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newAuthority, setNewAuthority] = useState('DHA');
  const [newProfession, setNewProfession] = useState('Registered Nurse');
  const [newCountry, setNewCountry] = useState('UAE');
  const [newCourseCode, setNewCourseCode] = useState('DHA-RN');
  const [newDescription, setNewDescription] = useState('');
  const [newThumbnail, setNewThumbnail] = useState('');
  const [newAccessType, setNewAccessType] = useState<'Free' | 'Paid' | 'Assigned Students Only'>('Free');
  const [newStatus, setNewStatus] = useState<'Active' | 'Inactive' | 'Draft'>('Active');
  const [submitting, setSubmitting] = useState(false);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await examService.getCourses();
      setCourses(data);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !newCourseCode.trim()) {
      alert('Please enter course name and course code');
      return;
    }

    try {
      setSubmitting(true);
      await examService.createCourse({
        courseName: newCourseName.trim(),
        examAuthority: newAuthority,
        profession: newProfession.trim(),
        country: newCountry.trim(),
        courseCode: newCourseCode.trim().toUpperCase(),
        description: newDescription.trim(),
        thumbnail: newThumbnail.trim() || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
        accessType: newAccessType,
        status: newStatus,
      });

      setIsAddModalOpen(false);
      resetForm();
      await loadCourses();
    } catch (err: any) {
      alert(err.message || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewCourseName('');
    setNewAuthority('DHA');
    setNewProfession('Registered Nurse');
    setNewCountry('UAE');
    setNewCourseCode('DHA-RN');
    setNewDescription('');
    setNewThumbnail('');
    setNewAccessType('Free');
    setNewStatus('Active');
  };

  const filteredCourses = courses.filter((c) => {
    const matchSearch =
      c.courseName.toLowerCase().includes(search.toLowerCase()) ||
      c.courseCode.toLowerCase().includes(search.toLowerCase()) ||
      c.profession.toLowerCase().includes(search.toLowerCase());
    const matchAuth = authorityFilter === 'all' || c.examAuthority === authorityFilter;
    return matchSearch && matchAuth;
  });

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* VIEW A: COURSE DETAIL HUB (when course is selected)                */}
      {/* Shows the 4 Core Cards per Course Specification                  */}
      {/* ----------------------------------------------------------------- */}
      {selectedCourse ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Back button & Course Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#111b21] p-5 sm:p-6 shadow-xl">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="inline-flex items-center gap-2 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Courses</span>
              </button>
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-1 text-xs font-mono font-bold">
                  {selectedCourse.courseCode}
                </span>
                <span className="rounded-lg bg-slate-800 text-slate-300 px-2.5 py-1 text-xs font-semibold">
                  {selectedCourse.examAuthority} • {selectedCourse.country}
                </span>
                <span className="rounded-lg bg-emerald-500/20 text-emerald-400 px-2.5 py-1 text-xs font-semibold">
                  {selectedCourse.profession}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {selectedCourse.courseName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                {selectedCourse.description ||
                  'Complete clinical preparation package including high-yield MCQ practice, full-length timed mock tests, official study guides, and examination licensing requirements.'}
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Updated: {new Date(selectedCourse.createdAt || Date.now()).toLocaleDateString()}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {selectedCourse.status}
              </span>
            </div>
          </div>

          {/* 4 CORE CARDS SPECIFICATION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* CARD 1: MCQ PRACTICE QUESTIONS */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-[#111b21] p-6 shadow-lg hover:border-teal-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shadow-inner">
                    <BookOpen className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-md">
                    Interactive Learning
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white group-hover:text-teal-400 transition-colors">
                    MCQ Practice Questions
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Practice mode with immediate feedback. If wrong, keep retrying until correct! Upon correct answer, unlock 3 high-yield Remember Notes.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300 font-semibold pt-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Unlimited Attempts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Remember Notes</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToSection?.('mcq-practice', selectedCourse.id)}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
              >
                <span>Launch MCQ Practice Mode</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* CARD 2: MOCK TESTS */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-[#111b21] p-6 shadow-lg hover:border-blue-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shadow-inner">
                    <FileCheck2 className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md">
                    Exam Simulation
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors">
                    Mock Tests
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Real examination simulation with countdown timer, single answer attempt, review flagging, passing grade calculations, and detailed post-exam review.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300 font-semibold pt-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>Timed Countdown</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Pass / Fail Grading</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToSection?.('mock-tests', selectedCourse.id)}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <span>Take Simulation Mock Test</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* CARD 3: STUDY MATERIALS */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-[#111b21] p-6 shadow-lg hover:border-purple-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shadow-inner">
                    <FileText className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-md">
                    Documents & Media
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white group-hover:text-purple-400 transition-colors">
                    Study Materials
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Access high-yield clinical revision PDFs, pharmacology charts, calculation workbooks, and topic notes with our built-in reader and download options.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300 font-semibold pt-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>PDF / DOC / PPT Reader</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Offline Downloads</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToSection?.('study-materials', selectedCourse.id)}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-black text-xs transition-all shadow-lg shadow-purple-600/20 cursor-pointer"
              >
                <span>View Study Materials</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* CARD 4: EXAM GUIDELINES */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-[#111b21] p-6 shadow-lg hover:border-amber-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-inner">
                    <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md">
                    Licensing Authority
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                    Exam Guidelines
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Official examination pattern, candidate eligibility criteria, primary source verification documents, scheduling rules, and exam day requirements.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300 font-semibold pt-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Official Syllabus</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Updated Requirements</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToSection?.('guidelines', selectedCourse.id)}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>Read Official Guidelines</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ----------------------------------------------------------------- */
        /* VIEW B: COURSES DIRECTORY LIST                                    */
        /* ----------------------------------------------------------------- */
        <div className="space-y-6">
          {/* Top Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-teal-400" />
                <span>Professional Healthcare Exam Courses</span>
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Centralized preparation programs for DHA, DOH, MOH, Prometric & International Licensure.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 font-black text-xs transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create New Course</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111b21] p-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by course name, profession, or code..."
                className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 font-semibold">Authority:</span>
              <select
                value={authorityFilter}
                onChange={(e) => setAuthorityFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white focus:border-teal-500 focus:outline-none"
              >
                <option value="all">All Authorities</option>
                <option value="DHA">DHA (Dubai)</option>
                <option value="DOH">DOH / HAAD (Abu Dhabi)</option>
                <option value="MOH">MOH (UAE)</option>
                <option value="Prometric">Prometric (Gulf)</option>
              </select>
            </div>
          </div>

          {/* Courses Grid */}
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400 font-medium">
              Loading professional licensing courses...
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-[#111b21] p-8">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">No Courses Found</h3>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or create a new course.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className="rounded-2xl border border-slate-800/80 bg-[#111b21] hover:border-teal-500/50 hover:bg-[#13222a] transition-all duration-200 overflow-hidden shadow-lg group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Course Thumbnail */}
                    <div className="h-40 w-full relative overflow-hidden bg-slate-900">
                      <img
                        src={course.thumbnail || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80'}
                        alt={course.courseName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80 group-hover:opacity-100"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111b21] via-transparent to-black/40" />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="rounded-md bg-black/60 backdrop-blur-xs text-white border border-white/10 px-2 py-0.5 text-[11px] font-mono font-bold">
                          {course.courseCode}
                        </span>
                        <span className="rounded-md bg-teal-500/80 text-slate-950 px-2 py-0.5 text-[11px] font-bold">
                          {course.examAuthority}
                        </span>
                      </div>
                    </div>

                    {/* Course Content */}
                    <div className="p-5 space-y-2">
                      <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                        {course.profession} • {course.country}
                      </span>
                      <h3 className="text-base font-black text-white group-hover:text-teal-400 transition-colors line-clamp-1">
                        {course.courseName}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {course.description || 'Complete licensing exam course including practice questions, mock tests, and guidelines.'}
                      </p>
                    </div>
                  </div>

                  {/* Course Footer & 4 Badges */}
                  <div className="px-5 pb-5 pt-2 border-t border-slate-800/60 mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <Layers className="w-3.5 h-3.5 text-teal-400" />
                      <span>4 Core Sections</span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-bold text-teal-400 group-hover:translate-x-1 transition-transform">
                      <span>Open Course</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL: CREATE NEW COURSE                                          */}
      {/* ----------------------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-800 bg-[#111b21] p-6 w-full max-w-xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white">Create New Licensing Course</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Course Name *</label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="e.g. DHA Registered Nurse Exam Preparation"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Exam Authority *</label>
                  <select
                    value={newAuthority}
                    onChange={(e) => setNewAuthority(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="DHA">DHA (Dubai)</option>
                    <option value="DOH">DOH / HAAD (Abu Dhabi)</option>
                    <option value="MOH">MOH (UAE)</option>
                    <option value="Prometric">Prometric (Gulf/SCFHS)</option>
                    <option value="NCLEX">NCLEX (International)</option>
                    <option value="Other">Other Authority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Course Code *</label>
                  <input
                    type="text"
                    required
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    placeholder="e.g. DHA-RN"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Profession *</label>
                  <input
                    type="text"
                    required
                    value={newProfession}
                    onChange={(e) => setNewProfession(e.target.value)}
                    placeholder="e.g. Registered Nurse"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    placeholder="e.g. UAE"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Course Description</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide brief details about this healthcare exam preparation course..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Thumbnail Image URL (Optional)</label>
                <input
                  type="url"
                  value={newThumbnail}
                  onChange={(e) => setNewThumbnail(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Course Access</label>
                  <select
                    value={newAccessType}
                    onChange={(e) => setNewAccessType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="Free">Free (All Enrolled Candidates)</option>
                    <option value="Paid">Paid Package</option>
                    <option value="Assigned Students Only">Assigned Students Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-md cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
