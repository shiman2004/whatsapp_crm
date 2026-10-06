/**
 * Royal Wellness Center — WhatsApp Concierge Auto-Reply & Intake Funnel Engine
 * 
 * Flow:
 * 1. New Inbound Message -> Welcome & Multi-Language Menu (EN, SI, TA)
 * 2. Language Selection -> Multilingual Treatment Category Menu (Hair, Skin, IV, Weight, Dental)
 * 3. Treatment Selection -> Clinical Confirmation & Handoff Message
 * 4. Lead Updated -> Category tagged, Language set, Stage: 'new' (Ready for Super Admin Coordinator Assignment)
 */

import { getPrisma, getDbStatus } from './db.js';

// In-memory conversation state cache (Phone -> State)
// State structure: { stage: 'AWAITING_LANGUAGE' | 'AWAITING_TREATMENT' | 'COMPLETED' | 'PAUSED', lastUpdated: Date, selectedLang?: 'en' | 'si' | 'ta', selectedCategory?: string }
const autoReplySessions = new Map();

// Category Mapping for choices 1 to 5
const TREATMENT_OPTIONS = [
  {
    num: '1',
    id: 'cat-hair-care',
    nameEn: 'Hair Care & PRP Restoration',
    nameSi: 'හිසකෙස් ප්‍රතිකාර සහ යථා තත්ත්වයට පත්කිරීම',
    nameTa: 'முடி பராமரிப்பு மற்றும் சீரமைப்பு',
    defaultTreatmentId: 'trt-hair-prp'
  },
  {
    num: '2',
    id: 'cat-skin-care',
    nameEn: 'Aesthetic Skin Care & Laser',
    nameSi: 'සම රැකවරණ සහ ලේසර් ප්‍රතිකාර',
    nameTa: 'அழகியல் தோல் பராமரிப்பு மற்றும் லேசர்',
    defaultTreatmentId: 'trt-skin-hydra'
  },
  {
    num: '3',
    id: 'cat-iv-wellness',
    nameEn: 'IV Drip Therapy & Wellness Blends',
    nameSi: 'IV විටමින් ප්‍රතිකාර සහ සුවතා සත්කාර',
    nameTa: 'IV டிரிப் மற்றும் ஆரோக்கிய சிகிச்சை',
    defaultTreatmentId: 'trt-iv-glow'
  },
  {
    num: '4',
    id: 'cat-weight-management',
    nameEn: 'Weight Management & Body Contouring',
    nameSi: 'බර පාලනය සහ ශරීර හැඩගැස්වීම',
    nameTa: 'உடல் எடை மேலாண்மை மற்றும் வடிவம்',
    defaultTreatmentId: 'trt-weight-sculpt'
  },
  {
    num: '5',
    id: 'cat-dental-aesthetics',
    nameEn: 'Dental Aesthetics & Smile Design',
    nameSi: 'දන්ත සෞන්දර්ය ප්‍රතිකාර',
    nameTa: 'பல் அழகியல் மற்றும் புன்னகை வடிவமைப்பு',
    defaultTreatmentId: 'trt-dental-smile'
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
    return `✨ *ස්තූතියි!* ඔබ උනන්දුවක් දක්වන ප්‍රතිකාර අංශය තෝරන්න:

1️⃣ 💇 *හිසකෙස් ප්‍රතිකාර සහ යථා තත්ත්වයට පත්කිරීම* (PRP, GFC)
2️⃣ 🌸 *සම රැකවරණ සහ ලේසර් ප්‍රතිකාර* (Laser, HydraFacial)
3️⃣ ⚡ *IV විටමින් ප්‍රතිකාර සහ සුවතා සත්කාර*
4️⃣ 🏃 *බර පාලනය සහ ශරීර හැඩගැස්වීම*
5️⃣ 🦷 *දන්ත සෞන්දර්ය සහ සිනහ නිර්මාණය*

_කරුණාකර අංකය (1 - 5) එවන්න_`;
  }

  if (lang === 'ta') {
    return `✨ *நன்றி!* நீங்கள் விரும்பும் மருத்துவ சிகிச்சை பிரிவைத் தேர்ந்தெடுக்கவும்:

1️⃣ 💇 *முடி பராமரிப்பு மற்றும் சீரமைப்பு* (PRP, GFC)
2️⃣ 🌸 *அழகியல் தோல் பராமரிப்பு மற்றும் லேசர்*
3️⃣ ⚡ *IV டிரிப் மற்றும் ஆரோக்கிய சிகிச்சை*
4️⃣ 🏃 *உடல் எடை மேலாண்மை மற்றும் வடிவம்*
5️⃣ 🦷 *பல் அழகியல் மற்றும் புன்னகை வடிவமைப்பு*

_தயவுசெய்து எண்ணை (1 - 5) அனுப்பவும்_`;
  }

  // Default: English
  return `✨ *Thank you!* Which specialized clinical department can we assist you with today?

1️⃣ 💇 *Hair Care & Restoration* (PRP, GFC, Transplant)
2️⃣ 🌸 *Aesthetic Skin Care* (Laser, Pigmentation, Clinical Facials)
3️⃣ ⚡ *IV Drip Therapy & Wellness* (Immunity, Cellular Glow)
4️⃣ 🏃 *Weight Management & Body Contouring*
5️⃣ 🦷 *Dental Aesthetics & Smile Design*

_Reply with the number of your choice (e.g. 1)_`;
};

