/**
 * Royal Wellness Center — WhatsApp Concierge Auto-Reply & Intake Funnel Engine
 * 
 * Flow:
 * 1. New Inbound Message -> Welcome & Language Prompt (1. English, 2. සිංහල, 3. தமிழ்)
 * 2. Language Selection -> 24 Clinical Treatments Menu in chosen language
 * 3. Treatment Selection -> Auto-generate unique serial number, save to Supabase, 
 *    and reply "Okay, our coordinator will contact you shortly."
 * 4. Completed -> Bot marks intake complete and stops so human coordinators can converse freely.
 *    (Runs strictly ONCE per customer inquiry).
 */

import { getPrisma, getDbStatus } from './db.js';

// In-memory conversation state cache (Phone -> State)
// State structure: { stage: 'AWAITING_LANGUAGE' | 'AWAITING_TREATMENT' | 'COMPLETED' | 'PAUSED', lastUpdated: Date, selectedLang?: 'en' | 'si' | 'ta' }
const autoReplySessions = new Map();

// 24 Official Clinical Treatments Catalog
export const CLINICAL_TREATMENTS = [
  { num: 1, id: 'trt-htp', code: 'HTP', categoryId: 'cat-hair-care', name: 'Hair Transplantation', nameEn: 'Hair Transplantation', nameSi: 'Hair Transplantation (හිසකෙස් බද්ධ කිරීම)', nameTa: 'Hair Transplantation (முடி மாற்று அறுவை சிகிச்சை)', keywords: ['hair transplantation', 'hair transplant', 'transplantation', 'transplant', 'fue', 'බද්ධ', 'முடி மாற்று'] },
  { num: 2, id: 'trt-prp', code: 'PRP', categoryId: 'cat-hair-care', name: 'PRP', nameEn: 'PRP', nameSi: 'PRP (ප්ලේට්ලට් ප්‍රතිකාරය)', nameTa: 'PRP (PRP சிகிச்சை)', keywords: ['prp', 'platelet', 'ප්ලේට්ලට්'] },
  { num: 3, id: 'trt-gfc', code: 'GFC', categoryId: 'cat-hair-care', name: 'GFC', nameEn: 'GFC', nameSi: 'GFC (Growth Factor)', nameTa: 'GFC (Growth Factor)', keywords: ['gfc', 'growth factor'] },
  { num: 4, id: 'trt-hdf', code: 'HDF', categoryId: 'cat-skin-care', name: 'Hydra Facial', nameEn: 'Hydra Facial', nameSi: 'Hydra Facial (හයිඩ්‍රා ෆේෂල්)', nameTa: 'Hydra Facial (ஹைட்ரா ஃபேஷியல்)', keywords: ['hydra facial', 'hydrafacial', 'facial', 'හයිඩ්‍රා', 'ஃபேஷியல்'] },
  { num: 5, id: 'trt-hij', code: 'HIJ', categoryId: 'cat-ayurveda', name: 'Hijama', nameEn: 'Hijama', nameSi: 'Hijama (හිජාමා ප්‍රතිකාරය)', nameTa: 'Hijama (ஹிஜாமா சிகிச்சை)', keywords: ['hijama', 'cupping', 'හිජාමා', 'ஹிஜாமா'] },
  { num: 6, id: 'trt-pmt', code: 'PMT', categoryId: 'cat-iv-wellness', name: 'Pain Management', nameEn: 'Pain Management', nameSi: 'Pain Management (වේදනා කළමනාකරණය)', nameTa: 'Pain Management (வலி மேலாண்மை)', keywords: ['pain', 'pain management', 'වේදනා', 'வலி'] },
  { num: 7, id: 'trt-let', code: 'LET', categoryId: 'cat-ayurveda', name: 'Leech Treatment', nameEn: 'Leech Treatment', nameSi: 'Leech Treatment (කූඩැල්ලන් ප්‍රතිකාරය)', nameTa: 'Leech Treatment (அட்டை சிகிச்சை)', keywords: ['leech', 'leech treatment', 'කූඩැල්ලන්', 'அட்டை'] },
  { num: 8, id: 'trt-chp', code: 'CHP', categoryId: 'cat-skin-care', name: 'Chemical Peel', nameEn: 'Chemical Peel', nameSi: 'Chemical Peel (කෙමිකල් පීල්)', nameTa: 'Chemical Peel (கெமிக்கல் பீல்)', keywords: ['chemical peel', 'peel', 'කෙමිකල්', 'பீல்'] },
  { num: 9, id: 'trt-cbl', code: 'CBL', categoryId: 'cat-skin-care', name: 'Carbon Laser', nameEn: 'Carbon Laser', nameSi: 'Carbon Laser (කාබන් ලේසර්)', nameTa: 'Carbon Laser (கார்பன் லேசர்)', keywords: ['carbon laser', 'carbon', 'කාබන්', 'கார்பன்'] },
  { num: 10, id: 'trt-mcn', code: 'MCN', categoryId: 'cat-skin-care', name: 'Microneedling', nameEn: 'Microneedling', nameSi: 'Microneedling (මයික්‍රොනීඩ්ලින්)', nameTa: 'Microneedling (மைக்ரோநீட்லிங்)', keywords: ['microneedling', 'needling', 'derma pen', 'මයික්‍රොනීඩ්ලින්'] },
  { num: 11, id: 'trt-skb', code: 'SKB', categoryId: 'cat-skin-care', name: 'Skin Boosters', nameEn: 'Skin Boosters', nameSi: 'Skin Boosters (සම දීප්තිමත් කිරීමේ බූස්ටර්)', nameTa: 'Skin Boosters (ஸ்கின் பூஸ்டர்ஸ்)', keywords: ['skin boosters', 'skin booster', 'booster', 'බූස්ටර්'] },
  { num: 12, id: 'trt-chr', code: 'CHR', categoryId: 'cat-skin-care', name: 'CO2 Hair Removal', nameEn: 'CO2 Hair Removal', nameSi: 'CO2 Hair Removal (රෝම ඉවත් කිරීම)', nameTa: 'CO2 Hair Removal (முடி அகற்றுதல்)', keywords: ['hair removal', 'co2 hair removal', 'laser hair', 'රෝම'] },
  { num: 13, id: 'trt-btx', code: 'BTX', categoryId: 'cat-skin-care', name: 'Botox (Per Unit)', nameEn: 'Botox (Per Unit)', nameSi: 'Botox (බොටොක්ස්)', nameTa: 'Botox (போடாக்ஸ்)', keywords: ['botox', 'botox per unit', 'බොටොක්ස්', 'போடாக்ஸ்'] },
  { num: 14, id: 'trt-flr', code: 'FLR', categoryId: 'cat-skin-care', name: 'Filler (1ml)', nameEn: 'Filler (1ml)', nameSi: 'Filler (ෆිලර්)', nameTa: 'Filler (ஃபில்லர்)', keywords: ['filler', 'filler 1ml', 'ෆිලර්', 'ஃபில்லர்', 'dermal filler'] },
  { num: 15, id: 'trt-ivg', code: 'IVG', categoryId: 'cat-iv-wellness', name: 'IV Glutathione (Per Session)', nameEn: 'IV Glutathione (Per Session)', nameSi: 'IV Glutathione (IV ග්ලූටතයෝන්)', nameTa: 'IV Glutathione (IV குளுதாதயோன்)', keywords: ['glutathione', 'iv glutathione', 'iv drip', 'ග්ලූටතයෝන්', 'குளுதாதயோன்'] },
  { num: 16, id: 'trt-ckf', code: 'CKF', categoryId: 'cat-skin-care', name: 'Cheek Filler (new)', nameEn: 'Cheek Filler (new)', nameSi: 'Cheek Filler (කම්මුල් ෆිලර්)', nameTa: 'Cheek Filler (கன்ன ஃபில்லர்)', keywords: ['cheek filler', 'cheek', 'කම්මුල්', 'கன்ன'] },
  { num: 17, id: 'trt-ttf', code: 'TTF', categoryId: 'cat-skin-care', name: 'Tear Trough (Under-Eye) Filler (new)', nameEn: 'Tear Trough (Under-Eye) Filler (new)', nameSi: 'Tear Trough Filler (ඇස් යට ෆිලර්)', nameTa: 'Tear Trough Filler (கண்களுக்கு அடியில் ஃபில்லர்)', keywords: ['tear trough', 'under eye filler', 'under eye', 'eye filler', 'ඇස් යට'] },
  { num: 18, id: 'trt-hhb', code: 'HHB', categoryId: 'cat-skin-care', name: 'Hyperhidrosis Botox (Underarm) (new)', nameEn: 'Hyperhidrosis Botox (Underarm) (new)', nameSi: 'Hyperhidrosis Botox (කිහිලි අධික දහඩියට)', nameTa: 'Hyperhidrosis Botox (அக்குள் வியர்வைக்கு)', keywords: ['hyperhidrosis', 'underarm botox', 'sweat botox', 'sweat', 'දහඩිය'] },
  { num: 19, id: 'trt-hif', code: 'HIF', categoryId: 'cat-skin-care', name: 'HIFU', nameEn: 'HIFU', nameSi: 'HIFU (සම තද කිරීමේ ප්‍රතිකාරය)', nameTa: 'HIFU (தோல் இறுக்க சிகிச்சை)', keywords: ['hifu', 'ultrasound', 'skin tightening'] },
  { num: 20, id: 'trt-ebb', code: 'EBB', categoryId: 'cat-skin-care', name: 'Eyebrow Blading', nameEn: 'Eyebrow Blading', nameSi: 'Eyebrow Blading (ඇහිබැම බ්ලේඩින්)', nameTa: 'Eyebrow Blading (புருவ பிளேடிங்)', keywords: ['eyebrow', 'eyebrow blading', 'microblading', 'ඇහිබැම', 'புருவ'] },
  { num: 21, id: 'trt-smp', code: 'SMP', categoryId: 'cat-hair-care', name: 'Scalp Pigmentation', nameEn: 'Scalp Pigmentation', nameSi: 'Scalp Pigmentation (හිස්කබල පිග්මන්ටේෂන්)', nameTa: 'Scalp Pigmentation (ஸ்கால்ப் பிக்மென்டேஷன்)', keywords: ['scalp pigmentation', 'smp', 'scalp', 'හිස්කබල'] },
  { num: 22, id: 'trt-rfs', code: 'RFS', categoryId: 'cat-skin-care', name: 'RF Skin Tightening', nameEn: 'RF Skin Tightening', nameSi: 'RF Skin Tightening (RF සම තද කිරීම)', nameTa: 'RF Skin Tightening (RF தோல் இறுக்கம்)', keywords: ['rf skin tightening', 'rf', 'radio frequency', 'tightening'] },
  { num: 23, id: 'trt-co2', code: 'CO2', categoryId: 'cat-skin-care', name: 'CO2 Laser', nameEn: 'CO2 Laser', nameSi: 'CO2 Laser (CO2 ලේසර් ප්‍රතිකාරය)', nameTa: 'CO2 Laser (CO2 லேசர்)', keywords: ['co2 laser', 'fractional laser', 'co2'] },
  { num: 24, id: 'trt-led', code: 'LED', categoryId: 'cat-skin-care', name: 'LED Light Therapy', nameEn: 'LED Light Therapy', nameSi: 'LED Light Therapy (LED ආලෝක ප්‍රතිකාරය)', nameTa: 'LED Light Therapy (LED ஒளி சிகிச்சை)', keywords: ['led', 'led light', 'light therapy', 'ආලෝක'] }
];

