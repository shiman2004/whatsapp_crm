/**
 * Royal Wellness Center — WhatsApp Concierge Auto-Reply & Intake Funnel Engine
 * 
 * Flow:
 * 1. New Inbound Message -> Welcome & Language Prompt (1. English, 2. සිංහල, 3. தமிழ்)
 * 2. Language Selection -> 5 Clinical Treatment Categories Menu in chosen language:
 *    1. 💇 Hair & Scalp Treatments
 *    2. ✨ Skin & Facial Treatments
 *    3. 💉 Injectables & Aesthetic Treatments
 *    4. 🩺 Pain Management & Other Therapies
 *    5. 📋 Others
 * 3. Treatment Selection -> Auto-generate unique serial number, save to Supabase, 
 *    and reply "Okay, our coordinator will contact you shortly."
 * 4. Completed -> Bot marks intake complete and stops so human coordinators can converse freely.
 *    (Runs strictly ONCE per customer inquiry).
 */

import { getPrisma, getDbStatus } from './db.js';

// In-memory conversation state cache (Phone -> State)
// State structure: { stage: 'AWAITING_LANGUAGE' | 'AWAITING_TREATMENT' | 'COMPLETED' | 'PAUSED', lastUpdated: Date, selectedLang?: 'en' | 'si' | 'ta' }
const autoReplySessions = new Map();

// 5 Official Clinical Treatment Categories / Funnel Options
export const CLINICAL_TREATMENTS = [
  {
    num: 1,
    id: 'trt-hair-scalp',
    code: 'HST',
    categoryId: 'cat-hair-care',
    name: 'Hair & Scalp Treatments',
    nameEn: 'Hair & Scalp Treatments',
    nameSi: 'හිසකෙස් සහ හිස්කබල ප්‍රතිකාර (Hair & Scalp Treatments)',
    nameTa: 'முடி மற்றும் உச்சந்தலை சிகிச்சைகள் (Hair & Scalp Treatments)',
    keywords: [
      'hair', 'scalp', 'hair transplantation', 'transplant', 'prp', 'gfc', 'smp', 'scalp pigmentation',
      'හිසකෙස්', 'බද්ධ', 'ප්ලේට්ලට්', 'முடி', 'முடி மாற்று', 'உச்சந்தலை'
    ]
  },
  {
    num: 2,
    id: 'trt-skin-facial',
    code: 'SFT',
    categoryId: 'cat-skin-care',
    name: 'Skin & Facial Treatments',
    nameEn: 'Skin & Facial Treatments',
    nameSi: 'සම සහ මුහුණේ ප්‍රතිකාර (Skin & Facial Treatments)',
    nameTa: 'தோல் மற்றும் முக சிகிச்சைகள் (Skin & Facial Treatments)',
    keywords: [
      'skin', 'facial', 'hydra facial', 'hydrafacial', 'carbon laser', 'chemical peel', 'microneedling',
      'skin boosters', 'hifu', 'rf skin tightening', 'co2 laser', 'led light therapy', 'eyebrow blading',
      'සම', 'මුහුණ', 'හයිඩ්‍රා', 'කාබන්', 'පීල්', 'තද කිරීම', 'தோல்', 'முகம்', 'ஃபேஷியல்', 'கார்பன்'
    ]
  },
  {
    num: 3,
    id: 'trt-injectables',
    code: 'IAT',
    categoryId: 'cat-skin-care',
    name: 'Injectables & Aesthetic Treatments',
    nameEn: 'Injectables & Aesthetic Treatments',
    nameSi: 'එන්නත් සහ සෞන්දර්ය ප්‍රතිකාර (Injectables & Aesthetic Treatments)',
    nameTa: 'ஊசி மற்றும் அழகியல் சிகிச்சைகள் (Injectables & Aesthetic Treatments)',
    keywords: [
      'injectables', 'botox', 'filler', 'iv glutathione', 'cheek filler', 'tear trough', 'underarm botox',
      'hyperhidrosis', 'glutathione', 'dermal filler', 'එන්නත්', 'බොටොක්ස්', 'ෆිලර්', 'ග්ලූටතයෝන්',
      'ஊசி', 'போடாக்ஸ்', 'ஃபில்லர்', 'குளுதாதயோன்'
    ]
  },
  {
    num: 4,
    id: 'trt-pain-mgmt',
    code: 'PMT',
    categoryId: 'cat-iv-wellness',
    name: 'Pain Management & Other Therapies',
    nameEn: 'Pain Management & Other Therapies',
    nameSi: 'වේදනා කළමනාකරණය සහ වෙනත් ප්‍රතිකාර (Pain Management & Other Therapies)',
    nameTa: 'வலி மேலாண்மை மற்றும் பிற சிகிச்சைகள் (Pain Management & Other Therapies)',
    keywords: [
      'pain', 'pain management', 'hijama', 'cupping', 'leech treatment', 'leech', 'co2 hair removal',
      'physiotherapy', 'therapy', 'වේදනා', 'හිජාමා', 'කූඩැල්ලන්', 'රෝම', 'வலி', 'ஹிஜாமா', 'அட்டை'
    ]
  },
  {
    num: 5,
    id: 'trt-others',
    code: 'OTH',
    categoryId: 'cat-skin-care',
    name: 'Others',
    nameEn: 'Others',
    nameSi: 'වෙනත් (Others)',
    nameTa: 'மற்றவை (Others)',
    keywords: [
      'other', 'others', 'general', 'consultation', 'inquiry', 'appointment', 'price', 'cost',
      'වෙනත්', 'විමසීම්', 'மற்றவை', 'ஆலோசனை'
    ]
  }
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
    return `✨ *ස්තූතියි!* ඔබ විමසීමට බලාපොරොත්තු වන සායනික ප්‍රතිකාරය කුමක්ද?

1. 💇 හිසකෙස් සහ හිස්කබල ප්‍රතිකාර (Hair & Scalp Treatments)
2. ✨ සම සහ මුහුණේ ප්‍රතිකාර (Skin & Facial Treatments)
3. 💉 එන්නත් සහ සෞන්දර්ය ප්‍රතිකාර (Injectables & Aesthetic Treatments)
4. 🩺 වේදනා කළමනාකරණය සහ වෙනත් ප්‍රතිකාර (Pain Management & Other Therapies)
5. 📋 වෙනත් (Others)

_කරුණාකර අංකය (1–5) එවන්න._`;
  }

  if (lang === 'ta') {
    return `✨ *நன்றி!* நீங்கள் விசாரிக்க விரும்பும் மருத்துவ சிகிச்சை எது?

1. 💇 முடி மற்றும் உச்சந்தலை சிகிச்சைகள் (Hair & Scalp Treatments)
2. ✨ தோல் மற்றும் முக சிகிச்சைகள் (Skin & Facial Treatments)
3. 💉 ஊசி மற்றும் அழகியல் சிகிச்சைகள் (Injectables & Aesthetic Treatments)
4. 🩺 வலி மேலாண்மை மற்றும் பிற சிகிச்சைகள் (Pain Management & Other Therapies)
5. 📋 மற்றவை (Others)

_தயவுசெய்து தெரிவு எண்ணை (1–5) அனுப்பவும்._`;
  }

  // Default: English
  return `✨ *Thank you!* Which clinical treatment would you like to inquire about?

1. 💇 Hair & Scalp Treatments
2. ✨ Skin & Facial Treatments
3. 💉 Injectables & Aesthetic Treatments
4. 🩺 Pain Management & Other Therapies
5. 📋 Others

_Reply with the option number (1–5)._`;
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
 * Parses user message for treatment selection (1-5 or keywords)
 */
