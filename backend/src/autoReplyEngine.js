/**
 * Royal Wellness Center — WhatsApp Concierge Auto-Reply Engine
 * 
 * Rules:
 * - Sends ONLY ONE TRILINGUAL GREETING MESSAGE upon receiving an inquiry from a customer.
 * - All other multi-step menus, language prompts, and treatment options have been removed.
 * - Sends strictly ONCE per customer (completes intake greeting and ceases automatically so human coordinators can converse freely).
 */

import { getPrisma, getDbStatus } from './db.js';

// In-memory conversation state cache (Phone -> State)
// State structure: { stage: 'COMPLETED', lastUpdated: Date }
const autoReplySessions = new Map();

// The Single Trilingual Greeting Message (English, Sinhala, Tamil)
export const TRILINGUAL_GREETING_MESSAGE = 
`✨ *Welcome to Royal Wellness Center!*

We are delighted to assist you with our medical and aesthetic treatments. Our clinical coordinator will contact you shortly to assist you further.

Thank you for choosing Royal Wellness Center! 💙

━━━━━━━━━━━━━━

✨ *Royal Wellness Center වෙත සාදරයෙන් පිළිගනිමු!*

අපගේ වෛද්ය සහ රූපලාවණ්ය ප්රතිකාර සේවා පිළිබඳව ඔබට සහාය වීමට අපි සතුටු වෙමු. ඔබට වැඩිදුර සහාය ලබා දීම සඳහා අපගේ සායනික සම්බන්ධීකාරකවරයා ඉක්මනින් ඔබව සම්බන්ධ කරගනු ඇත.

Royal Wellness Center තෝරාගැනීම පිළිබඳව ඔබට ස්තුතියි! 💙

━━━━━━━━━━━━━━

✨ *Royal Wellness Center-க்கு உங்களை அன்புடன் வரவேற்கிறோம்!*

எங்களின் மருத்துவ மற்றும் அழகியல் சிகிச்சைகள் தொடர்பாக உங்களுக்கு உதவுவதில் மகிழ்ச்சியடைகிறோம். மேலதிக உதவிகளை வழங்க எங்கள் மருத்துவ ஒருங்கிணைப்பாளர் விரைவில் உங்களைத் தொடர்புகொள்வார்.

Royal Wellness Center-ஐத் தேர்ந்தெடுத்ததற்கு நன்றி! 💙`;

// The Single English Greeting Message for College of Royal Aesthetic of Sri Lanka (CRAS)
export const CRAS_GREETING_MESSAGE = 
`✨ *Welcome to College of Royal Aesthetic of Sri Lanka (CRAS)!*

We are delighted to assist you with our clinical aesthetic medicine and dermatology training programs. Our academic coordinator will contact you shortly to assist you further.

Thank you for choosing College of Royal Aesthetic of Sri Lanka! 🎓`;

// Compatibility export
export const CRAS_TRILINGUAL_GREETING_MESSAGE = CRAS_GREETING_MESSAGE;

// Compatibility exports
export const WELCOME_LANGUAGE_MESSAGE = TRILINGUAL_GREETING_MESSAGE;
export const getTreatmentMenuMessage = () => TRILINGUAL_GREETING_MESSAGE;
export const getFinalHandoffMessage = () => TRILINGUAL_GREETING_MESSAGE;
export const CLINICAL_TREATMENTS = [];

/**
 * Pauses auto-reply for a customer (e.g. when staff/coordinator sends a manual reply)
 */
export const pauseAutoReply = (phone) => {
  if (!phone) return;
  const digits = phone.replace(/[^0-9]/g, '');
  autoReplySessions.set(digits, { stage: 'COMPLETED', lastUpdated: new Date() });
  console.log(`🤖 [AUTO-REPLY] Bot stopped for ${digits} (Staff active).`);
};

/**
 * Resets all auto-reply sessions
 */
export const clearAutoReplySessions = () => {
  autoReplySessions.clear();
  console.log('🤖 [AUTO-REPLY] All auto-reply sessions reset.');
};

/**
 * Main Auto-Reply Decision Engine
 * Evaluates inbound message and sends strictly ONE trilingual greeting message per customer.
 * 
 * @param {Object} params
 * @param {string} params.senderPhone - Clean phone digits (e.g. "94771234567")
 * @param {string} params.messageText - Inbound text
 * @param {Object} params.customer - Database Customer object
 * @param {Object} params.lead - Database Lead object
 * @returns {Promise<{ shouldReply: boolean, replyText?: string }>}
 */
export async function evaluateAutoReply({ senderPhone, messageText, customer, lead, company }) {
  if (!senderPhone || !messageText) {
    return { shouldReply: false };
  }

  const cleanPhone = senderPhone.replace(/[^0-9]/g, '');
  let session = autoReplySessions.get(cleanPhone);

  // 1. ONE-TIME RULE: If customer has already received the greeting, do not re-send
  if (session && session.stage === 'COMPLETED') {
    return { shouldReply: false };
  }

  // 2. Check DB state: If lead already has an assigned coordinator or has been processed, do not auto-reply
  if (lead) {
    if (lead.assignedTo && lead.assignedTo.trim().length > 0) {
      autoReplySessions.set(cleanPhone, { stage: 'COMPLETED', lastUpdated: new Date() });
      return { shouldReply: false };
    }
    if (lead.stage && ['contacted', 'potential', 'under_discussion', 'converted', 'lost'].includes(lead.stage)) {
      autoReplySessions.set(cleanPhone, { stage: 'COMPLETED', lastUpdated: new Date() });
      return { shouldReply: false };
    }
  }

  // 3. Mark session as COMPLETED immediately so subsequent customer messages are not auto-replied
  autoReplySessions.set(cleanPhone, {
    stage: 'COMPLETED',
    lastUpdated: new Date()
  });

  const isCras = company === 'CRAS' || lead?.source === 'CRAS' || lead?.whatsappSessionId === 'CRAS';
  const greeting = isCras ? CRAS_TRILINGUAL_GREETING_MESSAGE : TRILINGUAL_GREETING_MESSAGE;

  console.log(`🤖 [AUTO-REPLY] Sending Single ${isCras ? 'English' : 'Trilingual'} Greeting for ${isCras ? 'CRAS' : 'RWC'} to ${cleanPhone} (Inbound: "${messageText}")`);

  return {
    shouldReply: true,
    replyText: greeting
  };
}
