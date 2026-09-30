import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { TreatmentCategory, Treatment } from '../../types';
import { 
  Sparkles, 
  Plus, 
  Edit, 
  Check, 
  X, 
  Globe, 
  FolderPlus, 
  Layers 
} from 'lucide-react';

export const TreatmentsManager: React.FC = () => {
  const { categories, treatments, addCategory, addTreatment } = useCrm();

  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [showNewTrtModal, setShowNewTrtModal] = useState(false);

  // New Category form
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameSi, setCatNameSi] = useState('');
  const [catNameTa, setCatNameTa] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // New Treatment form
  const [trtNameEn, setTrtNameEn] = useState('');
  const [trtNameSi, setTrtNameSi] = useState('');
  const [trtNameTa, setTrtNameTa] = useState('');
  const [trtPrice, setTrtPrice] = useState('');
  const [trtDuration, setTrtDuration] = useState('');

  const selectedCategory = categories.find(c => c.id === selectedCatId) || categories[0];
  const categoryTreatments = treatments.filter(t => t.categoryId === selectedCategory?.id);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameEn.trim()) return;

    addCategory({
      name: catNameEn.trim(),
      nameI18n: {
        en: catNameEn.trim(),
        si: catNameSi.trim() || catNameEn.trim(),
        ta: catNameTa.trim() || catNameEn.trim(),
      },
      active: true,
      iconName: 'Sparkles',
      description: catDesc.trim() || 'Royal Wellness certified clinical specialty.',
    });

    setCatNameEn('');
    setCatNameSi('');
    setCatNameTa('');
    setCatDesc('');
    setShowNewCatModal(false);
  };

  const handleCreateTreatment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trtNameEn.trim() || !selectedCategory) return;

    addTreatment({
      categoryId: selectedCategory.id,
      name: trtNameEn.trim(),
      nameI18n: {
        en: trtNameEn.trim(),
        si: trtNameSi.trim() || trtNameEn.trim(),
        ta: trtNameTa.trim() || trtNameEn.trim(),
      },
      active: true,
      priceRange: trtPrice.trim() || 'Consultation Required',
      duration: trtDuration.trim() || '45 mins',
    });

    setTrtNameEn('');
    setTrtNameSi('');
    setTrtNameTa('');
    setTrtPrice('');
    setTrtDuration('');
    setShowNewTrtModal(false);
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif">Treatments & Services Catalogue</h2>
          <p className="text-xs text-slate-400">Manage clinical categories and multilingual services displayed in WhatsApp onboarding</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewCatModal(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-teal-400" />
            <span>Add Category</span>
          </button>
          <button
            onClick={() => setShowNewTrtModal(true)}
            className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Category Selector on Left + Treatments List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Categories List */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Categories ({categories.length})</span>
          </h3>

          <div className="space-y-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory?.id === cat.id;
              const count = treatments.filter(t => t.categoryId === cat.id).length;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-950/40 border-teal-500/50 shadow-md text-teal-200'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-slate-100">{cat.name}</h4>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {count} services
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{cat.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Treatments in Selected Category */}
        <div className="lg:col-span-2 bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">{selectedCategory?.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Multilingual translations mapped directly to WhatsApp interactive list payloads
              </p>
            </div>
            <button
              onClick={() => setShowNewTrtModal(true)}
              className="px-2.5 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to {selectedCategory?.name.split(' ')[0]}</span>
            </button>
          </div>

          {/* Treatment Cards List */}
          <div className="space-y-3">
            {categoryTreatments.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                <p>No specific procedures registered under this category yet.</p>
              </div>
            ) : (
              categoryTreatments.map((trt) => (
                <div
                  key={trt.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-100">{trt.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
                          {trt.priceRange}
                        </span>
                        <span className="text-[10px] text-slate-400">⏱️ {trt.duration}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/30 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </div>

                  {/* Multilingual Labels preview */}
                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>
                      <strong className="text-amber-400">සිංහල:</strong> {trt.nameI18n.si}
                    </div>
                    <div>
                      <strong className="text-rose-400">தமிழ்:</strong> {trt.nameI18n.ta}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: New Category */}
      {showNewCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Create Treatment Category</h3>
              <button onClick={() => setShowNewCatModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Category Name (English)</label>
                <input
                  type="text"
                  required
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  placeholder="e.g. Laser Hair Reduction"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-amber-400 mb-1">Sinhala (සිංහල)</label>
                  <input
                    type="text"
                    value={catNameSi}
                    onChange={(e) => setCatNameSi(e.target.value)}
                    placeholder="සිංහල නම"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-rose-400 mb-1">Tamil (தமிழ்)</label>
                  <input
                    type="text"
                    value={catNameTa}
                    onChange={(e) => setCatNameTa(e.target.value)}
                    placeholder="தமிழ் பெயர்"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Brief description for clinical coordinators..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold shadow"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Treatment Service */}
      {showNewTrtModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">
                Add Service to {selectedCategory?.name}
              </h3>
              <button onClick={() => setShowNewTrtModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTreatment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Service / Procedure Name (English)</label>
                <input
                  type="text"
                  required
                  value={trtNameEn}
                  onChange={(e) => setTrtNameEn(e.target.value)}
                  placeholder="e.g. FUE Sapphire Hair Transplant"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-amber-400 mb-1">Sinhala (සිංහල)</label>
                  <input
                    type="text"
                    value={trtNameSi}
                    onChange={(e) => setTrtNameSi(e.target.value)}
                    placeholder="ප්‍රතිකාර නාමය"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-rose-400 mb-1">Tamil (தமிழ்)</label>
                  <input
                    type="text"
                    value={trtNameTa}
                    onChange={(e) => setTrtNameTa(e.target.value)}
                    placeholder="சிகிச்சை பெயர்"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Price Range</label>
                  <input
                    type="text"
                    value={trtPrice}
                    onChange={(e) => setTrtPrice(e.target.value)}
                    placeholder="e.g. LKR 25,000 / session"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Duration</label>
                  <input
                    type="text"
                    value={trtDuration}
                    onChange={(e) => setTrtDuration(e.target.value)}
                    placeholder="e.g. 45 mins"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTrtModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold shadow"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
