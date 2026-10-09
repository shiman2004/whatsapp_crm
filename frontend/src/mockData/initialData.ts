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
  { id: 'trt-htp', code: 'HTP', categoryId: 'cat-hair-care', name: 'Hair Transplantation', nameI18n: { en: 'Hair Transplantation', si: 'හිසකෙස් බද්ධ කිරීම', ta: 'முடி மாற்று அறுவை சிகிச்சை' }, active: true },
  { id: 'trt-prp', code: 'PRP', categoryId: 'cat-hair-care', name: 'PRP', nameI18n: { en: 'PRP (Platelet Rich Plasma)', si: 'PRP ප්‍රතිකාරය', ta: 'PRP சிகிச்சை' }, active: true },
  { id: 'trt-gfc', code: 'GFC', categoryId: 'cat-hair-care', name: 'GFC', nameI18n: { en: 'GFC (Growth Factor Concentrate)', si: 'GFC ප්‍රතිකාරය', ta: 'GFC சிகிச்சை' }, active: true },
  { id: 'trt-hdf', code: 'HDF', categoryId: 'cat-skin-care', name: 'Hydra Facial', nameI18n: { en: 'Hydra Facial', si: 'හයිඩ්‍රා ෆේෂල්', ta: 'ஹைட்ரா ஃபேஷியல்' }, active: true },
  { id: 'trt-hij', code: 'HIJ', categoryId: 'cat-ayurveda', name: 'Hijama', nameI18n: { en: 'Hijama / Cupping Therapy', si: 'හිජාමා ප්‍රතිකාරය', ta: 'ஹிஜாமா சிகிச்சை' }, active: true },
  { id: 'trt-pmt', code: 'PMT', categoryId: 'cat-iv-wellness', name: 'Pain Management', nameI18n: { en: 'Pain Management', si: 'වේදනා කළමනාකරණය', ta: 'வலி மேலாண்மை சிகிச்சை' }, active: true },
  { id: 'trt-let', code: 'LET', categoryId: 'cat-ayurveda', name: 'Leech Treatment', nameI18n: { en: 'Leech Treatment', si: 'කූඩැල්ලන් ප්‍රතිකාරය', ta: 'அட்டை சிகிச்சை' }, active: true },
  { id: 'trt-chp', code: 'CHP', categoryId: 'cat-skin-care', name: 'Chemical Peel', nameI18n: { en: 'Chemical Peel', si: 'කෙමිකල් පීල්', ta: 'கெமிக்கல் பீல்' }, active: true },
  { id: 'trt-cbl', code: 'CBL', categoryId: 'cat-skin-care', name: 'Carbon Laser', nameI18n: { en: 'Carbon Laser', si: 'කාබන් ලේසර්', ta: 'கார்பன் லேசர்' }, active: true },
  { id: 'trt-mcn', code: 'MCN', categoryId: 'cat-skin-care', name: 'Microneedling', nameI18n: { en: 'Microneedling', si: 'මයික්‍රොනීඩ්ලින්', ta: 'மைக்ரோநீட்லிங்' }, active: true },
  { id: 'trt-skb', code: 'SKB', categoryId: 'cat-skin-care', name: 'Skin Boosters', nameI18n: { en: 'Skin Boosters', si: 'සම දීප්තිමත් කිරීමේ බූස්ටර්', ta: 'ஸ்கின் பூஸ்டர்ஸ்' }, active: true },
  { id: 'trt-chr', code: 'CHR', categoryId: 'cat-skin-care', name: 'CO2 Hair Removal', nameI18n: { en: 'CO2 Hair Removal', si: 'CO2 අනවශ්‍ය රෝම ඉවත් කිරීම', ta: 'CO2 முடி அகற்றுதல்' }, active: true },
  { id: 'trt-btx', code: 'BTX', categoryId: 'cat-skin-care', name: 'Botox (Per Unit)', nameI18n: { en: 'Botox (Per Unit)', si: 'බොටොක්ස් (ඒකකයකට)', ta: 'போடாக்ஸ் (ஒரு யூனிட்)' }, active: true },
  { id: 'trt-flr', code: 'FLR', categoryId: 'cat-skin-care', name: 'Filler (1ml)', nameI18n: { en: 'Filler (1ml)', si: 'ෆිලර් (1ml)', ta: 'ஃபில்லர் (1ml)' }, active: true },
  { id: 'trt-ivg', code: 'IVG', categoryId: 'cat-iv-wellness', name: 'IV Glutathione (Per Session)', nameI18n: { en: 'IV Glutathione (Per Session)', si: 'IV ග්ලූටතයෝන්', ta: 'IV குளுதாதயோன்' }, active: true },
  { id: 'trt-ckf', code: 'CKF', categoryId: 'cat-skin-care', name: 'Cheek Filler (new)', nameI18n: { en: 'Cheek Filler (new)', si: 'කම්මුල් ෆිලර්', ta: 'கன்ன ஃபில்லர்' }, active: true },
  { id: 'trt-ttf', code: 'TTF', categoryId: 'cat-skin-care', name: 'Tear Trough (Under-Eye) Filler (new)', nameI18n: { en: 'Tear Trough (Under-Eye) Filler (new)', si: 'ඇස් යට ෆිලර් ප්‍රතිකාරය', ta: 'கண்களுக்கு அடியில் ஃபில்லர்' }, active: true },
  { id: 'trt-hhb', code: 'HHB', categoryId: 'cat-skin-care', name: 'Hyperhidrosis Botox (Underarm) (new)', nameI18n: { en: 'Hyperhidrosis Botox (Underarm) (new)', si: 'කිහිලි අධික දහඩිය දැමීමට බොටොක්ස්', ta: 'அக்குள் வியர்வைக்கு போடாக்ஸ்' }, active: true },
  { id: 'trt-hif', code: 'HIF', categoryId: 'cat-skin-care', name: 'HIFU', nameI18n: { en: 'HIFU (High-Intensity Focused Ultrasound)', si: 'HIFU සම තද කිරීමේ ප්‍රතිකාරය', ta: 'HIFU தோல் இறுக்க சிகிச்சை' }, active: true },
  { id: 'trt-ebb', code: 'EBB', categoryId: 'cat-skin-care', name: 'Eyebrow Blading', nameI18n: { en: 'Eyebrow Blading / Microblading', si: 'ඇහිබැම බ්ලේඩින්', ta: 'புருவ பிளேடிங்' }, active: true },
  { id: 'trt-smp', code: 'SMP', categoryId: 'cat-hair-care', name: 'Scalp Pigmentation', nameI18n: { en: 'Scalp Pigmentation (SMP)', si: 'හිස්කබල පිග්මන්ටේෂන්', ta: 'ஸ்கால்ப் பிக்மென்டேஷன்' }, active: true },
  { id: 'trt-rfs', code: 'RFS', categoryId: 'cat-skin-care', name: 'RF Skin Tightening', nameI18n: { en: 'RF Skin Tightening', si: 'RF සම තද කිරීමේ ප්‍රතිකාරය', ta: 'RF தோல் இறுக்கம்' }, active: true },
  { id: 'trt-co2', code: 'CO2', categoryId: 'cat-skin-care', name: 'CO2 Laser', nameI18n: { en: 'CO2 Fractional Laser', si: 'CO2 ලේසර් ප්‍රතිකාරය', ta: 'CO2 லேசர் சிகிச்சை' }, active: true },
  { id: 'trt-led', code: 'LED', categoryId: 'cat-skin-care', name: 'LED Light Therapy', nameI18n: { en: 'LED Light Therapy', si: 'LED ආලෝක ප්‍රතිකාරය', ta: 'LED ஒளி சிகிச்சை' }, active: true }
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
