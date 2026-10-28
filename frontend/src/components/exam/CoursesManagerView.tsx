import { CourseServices } from './CourseServices';
import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  BookOpen,
  ArrowRight,
  Layers,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { examService, ExamCourse, ExamCategory } from '../../services/examService';
import { displayCourseName } from './courseDisplayName';

export const HEALTHCARE_PROFESSION_MASTER_LIST = [
  'General Practitioner', 'Family Physician', 'Internal Medicine Physician', 'Pediatrician', 'Geriatrician', 'Cardiologist', 'Neurologist', 'Dermatologist', 'Psychiatrist', 'Oncologist', 'Endocrinologist', 'Gastroenterologist', 'Nephrologist', 'Pulmonologist', 'Rheumatologist', 'Infectious Disease Specialist', 'Emergency Medicine Physician', 'Anesthesiologist', 'Radiologist', 'Pathologist', 'General Surgeon', 'Orthopedic Surgeon', 'Neurosurgeon', 'Cardiothoracic Surgeon', 'Plastic Surgeon', 'Urologist', 'Obstetrician and Gynecologist', 'Ophthalmologist', 'Otolaryngologist', 'Rehabilitation Physician', 'Palliative Care Physician', 'Occupational Medicine Physician', 'Public Health Physician', 'Dentist', 'Orthodontist', 'Periodontist', 'Endodontist', 'Prosthodontist', 'Pediatric Dentist', 'Oral and Maxillofacial Surgeon', 'Dental Hygienist', 'Dental Therapist', 'Dental Technician', 'Registered Nurse', 'Nurse Practitioner', 'Clinical Nurse Specialist', 'Community Health Nurse', 'Mental Health Nurse', 'Pediatric Nurse', 'Emergency Nurse', 'Critical Care Nurse', 'Oncology Nurse', 'Midwife', 'Pharmacist', 'Clinical Pharmacist', 'Pharmacy Technician', 'Physiotherapist', 'Occupational Therapist', 'Speech and Language Therapist', 'Audiologist', 'Optometrist', 'Optician', 'Orthoptist', 'Dietitian', 'Nutritionist', 'Clinical Psychologist', 'Counseling Psychologist', 'Medical Social Worker', 'Respiratory Therapist', 'Podiatrist', 'Prosthetist', 'Orthotist', 'Medical Laboratory Scientist', 'Medical Laboratory Technologist', 'Medical Laboratory Technician', 'Diagnostic Radiographer', 'Radiation Therapist', 'Sonographer', 'Nuclear Medicine Technologist', 'Cardiac Physiologist', 'Neurophysiology Technologist', 'Perfusionist', 'Anesthesia Technologist', 'Surgical Technologist', 'Paramedic', 'Emergency Medical Technician', 'Public Health Inspector', 'Environmental Health Officer', 'Health Educator', 'Community Health Worker'
] as const;

function courseArtwork(profession: string) {
  const text = profession.toLowerCase();
  if (/general practitioner/.test(text)) return '/course-images/general-practitioner-background-v1.png';
  const name = /occupational/.test(text) ? 'occupational-therapy' : /nurs|midwi/.test(text) ? 'nursing' : /dent|orthodont/.test(text) ? 'dental' : /pharma/.test(text) ? 'pharmacy' : /laborator|technolog|phlebo/.test(text) ? 'laboratory' : /therap|rehab|physio|audio|prosthet/.test(text) ? 'rehabilitation' : 'medical';
  return '/course-images/' + name + '-v1.png';
}

function courseThumbnail(course: Pick<ExamCourse, 'courseCode' | 'courseName' | 'profession' | 'thumbnail'>) {
  if (course.courseCode === 'MOH-GP' || course.profession === 'General Practitioner') {
    return '/course-images/general-practitioner-background-v1.png';
  }
  return course.thumbnail && !course.thumbnail.includes('unsplash.com') ? course.thumbnail : courseArtwork(course.profession);
}