// Step 1: Welcome & Language Prompt
export const WELCOME_LANGUAGE_MESSAGE = 
`🌟 *Welcome to Royal Wellness Center!*
We are delighted to assist you with our premier medical and aesthetic clinical services.

Please select your preferred language:
කරුණාකර ඔබ කැමති භාෂාව තෝරන්න:
தயவுசெய்து உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்:

1️⃣ English
2️⃣ සිංහල (Sinhala)
3️⃣ தமிழ் (Tamil)

_Reply with 1, 2, or 3_`;

// Step 2: Treatment Menu per Language
export const getTreatmentMenuMessage = (lang = 'en') => {
  if (lang === 'si') {
    return `✨ *ස්තූතියි!* ඔබ විමසීමට බලාපොරොත්තු වන ප්‍රතිකාරය තෝරන්න:

1. Hair Transplantation (හිසකෙස් බද්ධ කිරීම)
2. PRP (ප්ලේට්ලට් ප්‍රතිකාරය)
3. GFC
4. Hydra Facial (හයිඩ්‍රා ෆේෂල්)
5. Hijama (හිජාමා ප්‍රතිකාරය)
6. Pain Management (වේදනා කළමනාකරණය)
7. Leech Treatment (කූඩැල්ලන් ප්‍රතිකාරය)
8. Chemical Peel (කෙමිකල් පීල්)
9. Carbon Laser (කාබන් ලේසර්)
10. Microneedling (මයික්‍රොනීඩ්ලින්)
11. Skin Boosters (සම දීප්තිමත් කිරීමේ බූස්ටර්)
12. CO2 Hair Removal (රෝම ඉවත් කිරීම)
13. Botox (Per Unit) (බොටොක්ස්)
14. Filler (1ml) (ෆිලර්)
15. IV Glutathione (Per Session) (IV ග්ලූටතයෝන්)
16. Cheek Filler (new) (කම්මුල් ෆිලර්)
17. Tear Trough Filler (new) (ඇස් යට ෆිලර්)
18. Hyperhidrosis Botox (new) (කිහිලි අධික දහඩියට)
19. HIFU (සම තද කිරීමේ ප්‍රතිකාරය)
20. Eyebrow Blading (ඇහිබැම බ්ලේඩින්)
21. Scalp Pigmentation (හිස්කබල පිග්මන්ටේෂන්)
22. RF Skin Tightening (RF සම තද කිරීම)
23. CO2 Laser (CO2 ලේසර්)
24. LED Light Therapy (LED ආලෝක ප්‍රතිකාරය)

_කරුණාකර අංකය (1 - 24) හෝ ප්‍රතිකාරයේ නම එවන්න_`;
  }

  if (lang === 'ta') {
    return `✨ *நன்றி!* நீங்கள் விசாரிக்க விரும்பும் சிகிச்சையைத் தேர்ந்தெடுக்கவும்:

1. Hair Transplantation (முடி மாற்று அறுவை சிகிச்சை)
2. PRP (PRP சிகிச்சை)
3. GFC
4. Hydra Facial (ஹைட்ரா ஃபேஷியல்)
5. Hijama (ஹிஜாமா சிகிச்சை)
6. Pain Management (வலி மேலாண்மை)
7. Leech Treatment (அட்டை சிகிச்சை)
8. Chemical Peel (கெமிக்கல் பீல்)
9. Carbon Laser (கார்பன் லேசர்)
10. Microneedling (மைக்ரோநீட்லிங்)
11. Skin Boosters (ஸ்கின் பூஸ்டர்ஸ்)
12. CO2 Hair Removal (முடி அகற்றுதல்)
13. Botox (Per Unit) (போடாக்ஸ்)
14. Filler (1ml) (ஃபில்லர்)
15. IV Glutathione (Per Session) (IV குளுதாதயோன்)
16. Cheek Filler (new) (கன்ன ஃபில்லர்)
17. Tear Trough Filler (new) (கண்களுக்கு அடியில் ஃபில்லர்)
18. Hyperhidrosis Botox (new) (அக்குள் வியர்வைக்கு)
19. HIFU (தோல் இறுக்க சிகிச்சை)
20. Eyebrow Blading (புருவ பிளேடிங்)
21. Scalp Pigmentation (ஸ்கால்ப் பிக்மென்டேஷன்)
22. RF Skin Tightening (RF தோல் இறுக்கம்)
23. CO2 Laser (CO2 லேசர்)
24. LED Light Therapy (LED ஒளி சிகிச்சை)

_தயவுசெய்து சிகிச்சை எண்ணை (1 - 24) அல்லது பெயரை அனுப்பவும்_`;
  }

  // Default: English
  return `✨ *Thank you!* Which clinical treatment would you like to inquire about?

1. Hair Transplantation
2. PRP
3. GFC
4. Hydra Facial
5. Hijama
6. Pain Management
7. Leech Treatment
8. Chemical Peel
9. Carbon Laser
10. Microneedling
11. Skin Boosters
12. CO2 Hair Removal
13. Botox (Per Unit)
14. Filler (1ml)
15. IV Glutathione (Per Session)
16. Cheek Filler (new)
17. Tear Trough (Under-Eye) Filler (new)
18. Hyperhidrosis Botox (Underarm) (new)
19. HIFU
20. Eyebrow Blading
21. Scalp Pigmentation
22. RF Skin Tightening
23. CO2 Laser
24. LED Light Therapy

_Reply with the treatment number (1 - 24) or name_`;
};

