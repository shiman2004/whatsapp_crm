import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Stethoscope, PlusCircle, Activity, ClipboardCheck, ShieldAlert, Globe, GraduationCap } from 'lucide-react';
import { ExamCategory, examService } from '../../services/examService';

interface ExamCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExamCategory[];
  onRefresh: () => void;
}

export const ExamCategoriesModal: React.FC<ExamCategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  onRefresh,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#06b6d4');
  const [icon, setIcon] = useState('GraduationCap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Name and code are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await examService.createCategory({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        color,
        icon,
        isActive: true,
      });

      setName('');
      setCode('');
      setDescription('');
      setIsAdding(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete category "${name}"?`)) {
      try {
        setLoading(true);
        await examService.deleteCategory(id);
        onRefresh();
      } catch (err: any) {
        alert(err.message || 'Failed to delete category');
      } finally {
        setLoading(false);
      }
    }
  };

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Stethoscope': return <Stethoscope className="w-4 h-4" />;
      case 'PlusCircle':
      case 'Cross': return <PlusCircle className="w-4 h-4" />;
      case 'Activity': return <Activity className="w-4 h-4" />;
      case 'ClipboardCheck': return <ClipboardCheck className="w-4 h-4" />;
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4" />;
      case 'Globe': return <Globe className="w-4 h-4" />;
      default: return <GraduationCap className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111b21]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Manage Exam Categories</h2>
              <p className="text-xs text-slate-400">Configure health professional exam boards</p>
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Add Category Trigger / Form */}
          {isAdding ? (
            <form onSubmit={handleCreate} className="bg-[#202c33]/50 border border-slate-700/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Create New Exam Board</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DHA"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#111b21] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Code / Abbr</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DHA"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#111b21] border border-slate-700 text-white text-xs uppercase focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Dubai Health Authority licensing exams"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#111b21] border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Save Category
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Category
            </button>
          )}

          {/* List of Categories */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#202c33]/40 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color || '#06b6d4'}20`, color: cat.color || '#06b6d4' }}
                  >
                    {renderIcon(cat.icon)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{cat.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                        {cat.code}
                      </span>
                    </div>
                    {cat.description && (
                      <p className="text-[11px] text-slate-400 truncate max-w-sm">{cat.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {cat.materialCount || 0} Materials
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#202c33]/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