function CourseCover({ course, compact = false }: { course: ExamCourse; compact?: boolean }) {
  return (
    <div className={'relative h-full w-full overflow-hidden bg-slate-900 ' + (compact ? 'min-h-[10rem]' : '')}>
      <img src={courseThumbnail(course)} loading={compact ? 'lazy' : undefined} alt={displayCourseName(course) + ' course cover'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/25 to-transparent" />
      <div className={'absolute left-3 top-3 flex items-center gap-2 ' + (compact ? '' : 'sm:left-6 sm:top-6')}>
        <div className={'shrink-0 overflow-hidden rounded-lg bg-white p-1 shadow-lg ' + (compact ? 'h-9 w-9' : 'h-12 w-12 sm:h-16 sm:w-16')}>
          <img src="/logo.png" alt="Alpha Health Group logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className={'font-bold uppercase tracking-[0.14em] text-teal-200 ' + (compact ? 'text-[8px]' : 'text-[10px] sm:text-xs')}>Alpha Health Group</p>
          {!compact && <p className="mt-1 text-[10px] font-medium text-white/80 sm:text-xs">Healthcare Licensing Exam Academy</p>}
        </div>
      </div>
      <div className={'absolute bottom-3 left-4 right-3 ' + (compact ? '' : 'bottom-5 left-7')}>
        <p className={'font-semibold uppercase tracking-wider text-teal-200 ' + (compact ? 'text-[9px]' : 'text-[10px] sm:text-xs')}>{course.profession}</p>
        <p className={'mt-0.5 font-black uppercase tracking-tight text-white drop-shadow ' + (compact ? 'line-clamp-2 text-sm' : 'text-2xl sm:text-4xl')}>{displayCourseName(course)}</p>
        {!compact && <p className="mt-1 text-xs font-medium text-white/90 sm:text-sm">Licensing Exam Preparation</p>}
      </div>
    </div>
  );
}

interface CoursesManagerViewProps {
  categories?: ExamCategory[];
  onNavigateToSection?: (section: string, courseId?: string) => void;
}

export const CoursesManagerView: React.FC<CoursesManagerViewProps> = ({
  onNavigateToSection,
}) => {
  const [courses, setCourses] = useState<ExamCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  const [newAccessType, setNewAccessType] = useState<'Free' | 'Paid' | 'Assigned Students Only'>('Assigned Students Only');
  const [newStatus, setNewStatus] = useState<'Active' | 'Inactive' | 'Draft'>('Draft');
  const [submitting, setSubmitting] = useState(false);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await examService.getCourses();
      setCourses(data);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load courses.');
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
        thumbnail: newThumbnail.trim() || courseArtwork(newProfession),
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
    setNewAccessType('Assigned Students Only');
    setNewStatus('Draft');
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
      {loadError && <div role="alert" className="rounded-xl border border-amber-600 p-4 text-amber-100">{loadError}<button type="button" className="ml-3 underline" onClick={() => void loadCourses()}>Retry</button></div>}
      {/* ----------------------------------------------------------------- */}
      {/* VIEW A: COURSE DETAIL HUB (when course is selected)                */}
      {/* Shows the 4 Core Cards per Course Specification                  */}
      {/* ----------------------------------------------------------------- */}
      {selectedCourse ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="relative h-44 sm:h-60 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
            <CourseCover course={selectedCourse} />
          </div>
          {/* Back button & Course Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#111b21] p-5 sm:p-6 shadow-xl">
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
                {displayCourseName(selectedCourse)}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                {selectedCourse.description ||
                  'Complete clinical preparation package including high-yield MCQ practice, full-length timed mock tests, reviewed study guides, and examination licensing requirements.'}
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

          {selectedCourse.courseCode === 'MOH-GP' && <section className="rounded-2xl border border-slate-800 bg-[#111b21] p-5 sm:p-6 shadow-xl"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Course master data</p><h2 className="mt-1 text-lg font-bold text-white">Healthcare profession master list</h2><p className="mt-1 text-xs text-slate-400">Use these 90 profession titles when creating course content, materials, and question-bank assignments.</p></div><span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300">{HEALTHCARE_PROFESSION_MASTER_LIST.length} professions</span></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{HEALTHCARE_PROFESSION_MASTER_LIST.map((profession, index) => <div key={profession} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"><span className="mr-2 text-teal-400">{index + 1}.</span>{profession}</div>)}</div></section>}
          <CourseServices courseId={selectedCourse.id} onNavigate={(section, courseId) => onNavigateToSection?.(section, courseId)} />
        </div>
      ) : (
        /* ----------------------------------------------------------------- */
        /* VIEW B: COURSES DIRECTORY LIST                                    */
        /* ----------------------------------------------------------------- */
        <div className="space-y-6">
          {/* Top Controls Bar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-teal-400" />
                <span>Professional Healthcare Exam Courses</span>
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Preparation by profession, licensing authority and examination pathway.
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
                  role="button"
                  tabIndex={0}
                  aria-label={'Open ' + course.courseName}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedCourse(course); } }}
                  onClick={() => setSelectedCourse(course)}
                  className="rounded-2xl border border-slate-800/80 bg-[#111b21] hover:border-teal-500/50 hover:bg-[#13222a] transition-all duration-200 overflow-hidden shadow-lg group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Course Thumbnail */}
                    <div className="h-40 w-full relative overflow-hidden bg-slate-900">
                      <CourseCover course={course} compact />
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <span className="rounded-md bg-black/60 backdrop-blur-xs text-white border border-white/10 px-2 py-0.5 text-[11px] font-mono font-bold">
                          {course.courseCode}
                        </span>
                        <span className="rounded-md bg-teal-500/80 text-slate-950 px-2 py-0.5 text-[11px] font-bold">
                          {course.examAuthority === 'Prometric' ? 'Provider: Prometric' : course.examAuthority}
                        </span>
                      </div>
                    </div>

                    {/* Course Content */}
                    <div className="p-5 space-y-2">
                      <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                        {course.profession} • {course.country}
                      </span>
                      <h3 className="text-base font-black text-white group-hover:text-teal-400 transition-colors line-clamp-2 min-h-[2.5rem]">
                        {displayCourseName(course)}
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
                      <span>16 Service Categories</span>
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
                    <option value="SCFHS">SCFHS (Saudi Arabia)</option>
                    <option value="Other">Other regulator — specify in description</option>
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
                    list="healthcare-profession-options"
                    value={newProfession}
                    onChange={(e) => setNewProfession(e.target.value)}
                    placeholder="e.g. Registered Nurse"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  />
                  <datalist id="healthcare-profession-options">
                    {HEALTHCARE_PROFESSION_MASTER_LIST.map((profession) => <option key={profession} value={profession} />)}
                  </datalist>
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