// Step 3: Final Confirmation & Clinical Handoff Message
export const getFinalHandoffMessage = (lang = 'en', treatmentName = 'Selected Treatment') => {
  if (lang === 'si') {
    return `🩺 *ඔබේ විමසීම සාර්ථකව ලැබිණි!*
ඔබ තෝරාගත් *${treatmentName}* සම්බන්ධයෙන් වැඩිදුර තොරතුරු ලබාදීමට අපගේ සම්බන්ධීකාරකවරයෙකු ඉතා ඉක්මනින් ඔබව සම්බන්ධ කරගනු ඇත.

_Royal Wellness Center — Premier Aesthetic & Clinical Care_ 🌿`;
  }

  if (lang === 'ta') {
    return `🩺 *உங்கள் தகவல் வெற்றிகரமாக பெறப்பட்டது!*
நீங்கள் தேர்ந்தெடுத்த *${treatmentName}* சிகிச்சைக்காக, எங்கள் ஒருங்கிணைப்பாளர் விரைவில் உங்களைத் தொடர்புகொள்வார்.

_Royal Wellness Center — Premier Aesthetic & Clinical Care_ 🌿`;
  }

  return `🩺 *Inquiry Received!*
Thank you for your interest in *${treatmentName}*.

Our clinical coordinator will contact you shortly on this WhatsApp chat.

_Royal Wellness Center — Premier Aesthetic & Clinical Care_ 🌿`;
};

