import {
  User,
  Customer,
  Lead,
  Message,
  TreatmentCategory,
  Treatment,
  WhatsAppTemplate,
  FollowupSequence,
  Followup,
  LeadNote,
  LeadStageHistory,
  AuditLog
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin-1',
    fullName: 'Super Admin',
    email: 'admin@royalwellness.lk',
    branch: 'Colombo (Head Office)',
    password: 'admin',
    pin: '1234',
    role: 'super_admin',
    active: true,
    createdAt: '2026-01-01T08:00:00Z',
    activeLeadsCount: 0,
  }
];

export const INITIAL_CATEGORIES: TreatmentCategory[] = [
  {
    id: 'cat-hair-care',
    name: 'Hair Care & Restoration',
    nameI18n: {
      en: 'Hair Care & Restoration',
      si: 'හිසකෙස් ප්‍රතිකාර සහ යථා තත්ත්වයට පත්කිරීම',
      ta: 'முடி பராமரிப்பு மற்றும் சீரமைப்பு',
    },
    active: true,
    iconName: 'Sparkles',
    description: 'Advanced PRP, GFC, and FUE hair transplant solutions by certified trichologists.',
  },
  {
    id: 'cat-skin-care',
    name: 'Aesthetic Skin Care',
    nameI18n: {
      en: 'Aesthetic Skin Care',
      si: 'සම රැකවරණ ප්‍රතිකාර',
      ta: 'தோல் பராமரிப்பு சிகிச்சை',
    },
    active: true,
    iconName: 'Smile',
    description: 'Medical HydraFacial, chemical peels, hyperpigmentation, and acne scar rejuvenation.',
  },
  {
    id: 'cat-laser',
    name: 'Laser Dermatology',
    nameI18n: {
      en: 'Laser Dermatology',
      si: 'ලේසර් සම ප්‍රතිකාර',
      ta: 'லேசர் தோல் சிகிச்சை',
    },
    active: true,
    iconName: 'Zap',
    description: 'Triple-wavelength Laser Hair Reduction, Carbon laser toning, and vascular treatments.',
  },
  {
    id: 'cat-plastic-surgery',
    name: 'Plastic & Cosmetic Surgery',
    nameI18n: {
      en: 'Plastic & Cosmetic Surgery',
      si: 'ප්ලාස්ටික් හා රූපලාවණ්‍ය සැත්කම්',
      ta: 'பிளாஸ்டிக் மற்றும் அழகு அறுவை சிகிச்சை',
    },
    active: true,
    iconName: 'Scissors',
    description: 'Rhinoplasty, Blepharoplasty, Gynecomastia correction, and body sculpting.',
  },
  {
    id: 'cat-injectable',
    name: 'Non-invasive Injectables',
    nameI18n: {
      en: 'Non-invasive Injectables',
      si: 'එන්නත් මඟින් සිදුකරන ප්‍රතිකාර',
      ta: 'ஊசி மூலம் செய்யப்படும் சிகிச்சைகள்',
    },
    active: true,
    iconName: 'ShieldPlus',
    description: 'FDA-approved Botox, Dermal Hyaluronic Fillers, and Profhilo bioremodeling.',
  },
  {
    id: 'cat-physio',
    name: 'Physiotherapy & Wellness',
    nameI18n: {
      en: 'Physiotherapy & Wellness',
      si: 'භෞතචිකිත්සක හා සුවතා සේවා',
      ta: 'உடற்பயிற்சி சிகிச்சை மற்றும் நல்வாழ்வு',
    },
    active: true,
    iconName: 'Activity',
    description: 'Post-operative rehabilitation, musculoskeletal recovery, and posture correction.',
  },
  {
    id: 'cat-other',
    name: 'Specialist Consultation Clinics',
    nameI18n: {
      en: 'Specialist Consultation Clinics',
      si: 'විශේෂඥ වෛද්‍ය සායන',
      ta: 'சிறப்பு மருத்துவர் ஆலோசனைகள்',
    },
    active: true,
    iconName: 'HeartPulse',
    description: 'Consultations with senior board-certified dermatologists & plastic surgeons.',
  }
];