// Step 3: Final Confirmation & Clinical Handoff Message
export const getFinalHandoffMessage = (lang = 'en', treatmentName = 'Selected Treatment') => {
  if (lang === 'si') {
    return `🩺 *ඔබේ විමසීම සාර්ථකව ලැබිණි!*
ඔබ තෝරාගත් *${treatmentName}* සම්බන්ධයෙන් වැඩිදුර තොරතුරු ලබාදීමට අපගේ විශේෂඥ සම්බන්ධීකාරකවරයෙකු ඉතා ඉක්මනින් මෙම අංකයෙන් ඔබව සම්බන්ධ කරගනු ඇත.

_Royal Wellness Center — Premier Aesthetic & Clinical Care_ 🌿`;
  }

  if (lang === 'ta') {
    return `🩺 *உங்கள் தகவல் வெற்றிகரமாக பெறப்பட்டது!*
நீங்கள் தேர்ந்தெடுத்த *${treatmentName}* சிகிச்சைக்காக, எங்கள் மருத்துவ ஒருங்கிணைப்பாளர் விரைவில் இந்த எண்ணில் உங்களைத் தொடர்புகொள்வார்.

_Royal Wellness Center — Premier Aesthetic & Clinical Care_ 🌿`;
  }

  return `🩺 *Inquiry Received!*
Thank you for your interest in *${treatmentName}*.

Our team has registered your inquiry, and a dedicated clinical coordinator will contact you shortly on this WhatsApp chat.

_Royal Wellness Center — Premier Aesthetic & Clinical Care_ 🌿`;
};

/**
 * Parses user message for language selection
 */
function parseLanguageChoice(text = '') {
  const clean = text.trim().toLowerCase();
  if (clean === '1' || clean === 'english' || clean === 'eng' || clean === 'en') return 'en';
  if (clean === '2' || clean === 'sinhala' || clean === 'sin' || clean === 'si' || clean.includes('සිංහල')) return 'si';
  if (clean === '3' || clean === 'tamil' || clean === 'tam' || clean === 'ta' || clean.includes('தமிழ்')) return 'ta';
  return null;
}

/**
 * Parses user message for treatment selection (1-5 or keywords)
 */
function parseTreatmentChoice(text = '') {
  const clean = text.trim().toLowerCase();
  
  // Direct numbers
  const directMatch = TREATMENT_OPTIONS.find(t => t.num === clean);
  if (directMatch) return directMatch;

  // Keyword searches
  if (clean.includes('hair') || clean.includes('prp') || clean.includes('gfc') || clean.includes('හිසකෙස්') || clean.includes('முடி')) {
    return TREATMENT_OPTIONS[0];
  }
  if (clean.includes('skin') || clean.includes('laser') || clean.includes('facial') || clean.includes('සම') || clean.includes('தோல்')) {
    return TREATMENT_OPTIONS[1];
  }
  if (clean.includes('iv') || clean.includes('drip') || clean.includes('wellness') || clean.includes('විටමින්') || clean.includes('டிரிப்')) {
    return TREATMENT_OPTIONS[2];
  }
  if (clean.includes('weight') || clean.includes('fat') || clean.includes('sculpt') || clean.includes('බර') || clean.includes('எடை')) {
    return TREATMENT_OPTIONS[3];
  }
  if (clean.includes('dental') || clean.includes('teeth') || clean.includes('smile') || clean.includes('දන්ත') || clean.includes('பல்')) {
    return TREATMENT_OPTIONS[4];
  }

  return null;
}

/**
 * Pauses auto-reply for a customer (e.g. when staff/coordinator sends a manual reply)
 */
export const pauseAutoReply = (phone) => {
  if (!phone) return;
  const digits = phone.replace(/[^0-9]/g, '');
  autoReplySessions.set(digits, { stage: 'PAUSED', lastUpdated: new Date() });
  console.log(`🤖 [AUTO-REPLY] Bot paused for ${digits} (Staff active).`);
};

/**
 * Main Auto-Reply Decision Engine
 * Evaluates inbound message and returns the next automated reply (if any), along with database updates.
 * 
 * @param {Object} params
 * @param {string} params.senderPhone - Clean phone digits (e.g. "94771234567")
 * @param {string} params.messageText - Inbound text
 * @param {Object} params.customer - Database Customer object
 * @param {Object} params.lead - Database Lead object
 * @returns {Promise<{ shouldReply: boolean, replyText?: string, updatedLead?: Object, updatedCustomer?: Object }>}
 */