function parseTreatmentChoice(text = '') {
  const clean = text.trim().toLowerCase();
  
  // 1. Direct number matching (1 to 5) or unicode emojis
  if (clean === '1' || clean === '1️⃣' || clean.startsWith('1.')) return CLINICAL_TREATMENTS[0];
  if (clean === '2' || clean === '2️⃣' || clean.startsWith('2.')) return CLINICAL_TREATMENTS[1];
  if (clean === '3' || clean === '3️⃣' || clean.startsWith('3.')) return CLINICAL_TREATMENTS[2];
  if (clean === '4' || clean === '4️⃣' || clean.startsWith('4.')) return CLINICAL_TREATMENTS[3];
  if (clean === '5' || clean === '5️⃣' || clean.startsWith('5.')) return CLINICAL_TREATMENTS[4];

  const parsedNum = parseInt(clean, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 5) {
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
 * Generates unique sequential serial number e.g. HST-001, SFT-002, IAT-003, PMT-004, OTH-005
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
  
  let session = autoReplySessions.get(cleanPhone);

  // 1. ONE-TIME RULE: If session is already completed, do not re-trigger
  if (session && session.stage === 'COMPLETED') {
    return { shouldReply: false };
  }

  // 2. Check DB state: If lead already finished intake (has a serial number assigned e.g. HST-001) or is closed/converted
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
  // STEP 2: AWAITING LANGUAGE -> Parse Language & Send 5 Treatment Categories Menu
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
    console.log(`🤖 [AUTO-REPLY STEP 2] Language selected: [${selectedLang}]. Sending 5 Clinical Treatments Menu to ${cleanPhone}`);
    
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
      // Prompt user politely to choose 1–5
      const retryText = userLang === 'si'
        ? `කරුණාකර අංකය (1–5) එවන්න.`
        : userLang === 'ta'
        ? `தயவுசெய்து தெரிவு எண்ணை (1–5) அனுப்பவும்.`
        : `Please reply with the option number (1–5).`;

      return {
        shouldReply: true,
        replyText: retryText
      };
    }

    // Generate unique serial number (e.g. HST-001, SFT-002, IAT-003, PMT-004, OTH-005)
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
