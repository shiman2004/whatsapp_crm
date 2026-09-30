import { TreatmentCategory, Treatment, Lead, Message } from '../types';

export interface IntentDetectionResult {
  categoryId: string;
  treatmentId?: string;
  confidence: number;
  detectedLanguage: 'en' | 'si' | 'ta';
  summary: string;
}

export interface AiSummaryResult {
  summary: string;
  keyConcerns: string[];
  patientIntent: string;
  recommendedNextStep: string;
  clinicalSafetyAlert?: string;
}

export const aiService = {
  // Free-text intent classifier
  detectIntent(text: string, categories: TreatmentCategory[], treatments: Treatment[]): IntentDetectionResult {
    const lower = text.toLowerCase();
    
    // Sinhala check
    const isSinhala = /[\u0D80-\u0DFF]/.test(text);
    // Tamil check
    const isTamil = /[\u0B80-\u0BFF]/.test(text);
    const lang: 'en' | 'si' | 'ta' = isSinhala ? 'si' : isTamil ? 'ta' : 'en';

    if (lower.includes('hair') || lower.includes('හිසකෙස්') || lower.includes('තට්ටය') || lower.includes('முடி') || lower.includes('prp') || lower.includes('transplant') || lower.includes('bald')) {
      const hairCat = categories.find(c => c.id === 'cat-hair-care');
      const fue = treatments.find(t => t.id === 'trt-fue-transplant');
      const prp = treatments.find(t => t.id === 'trt-prp-hair');
      const trt = (lower.includes('transplant') || lower.includes('බද්ධ')) ? fue : prp;
      
      return {
        categoryId: hairCat ? hairCat.id : 'cat-hair-care',
        treatmentId: trt?.id,
        confidence: 0.94,
        detectedLanguage: lang,
        summary: 'Detected Hair Restoration intent (PRP / FUE Consultation)',
      };
    }

    if (lower.includes('skin') || lower.includes('facial') || lower.includes('හයිඩ්‍රාෆේෂල්') || lower.includes('සම') || lower.includes('தோல்') || lower.includes('acne') || lower.includes('කුරුලෑ') || lower.includes('glow')) {
      const skinCat = categories.find(c => c.id === 'cat-skin-care');
      const hydra = treatments.find(t => t.id === 'trt-hydrafacial');
      return {
        categoryId: skinCat ? skinCat.id : 'cat-skin-care',
        treatmentId: hydra?.id,
        confidence: 0.91,
        detectedLanguage: lang,
        summary: 'Detected Skin Rejuvenation intent (HydraFacial / Acne Therapy)',
      };
    }

    if (lower.includes('laser') || lower.includes('ලේසර්') || lower.includes('ලේසර්') || lower.includes('ලේසර්') || lower.includes('ලේසර්') || lower.includes('லேசர்') || lower.includes('hair removal') || lower.includes('රෝම')) {
      const laserCat = categories.find(c => c.id === 'cat-laser');
      const laserTrt = treatments.find(t => t.id === 'trt-laser-hair');
      return {
        categoryId: laserCat ? laserCat.id : 'cat-laser',
        treatmentId: laserTrt?.id,
        confidence: 0.96,
        detectedLanguage: lang,
        summary: 'Detected Laser Dermatology intent (Laser Hair Reduction)',
      };
    }

    if (lower.includes('botox') || lower.includes('filler') || lower.includes('බොටොක්ස්') || lower.includes('wrinkle') || lower.includes('රැලි') || lower.includes('போடாக்ஸ்') || lower.includes('lip')) {
      const injectCat = categories.find(c => c.id === 'cat-injectable');
      const botoxTrt = treatments.find(t => t.id === 'trt-botox');
      return {
        categoryId: injectCat ? injectCat.id : 'cat-injectable',
        treatmentId: botoxTrt?.id,
        confidence: 0.89,
        detectedLanguage: lang,
        summary: 'Detected Non-invasive Injectables intent (Botox / Dermal Fillers)',
      };
    }

    if (lower.includes('nose') || lower.includes('rhino') || lower.includes('ප්ලාස්ටික්') || lower.includes('surgery') || lower.includes('සැත්කම්') || lower.includes('அறுவை')) {
      const plasticCat = categories.find(c => c.id === 'cat-plastic-surgery');
      const rhinoTrt = treatments.find(t => t.id === 'trt-rhinoplasty');
      return {
        categoryId: plasticCat ? plasticCat.id : 'cat-plastic-surgery',
        treatmentId: rhinoTrt?.id,
        confidence: 0.92,
        detectedLanguage: lang,
        summary: 'Detected Aesthetic Plastic Surgery intent (Rhinoplasty / Body Contouring)',
      };
    }

    // Default fallback
    return {
      categoryId: categories[0]?.id || 'cat-hair-care',
      treatmentId: treatments[0]?.id,
      confidence: 0.65,
      detectedLanguage: lang,
      summary: 'General wellness consultation inquiry',
    };
  },

  // AI Response Suggestions (never auto-sent without human approval)
  generateSuggestions(lead: Lead, messages: Message[], category?: TreatmentCategory, treatment?: Treatment): string[] {
    const lang = lead.language || 'en';
    const clientName = lead.customer?.displayName || 'Client';
    const trtName = treatment?.name || category?.name || 'Treatment';

    if (lang === 'si') {
      return [
        `ආයුබෝවන් ${clientName}, ${trtName} සඳහා අපගේ විශේෂඥ වෛද්‍යවරුන් සමග සාකච්ඡා කිරීමට මෙම සතියේ බ්‍රහස්පතින්දා හෝ සෙනසුරාදා ඔබට පහසු වේලාවක් තිබේද?`,
        `ස්තූතියි ${clientName}. අපගේ ${trtName} පැකේජය පිළිබඳ සම්පූර්ණ විස්තර පත්‍රිකාව සහ මිල ගණන් මම ඔබට WhatsApp මගින් එවන්නද?`,
        `අපගේ සායනය කොළඹ 07, හෝටන් පෙදෙසෙහි පිහිටා ඇත. ඔබට නොමිලේ මූලික උපදේශනයක් වෙන් කර ගැනීමට කැමතිද?`
      ];
    }

    if (lang === 'ta') {
      return [
        `வணக்கம் ${clientName}, ${trtName} சிகிச்சைக்கான சிறப்பு மருத்துவர் ஆலோசனைக்கு இந்த வாரம் சனிக்கிழமை உங்களுக்கு வசதியான நேரத்தை பதிவு செய்யலாமா?`,
        `நன்றி ${clientName}. ${trtName} சிகிச்சை பற்றிய முழு விவரங்கள் மற்றும் கட்டண விபரங்களை உங்களுக்கு அனுப்பவா?`,
        `எங்கள் கிளினிக் கொழும்பு 07 இல் அமைந்துள்ளது. நீங்கள் நேரடி ஆலோசனைக்கு வர விரும்புகிறீர்களா?`
      ];
    }

    // English suggestions
    return [
      `Hi ${clientName}, thanks for reaching out regarding ${trtName}. Our board-certified specialists are available for consultation this Friday and Saturday. Would morning or afternoon suit you better?`,
      `Hello ${clientName}! For ${trtName}, we offer personalized clinical assessments with complimentary follicle/skin digital imaging. Shall I reserve a slot for you?`,
      `Thank you ${clientName}. I would be delighted to share our comprehensive ${trtName} brochure along with package pricing. Should I send it over WhatsApp?`
    ];
  },

  // Conversation Summarizer for Handover
  summarizeConversation(lead: Lead, messages: Message[], category?: TreatmentCategory, treatment?: Treatment): AiSummaryResult {
    const trtName = treatment?.name || category?.name || 'Wellness Procedure';
    const clientName = lead.customer?.displayName || 'Client';
    const msgCount = messages.length;

    const hasPricingInquiry = messages.some(m => /price|cost|lkr|ගණන්|මිල|கட்டணம்/i.test(m.content));
    const hasBookingIntent = messages.some(m => /book|slot|appointment|friday|saturday|ඇපොයින්ට්මන්ට්|நேரம்/i.test(m.content));

    const keyConcerns = [
      `Inquiring about ${trtName} at Royal Wellness Center`,
      hasPricingInquiry ? 'Requested package pricing and session duration' : 'Discussing protocol & eligibility',
      hasBookingIntent ? 'Ready for weekend consultation reservation' : 'Evaluating treatment timelines'
    ];

    return {
      summary: `${clientName} contacted via WhatsApp inquiring about ${trtName}. Exchanged ${msgCount} messages. Client demonstrated strong interest in procedure outcomes and consultant availability.`,
      keyConcerns,
      patientIntent: hasBookingIntent ? 'High Booking Intent (Hot Lead)' : 'Information Gathering (Warm Lead)',
      recommendedNextStep: 'Offer Saturday consultation slot with Consultant Specialist; send PDF brochure.',
      clinicalSafetyAlert: 'AI Safety Guardrail: Final medical suitability and dosage must be evaluated in-person by certified Royal Wellness physicians. No remote prescription provided.'
    };
  },

  // Real-time Translator
  translate(text: string, targetLang: 'en' | 'si' | 'ta'): string {
    // Demo dictionary / semantic rule translator for realistic presentation
    const clean = text.trim();
    if (targetLang === 'en') {
      if (clean.includes('හයිඩ්‍රාෆේෂල්')) return 'HydraFacial package inquiry. What is the pricing?';
      if (clean.includes('හිසකෙස්')) return 'Inquiring regarding hair thinning and PRP treatment.';
      if (clean.includes('ඇපොයින්ට්මන්ට්')) return 'Can I book an appointment for Saturday around 3 PM?';
      if (clean.includes('ලේසර්')) return 'Hello, I would like to receive details on laser hair reduction.';
      if (clean.includes('ආයුබෝවන්')) return `Greetings from Royal Wellness Center. How may we assist you today?`;
      return `[Translated to English]: "${clean}"`;
    }

    if (targetLang === 'si') {
      if (clean.includes('HydraFacial')) return 'හයිඩ්‍රාෆේෂල් ප්‍රතිකාරය සහ පැකේජ පිළිබඳ විමසීමකි.';
      if (clean.includes('PRP') || clean.includes('hair')) return 'හිසකෙස් ප්‍රතිකාර සහ PRP පිළිබඳ විස්තර විමසයි.';
      if (clean.includes('appointment')) return 'සෙනසුරාදා දින වෛද්‍ය හමුවක් වෙන්කරවා ගැනීම පිළිබඳව.';
      return `[සිංහලට පරිවර්තනය]: "${clean}"`;
    }

    if (targetLang === 'ta') {
      return `[தமிழுக்கு மொழிபெயர்ப்பு]: "${clean}"`;
    }

    return clean;
  }
};