export const INITIAL_TREATMENTS: Treatment[] = [
  // Hair Care
  {
    id: 'trt-prp-hair',
    categoryId: 'cat-hair-care',
    name: 'PRP Hair Follicle Therapy',
    nameI18n: {
      en: 'PRP Hair Follicle Therapy',
      si: 'PRP හිසකෙස් වර්ධන ප්‍රතිකාරය',
      ta: 'PRP முடி வளர்ச்சி சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 18,000 - 25,000 / session',
    duration: '45 mins',
  },
  {
    id: 'trt-fue-transplant',
    categoryId: 'cat-hair-care',
    name: 'FUE Sapphire Hair Transplant',
    nameI18n: {
      en: 'FUE Sapphire Hair Transplant',
      si: 'FUE සෆයර් හිසකෙස් බද්ධ කිරීම',
      ta: 'FUE சஃபையர் முடி மாற்று அறுவை சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 250,000 - 450,000',
    duration: '4 - 6 hours',
  },
  {
    id: 'trt-gfc-hair',
    categoryId: 'cat-hair-care',
    name: 'GFC (Growth Factor Concentrate) Therapy',
    nameI18n: {
      en: 'GFC Therapy for Thinning Hair',
      si: 'GFC හිසකෙස් ප්‍රතිකාරය',
      ta: 'GFC முடி தடிமன் சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 24,000 / session',
    duration: '45 mins',
  },

  // Skin Care
  {
    id: 'trt-hydrafacial',
    categoryId: 'cat-skin-care',
    name: 'Signature Medical HydraFacial MD',
    nameI18n: {
      en: 'Signature Medical HydraFacial MD',
      si: 'සිග්නේචර් මෙඩිකල් හයිඩ්‍රාෆේෂල්',
      ta: 'சிக்னேச்சர் ஹைட்ராஃபேஷியல் சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 15,000 - 22,000',
    duration: '60 mins',
  },
  {
    id: 'trt-chemical-peel',
    categoryId: 'cat-skin-care',
    name: 'Dermatological Chemical Peel',
    nameI18n: {
      en: 'Dermatological Chemical Peel',
      si: 'චර්ම රෝග විශේෂඥ කෙමිකල් පීල් ප්‍රතිකාරය',
      ta: 'தோல் ரசாயன சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 12,000 - 18,000',
    duration: '30 mins',
  },
  {
    id: 'trt-acne-scar',
    categoryId: 'cat-skin-care',
    name: 'Microneedling RF for Acne Scars',
    nameI18n: {
      en: 'Microneedling RF for Acne Scars',
      si: 'කුරුලෑ කැළැල් ඉවත් කිරීමේ RF ප්‍රතිකාරය',
      ta: 'பரு தழும்புகளை நீக்கும் மைக்ரோநீட்லிங்',
    },
    active: true,
    priceRange: 'LKR 28,000 / session',
    duration: '60 mins',
  },

  // Laser
  {
    id: 'trt-laser-hair',
    categoryId: 'cat-laser',
    name: 'Full Body Triple-Diode Laser Hair Removal',
    nameI18n: {
      en: 'Full Body Triple-Diode Laser Hair Removal',
      si: 'මුළු සිරුරේම අනවශ්‍ය රෝම ලේසර් මඟින් ඉවත් කිරීම',
      ta: 'முழு உடல் லேசர் முடி அகற்றுதல்',
    },
    active: true,
    priceRange: 'LKR 10,000 - 65,000 (Package available)',
    duration: '30 - 90 mins',
  },
  {
    id: 'trt-carbon-laser',
    categoryId: 'cat-laser',
    name: 'Hollywood Carbon Peel Laser Toning',
    nameI18n: {
      en: 'Hollywood Carbon Peel Laser Toning',
      si: 'කාබන් පීල් ලේසර් ප්‍රතිකාරය',
      ta: 'ஹாலிவுட் கார்பன் லேசர் சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 16,000',
    duration: '45 mins',
  },

  // Injectable
  {
    id: 'trt-botox',
    categoryId: 'cat-injectable',
    name: 'Anti-Wrinkle Botox Injections (Allergan USA)',
    nameI18n: {
      en: 'Anti-Wrinkle Botox Injections (Allergan USA)',
      si: 'රැලි වැටීම් වැළැක්වීමේ බොටොක්ස් ප්‍රතිකාරය',
      ta: 'சுருக்கங்களை போக்கும் போடாக்ස් சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 35,000 - 75,000',
    duration: '30 mins',
  },
  {
    id: 'trt-dermal-fillers',
    categoryId: 'cat-injectable',
    name: 'Juvederm Lip & Cheek Fillers',
    nameI18n: {
      en: 'Juvederm Lip & Cheek Fillers',
      si: 'තොල් සහ කම්මුල් හැඩගැන්වීමේ ෆිලර්ස්',
      ta: 'உதடு மற்றும் கன்ன அழகு ஃபில்லர்ஸ்',
    },
    active: true,
    priceRange: 'LKR 65,000 - 110,000 / ml',
    duration: '45 mins',
  },

  // Plastic Surgery
  {
    id: 'trt-rhinoplasty',
    categoryId: 'cat-plastic-surgery',
    name: 'Open Structural Rhinoplasty (Nose Reshaping)',
    nameI18n: {
      en: 'Open Structural Rhinoplasty (Nose Reshaping)',
      si: 'නාසය හැඩගැන්වීමේ ප්ලාස්ටික් සැත්කම',
      ta: 'மூக்கு வடிவமைப்பு அறுவை சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 380,000 - 650,000',
    duration: '2 - 3 hours',
  },

  // Physio
  {
    id: 'trt-postop-physio',
    categoryId: 'cat-physio',
    name: 'Post-Operative Lymphatic Drainage & Physio',
    nameI18n: {
      en: 'Post-Operative Lymphatic Drainage & Physio',
      si: 'සැත්කම් පසු සුවතා හා භෞතචිකිත්සාව',
      ta: 'அறுவை சிகிச்சைக்குப் பிந்தைய உடற்பயிற்சி சிகிச்சை',
    },
    active: true,
    priceRange: 'LKR 8,500 / session',
    duration: '60 mins',
  }
];

export const INITIAL_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-followup-day1-en',
    name: 'Enquiry Follow-Up — Day 1 (English)',
    language: 'en',
    waTemplateName: 'royal_wellness_day1_enquiry_v2',
    category: 'UTILITY',
    body: 'Hi {{1}}, thank you for inquiring about {{2}} at Royal Wellness Center. Our clinical coordinator is ready to answer your questions or reserve your slot. Would you like to check doctor availability this week?',
    variables: ['Customer Name', 'Treatment Name'],
    approved: true,
  },
  {
    id: 'tpl-followup-day1-si',
    name: 'Enquiry Follow-Up — Day 1 (Sinhala)',
    language: 'si',
    waTemplateName: 'royal_wellness_day1_enquiry_si_v2',
    category: 'UTILITY',
    body: 'ආයුබෝවන් {{1}}, රෝයල් වෙල්නස් සෙන්ටර් වෙත ඔබගේ {{2}} විමසීමට ස්තූතියි. අපගේ වෛද්‍ය සම්බන්ධීකාරකවරයා ඔබගේ ප්‍රශ්නවලට පිළිතුරු දීමට හෝ වේලාවක් වෙන්කරවා ගැනීමට සූදානම්. මෙම සතියේ දිනයක් වෙන්කර ගැනීමට කැමතිද?',
    variables: ['පාරිභෝගික නම', 'ප්‍රතිකාර නාමය'],
    approved: true,
  },
  {
    id: 'tpl-followup-day1-ta',
    name: 'Enquiry Follow-Up — Day 1 (Tamil)',
    language: 'ta',
    waTemplateName: 'royal_wellness_day1_enquiry_ta_v2',
    category: 'UTILITY',
    body: 'வணக்கம் {{1}}, ராயல் வெல்னஸ் சென்டரில் {{2}} பற்றிய உங்களின் விசாரணைக்கு நன்றி. எங்கள் ஒருங்கிணைப்பாளர் உங்கள் கேள்விகளுக்கு பதிலளிக்க தயாராக உள்ளார். இந்த வாரம் மருத்துவரை சந்திக்க விரும்புகிறீர்களா?',
    variables: ['வாடிக்கையாளர் பெயர்', 'சிகிச்சை பெயர்'],
    approved: true,
  },
  {
    id: 'tpl-followup-day3-en',
    name: 'Doctor Slot Availability — Day 3 (English)',
    language: 'en',
    waTemplateName: 'royal_wellness_day3_slot_v1',
    category: 'UTILITY',
    body: 'Hello {{1}}, we noticed you were interested in {{2}}. Our senior specialists have limited consultation slots this Saturday and Sunday. Reply YES to hold a complimentary pre-consultation slot.',
    variables: ['Customer Name', 'Treatment Name'],
    approved: true,
  },
  {
    id: 'tpl-followup-day5-en',
    name: 'Exclusive Wellness Privilege — Day 5 (English)',
    language: 'en',
    waTemplateName: 'royal_wellness_day5_promo_v1',
    category: 'MARKETING',
    body: 'Dear {{1}}, we are currently offering an exclusive 15% welcome privilege for first-time clients seeking {{2}} at Royal Wellness Center. Would you like us to share our treatment brochure?',
    variables: ['Customer Name', 'Treatment Name'],
    approved: true,
  },
  {
    id: 'tpl-followup-day7-en',
    name: 'Final Follow-up & Feedback — Day 7 (English)',
    language: 'en',
    waTemplateName: 'royal_wellness_day7_checkin_v1',
    category: 'UTILITY',
    body: 'Hi {{1}}, we want to make sure you have all the information you need regarding {{2}}. If you would prefer a phone call or want to resume later, please let us know. Wishing you great health!',
    variables: ['Customer Name', 'Treatment Name'],
    approved: true,
  }
];

export const INITIAL_SEQUENCES: FollowupSequence[] = [
  {
    id: 'seq-standard-hair',
    categoryId: 'cat-hair-care',
    name: 'Hair Restoration 7-Day Nurture Sequence',
    active: true,
    steps: [
      { dayOffset: 1, templateId: 'tpl-followup-day1-en', label: 'Day 1: Doctor Availability' },
      { dayOffset: 3, templateId: 'tpl-followup-day3-en', label: 'Day 3: Slot Reservation' },
      { dayOffset: 5, templateId: 'tpl-followup-day5-en', label: 'Day 5: VIP Privilege & Brochure' },
      { dayOffset: 7, templateId: 'tpl-followup-day7-en', label: 'Day 7: Final Check-in' },
    ]
  },
  {
    id: 'seq-standard-skin',
    categoryId: 'cat-skin-care',
    name: 'Skin Care & Laser 7-Day Nurture Sequence',
    active: true,
    steps: [
      { dayOffset: 1, templateId: 'tpl-followup-day1-en', label: 'Day 1: Treatment Overview' },
      { dayOffset: 3, templateId: 'tpl-followup-day3-en', label: 'Day 3: Doctor Slots' },
      { dayOffset: 5, templateId: 'tpl-followup-day5-en', label: 'Day 5: Special Offer' },
      { dayOffset: 7, templateId: 'tpl-followup-day7-en', label: 'Day 7: Closure Check-in' },
    ]
  }
];

// Clean Real Production State — Ready for live incoming Meta WhatsApp customer inquiries
export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_FOLLOWUPS: Followup[] = [];

export const INITIAL_NOTES: LeadNote[] = [];

export const INITIAL_STAGE_HISTORY: LeadStageHistory[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