export async function evaluateAutoReply({ senderPhone, messageText, customer, lead }) {
  if (!senderPhone || !messageText) {
    return { shouldReply: false };
  }

  const cleanPhone = senderPhone.replace(/[^0-9]/g, '');
  const session = autoReplySessions.get(cleanPhone) || { stage: 'IDLE', lastUpdated: new Date() };

  // If chat is actively assigned or handled by a coordinator, don't interrupt human conversations
  if (session.stage === 'PAUSED' || (lead && lead.assignedTo)) {
    return { shouldReply: false };
  }

  // If conversation was already completed recently (> 24 hours ago resets), stay silent
  if (session.stage === 'COMPLETED') {
    const hoursSinceLast = (new Date() - new Date(session.lastUpdated)) / (1000 * 60 * 60);
    if (hoursSinceLast < 24) {
      return { shouldReply: false };
    }
  }

  const prisma = getPrisma();

  // ----------------------------------------------------
  // STEP 1: INITIAL CONTACT -> Send Welcome & Language Menu
  // ----------------------------------------------------
  if (session.stage === 'IDLE') {
    // Check if this is a brand new lead or existing completed lead
    autoReplySessions.set(cleanPhone, {
      stage: 'AWAITING_LANGUAGE',
      lastUpdated: new Date()
    });

    console.log(`🤖 [AUTO-REPLY STEP 1] Sending Welcome & Language Menu to ${cleanPhone}`);
    return {
      shouldReply: true,
      replyText: WELCOME_LANGUAGE_MESSAGE
    };
  }

  // ----------------------------------------------------
  // STEP 2: AWAITING LANGUAGE -> Send Treatment Menu
  // ----------------------------------------------------
  if (session.stage === 'AWAITING_LANGUAGE') {
    const selectedLang = parseLanguageChoice(messageText);

    if (!selectedLang) {
      // Prompt user politely to pick 1, 2, or 3
      return {
        shouldReply: true,
        replyText: `Please reply with a valid number (1, 2, or 3) to choose your language:\n\n1️⃣ English\n2️⃣ සිංහල\n3️⃣ தமிழ்`
      };
    }

    // Advance to AWAITING_TREATMENT
    autoReplySessions.set(cleanPhone, {
      stage: 'AWAITING_TREATMENT',
      selectedLang,
      lastUpdated: new Date()
    });

    // Update customer preferred language in Supabase
    if (prisma && getDbStatus() && customer?.id) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { preferredLanguage: selectedLang }
      }).catch(err => console.warn('Could not update customer language:', err.message));
    }

    const treatmentMenu = getTreatmentMenuMessage(selectedLang);
    console.log(`🤖 [AUTO-REPLY STEP 2] Language selected: ${selectedLang}. Sending Treatment Menu to ${cleanPhone}`);
    
    return {
      shouldReply: true,
      replyText: treatmentMenu
    };
  }

  // ----------------------------------------------------
  // STEP 3: AWAITING TREATMENT -> Confirm & Hand Off to Coordinator
  // ----------------------------------------------------
  if (session.stage === 'AWAITING_TREATMENT') {
    const chosenTreatment = parseTreatmentChoice(messageText);
    const userLang = session.selectedLang || 'en';

    if (!chosenTreatment) {
      // Prompt user politely to choose 1 - 5
      const retryText = userLang === 'si'
        ? `කරුණාකර ප්‍රතිකාර අංකය (1 - 5) තෝරන්න.`
        : userLang === 'ta'
        ? `தயவுசெய்து சிகிச்சை எண்ணை (1 - 5) தேர்ந்தெடுக்கவும்.`
        : `Please reply with the treatment number (1 - 5) of your choice.`;

      return {
        shouldReply: true,
        replyText: retryText
      };
    }

    // Mark intake session as COMPLETED (Bot turns off, awaiting Super Admin coordinator assignment)
    autoReplySessions.set(cleanPhone, {
      stage: 'COMPLETED',
      selectedLang: userLang,
      selectedCategory: chosenTreatment.id,
      lastUpdated: new Date()
    });

    const treatmentDisplayName = userLang === 'si' 
      ? chosenTreatment.nameSi 
      : userLang === 'ta' 
      ? chosenTreatment.nameTa 
      : chosenTreatment.nameEn;

    const finalHandoff = getFinalHandoffMessage(userLang, treatmentDisplayName);

    // Update Lead in Supabase with chosen category & treatment
    if (prisma && getDbStatus() && lead?.id) {
      try {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            categoryId: chosenTreatment.id,
            treatmentId: chosenTreatment.defaultTreatmentId,
            language: userLang,
            stage: 'new', // Super Admin will assign coordinator from 'new'
            updatedAt: new Date()
          }
        });
        console.log(`✅ [CRM AUTO-INTAKE] Lead ${lead.id} successfully updated with Category [${chosenTreatment.id}] and Language [${userLang}].`);
      } catch (err) {
        console.warn('Could not update lead category:', err.message);
      }
    }

    console.log(`🤖 [AUTO-REPLY STEP 3] Funnel Completed for ${cleanPhone}. Assigned to Category: ${chosenTreatment.id}`);

    return {
      shouldReply: true,
      replyText: finalHandoff
    };
  }

  return { shouldReply: false };
}