/**
 * Parses user message for language selection
 */
function parseLanguageChoice(text = '') {
  const clean = text.trim().toLowerCase();
  if (clean === '1' || clean === 'english' || clean === 'eng' || clean === 'en' || clean === '1️⃣') return 'en';
  if (clean === '2' || clean === 'sinhala' || clean === 'sin' || clean === 'si' || clean.includes('සිංහල') || clean === '2️⃣') return 'si';
  if (clean === '3' || clean === 'tamil' || clean === 'tam' || clean === 'ta' || clean.includes('தமிழ்') || clean === '3️⃣') return 'ta';
  return null;
}

/**
 * Parses user message for treatment selection (1-24 or keywords)
 */
function parseTreatmentChoice(text = '') {
  const clean = text.trim().toLowerCase();
  
  // 1. Direct number matching (1 to 24)
  const parsedNum = parseInt(clean, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 24) {
    return CLINICAL_TREATMENTS.find(t => t.num === parsedNum) || null;
  }

  // 2. Direct name/keyword matching
  for (const trt of CLINICAL_TREATMENTS) {
    if (clean === trt.code.toLowerCase()) return trt;
    if (clean === trt.name.toLowerCase()) return trt;
    if (clean.includes(trt.name.toLowerCase())) return trt;
    if (trt.keywords && trt.keywords.some(kw => clean.includes(kw.toLowerCase()))) {
      return trt;
    }
  }

  return null;
}

