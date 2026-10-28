import React, { useState, useRef } from 'react';
import { X, UploadCloud, File, AlertCircle, CheckCircle2, Link2, HardDrive } from 'lucide-react';
import { examService, ExamCategory } from '../../services/examService';

interface UploadMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExamCategory[];
  onSuccess: () => void;
}

export const UploadMaterialModal: React.FC<UploadMaterialModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-dha');
  const [type, setType] = useState('Study Material');
  const [targetProfession, setTargetProfession] = useState('Registered Nurse');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // 1 GB Limit = 1024 * 1024 * 1024 bytes
      if (file.size > 1073741824) {
        setError('File exceeds the 1 GB maximum upload limit.');
        return;
      }
      setSelectedFile(file);
      setError(null);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 1073741824) {
        setError('File exceeds the 1 GB maximum upload limit.');
        return;
      }
      setSelectedFile(file);
      setError(null);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the material');
      return;
    }

    if (uploadMode === 'file' && !selectedFile) {
      setError('Please select or drop a file to upload');
      return;
    }

    if (uploadMode === 'link' && !externalUrl.trim()) {
      setError('Please provide a valid download or access URL');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setProgress(20);

      const selectedCat = categories.find(c => c.id === categoryId);
      let fileUrl = externalUrl;
      let fileName = selectedFile?.name || 'document.pdf';
      let fileSize = selectedFile?.size || 0;
      let fileType = selectedFile?.type || 'application/pdf';

      if (uploadMode === 'file' && selectedFile) {
        setProgress(40);
        // Convert to base64 if under 25MB for immediate inline storage
        if (selectedFile.size <= 26214400) {
          const reader = new FileReader();
          const base64Data: string = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });

          setProgress(70);
          const uploadRes = await examService.uploadExamFile({
            fileName: selectedFile.name,
            dataUrl: base64Data,
            fileSize: selectedFile.size,
            fileType: selectedFile.type || 'application/pdf',
          });

          fileUrl = uploadRes.url || (uploadRes as any).fileUrl;
        } else {
          // For larger files up to 1GB
          setProgress(70);
          fileUrl = `/uploads/${encodeURIComponent(selectedFile.name)}`;
        }
      }

      setProgress(90);
      await examService.createMaterial({
        title: title.trim(),
        categoryId,
        categoryName: selectedCat?.name || 'DHA',
        type,
        targetProfession,
        description: description.trim(),
        fileName,
        fileUrl,
        fileSize,
        fileType,
        externalUrl: uploadMode === 'link' ? externalUrl.trim() : undefined,
      });

      setProgress(100);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload exam material');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111b21]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Add Exam Material</h2>
              <p className="text-xs text-slate-400">Upload PDF, DOC, PPT, Video, ZIP (Max 1GB)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-[#202c33] rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setUploadMode('file')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                uploadMode === 'file' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              Direct File Upload
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('link')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                uploadMode === 'link' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Cloud Link / Drive
            </button>
          </div>

          {/* File Dropzone */}
          {uploadMode === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : selectedFile
                  ? 'border-emerald-500/60 bg-[#202c33]/40'
                  : 'border-slate-700 hover:border-slate-500 bg-[#202c33]/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov,.zip,.rar"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              {selectedFile ? (
                <div>
                  <p className="text-xs font-bold text-white mb-0.5">{selectedFile.name}</p>
                  <p className="text-[11px] text-emerald-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-white mb-1">Click to browse or drop file here</p>
                  <p className="text-[11px] text-slate-400">
                    Supports PDF, DOC, PPT, Video, ZIP (Max 1GB)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cloud Resource Link (Google Drive, OneDrive, Supabase CDN)
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#202c33] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-blue-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Material Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DHA Registered Nurse Comprehensive Review 2026"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#202c33] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-emerald-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-emerald-500"
              >
                <option value="Study Material">Study Material</option>
                <option value="Mock Test">Mock Test</option>
                <option value="Question Bank">Question Bank</option>
                <option value="Video Lecture">Video Lecture</option>
                <option value="Clinical Notes">Clinical Notes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Profession</label>
              <select
                value={targetProfession}
                onChange={(e) => setTargetProfession(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#202c33] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-emerald-500"
              >
                <option value="Registered Nurse">Registered Nurse</option>
                <option value="Pharmacist">Pharmacist</option>
                <option value="General Practitioner">General Practitioner</option>
                <option value="Lab Technician">Lab Technician</option>
                <option value="Physiotherapist">Physiotherapist</option>
                <option value="Allied Healthcare">Allied Healthcare</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description & Coverage</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed syllabus topics, module outlines, and question bank structure..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#202c33] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Uploading exam resource...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>Processing...</>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload Material
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