/**
 * Generates unique sequential serial number e.g. HTP-001, PRP-002
 */
async function generateNextSerialNumber(prisma, treatmentCode) {
  const prefix = `${treatmentCode || 'TRT'}-`;
  try {
    if (prisma && getDbStatus()) {
      const existingLeads = await prisma.lead.findMany({
        where: {
          serialNumber: {
            startsWith: prefix
          }
        },
        select: { serialNumber: true }
      });
      let maxNum = 0;
      for (const l of existingLeads) {
        if (l.serialNumber && l.serialNumber.startsWith(prefix)) {
          const num = parseInt(l.serialNumber.substring(prefix.length), 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }
  } catch (e) {
    console.warn('Could not query existing serial numbers:', e.message);
  }
  return `${prefix}001`;
}

/**
 * Pauses auto-reply for a customer (e.g. when staff/coordinator sends a manual reply)
 */
export const pauseAutoReply = (phone) => {
  if (!phone) return;
  const digits = phone.replace(/[^0-9]/g, '');
  autoReplySessions.set(digits, { stage: 'COMPLETED', lastUpdated: new Date() });
  console.log(`🤖 [AUTO-REPLY] Bot stopped for ${digits} (Staff active).`);
};

export const clearAutoReplySessions = () => {
  autoReplySessions.clear();
  console.log('🤖 [AUTO-REPLY] All auto-reply sessions reset.');
};

/**
 * Main Auto-Reply Decision Engine
 * Evaluates inbound message and returns the next automated reply (if any), along with database updates.
 * 
 * Rules:
 * - Sends strictly ONCE per customer (completes intake and ceases automatically).
 * - If customer has an assigned coordinator, existing serial number, or completed stage, bot stays silent.
 * 
 * @param {Object} params
 * @param {string} params.senderPhone - Clean phone digits (e.g. "94771234567")
 * @param {string} params.messageText - Inbound text
 * @param {Object} params.customer - Database Customer object
 * @param {Object} params.lead - Database Lead object
 * @returns {Promise<{ shouldReply: boolean, replyText?: string, treatmentId?: string, categoryId?: string, serialNumber?: string, selectedLang?: string }>}
 */
export async function evaluateAutoReply({ senderPhone, messageText, customer, lead }) {
  if (!senderPhone || !messageText) {
    return { shouldReply: false };
  }

  const cleanPhone = senderPhone.replace(/[^0-9]/g, '');
  const cleanText = messageText.trim().toLowerCase();
  
  let session = autoReplySessions.get(cleanPhone);

  // 1. ONE-TIME RULE: If session is already completed, do not re-trigger
  if (session && session.stage === 'COMPLETED') {
    return { shouldReply: false };
  }

  // 2. Check DB state: If lead already finished intake (has a serial number assigned e.g. HTP-001) or is closed/converted
  if (lead) {
    if (lead.serialNumber && lead.serialNumber.trim().length > 0 && lead.serialNumber !== '---') {
      autoReplySessions.set(cleanPhone, { stage: 'COMPLETED', lastUpdated: new Date() });
      return { shouldReply: false };
    }
    if (lead.stage && ['converted', 'lost', 'not_relevant'].includes(lead.stage)) {
      autoReplySessions.set(cleanPhone, { stage: 'COMPLETED', lastUpdated: new Date() });
      return { shouldReply: false };
    }
  }

  const prisma = getPrisma();

  // If no session exists yet, start from STEP 1 (Welcome & Language)
  if (!session || session.stage === 'IDLE') {
    autoReplySessions.set(cleanPhone, {
      stage: 'AWAITING_LANGUAGE',
      lastUpdated: new Date()
    });

    console.log(`🤖 [AUTO-REPLY STEP 1] Sending Welcome & Language Selection to ${cleanPhone} (Inbound: "${messageText}")`);
    return {
      shouldReply: true,
      replyText: WELCOME_LANGUAGE_MESSAGE
    };
  }

  // ----------------------------------------------------
  // STEP 2: AWAITING LANGUAGE -> Parse Language & Send 24 Treatments Menu
  // ----------------------------------------------------
  if (session.stage === 'AWAITING_LANGUAGE') {
    const selectedLang = parseLanguageChoice(messageText);

    if (!selectedLang) {
      // Prompt user politely to pick 1, 2, or 3
      return {
        shouldReply: true,
        replyText: `Please reply with a number (1, 2, or 3) to select your language:\n\n1️⃣ English\n2️⃣ සිංහල (Sinhala)\n3️⃣ தமிழ் (Tamil)`
      };
    }

    // Advance session to AWAITING_TREATMENT
    autoReplySessions.set(cleanPhone, {
      stage: 'AWAITING_TREATMENT',
      selectedLang,
      lastUpdated: new Date()
    });

    // Save language to Supabase Customer and Lead immediately
    if (prisma && getDbStatus()) {
      if (customer?.id) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { preferredLanguage: selectedLang }
        }).catch(err => console.warn('Could not update customer language:', err.message));
      }
      if (lead?.id) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { language: selectedLang }
        }).catch(err => console.warn('Could not update lead language:', err.message));
      }
    }

    const treatmentMenu = getTreatmentMenuMessage(selectedLang);
    console.log(`🤖 [AUTO-REPLY STEP 2] Language selected: [${selectedLang}]. Sending 24 Treatments Menu to ${cleanPhone}`);
    
    return {
      shouldReply: true,
      replyText: treatmentMenu,
      selectedLang
    };
  }

  // ----------------------------------------------------
  // STEP 3: AWAITING TREATMENT -> Parse Treatment, Generate Serial, Save to Supabase & Final Confirmation
  // ----------------------------------------------------
  if (session.stage === 'AWAITING_TREATMENT') {
    const chosenTreatment = parseTreatmentChoice(messageText);
    const userLang = session.selectedLang || 'en';

    if (!chosenTreatment) {
      // Prompt user politely to choose 1 - 24
      const retryText = userLang === 'si'
        ? `කරුණාකර ඉහත ලැයිස්තුවෙන් ප්‍රතිකාර අංකය (1 - 24) හෝ ප්‍රතිකාරයේ නම එවන්න.`
        : userLang === 'ta'
        ? `தயவுசெய்து மேலே உள்ள பட்டியலில் இருந்து சிகிச்சை எண்ணை (1 - 24) அல்லது பெயரை அனுப்பவும்.`
        : `Please reply with a valid treatment number (1 - 24) or treatment name from the list above.`;

      return {
        shouldReply: true,
        replyText: retryText
      };
    }

    // Generate unique serial number (e.g. HTP-001, PRP-002)
    const generatedSerial = await generateNextSerialNumber(prisma, chosenTreatment.code);

    // Mark intake session as COMPLETED (Bot turns off permanently for this customer)
    autoReplySessions.set(cleanPhone, {
      stage: 'COMPLETED',
      selectedLang: userLang,
      selectedTreatment: chosenTreatment.id,
      lastUpdated: new Date()
    });

    const treatmentDisplayName = userLang === 'si' 
      ? chosenTreatment.nameSi 
      : userLang === 'ta' 
      ? chosenTreatment.nameTa 
      : chosenTreatment.nameEn;

    const finalHandoff = getFinalHandoffMessage(userLang, treatmentDisplayName);

    // Save treatment, category, serial number, language into Supabase PostgreSQL
    if (prisma && getDbStatus() && lead?.id) {
      try {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            categoryId: chosenTreatment.categoryId,
            treatmentId: chosenTreatment.id,
            serialNumber: generatedSerial,
            language: userLang,
            stage: 'new',
            updatedAt: new Date()
          }
        });
        console.log(`✅ [CRM AUTO-INTAKE] Lead ${lead.id} saved in Supabase: Treatment [${chosenTreatment.name}] | Serial [${generatedSerial}] | Lang [${userLang}]`);
      } catch (err) {
        console.warn('Could not update lead in Supabase:', err.message);
      }
    }

    console.log(`🤖 [AUTO-REPLY STEP 3] Funnel Completed for ${cleanPhone}. Serial Generated: ${generatedSerial}`);

    return {
      shouldReply: true,
      replyText: finalHandoff,
      treatmentId: chosenTreatment.id,
      categoryId: chosenTreatment.categoryId,
      serialNumber: generatedSerial,
      selectedLang: userLang
    };
  }

  return { shouldReply: false };
}
