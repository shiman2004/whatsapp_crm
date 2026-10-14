/**
 * Tamil & Sinhala Phonetic Transliteration Engine
 * 
 * Supports real-time English-keyboard typing to Tamil and Sinhala Unicode text
 * with hybrid syllabic transliteration + colloquial/clinical vocabulary mapping.
 */

export type TypingLanguage = 'en' | 'ta' | 'si';

// ==========================================
// TAMIL DICTIONARY & PHONETIC RULES
// ==========================================

const TAMIL_WORD_DICT: Record<string, string> = {
  // Greetings & Core Courtesy
  'vanakkam': 'வணக்கம்',
  'vannakkam': 'வணக்கம்',
  'nandri': 'நன்றி',
  'nanri': 'நன்றி',
  'migavum': 'மிகவும்',
  'romba': 'ரொம்ப',
  'sari': 'சரி',
  'aam': 'ஆம்',
  'aama': 'ஆமாம்',
  'illai': 'இல்லை',
  'illa': 'இல்லை',

  // Pronouns & Questions
  'neenga': 'நீங்க',
  'neengal': 'நீங்கள்',
  'naan': 'நான்',
  'naanga': 'நாங்க',
  'naangal': 'நாங்கள்',
  'ungalukku': 'உங்களுக்கு',
  'ungala': 'உங்களை',
  'unakku': 'உனக்கு',
  'enakku': 'எனக்கு',
  'eppadi': 'எப்படி',
  'yeppadi': 'எப்படி',
  'enna': 'என்ன',
  'ethu': 'எது',
  'yaar': 'யார்',
  'enge': 'எங்கே',
  'engu': 'எங்கு',
  'eppothu': 'எப்பொழுது',
  'eppodhu': 'எப்போது',
  'etharkku': 'எதற்கு',

  // Common Verbs & Expressions
  'irukkinga': 'இருக்கீங்க',
  'irukkireergal': 'இருக்கிறீர்கள்',
  'irukkindreergal': 'இருக்கின்றீர்கள்',
  'irukku': 'இருக்கு',
  'irukkum': 'இருக்கும்',
  'irukkirom': 'இருக்கிறோம்',
  'vendum': 'வேண்டும்',
  'venum': 'வேணும்',
  'uthavi': 'உதவி',
  'udhavi': 'உதவி',
  'pesalam': 'பேசலாம்',
  'pesavum': 'பேசவும்',
  'thodarpu': 'தொடர்பு',
  'kollavum': 'கொள்ளவும்',
  'varavum': 'வரவும்',
  'tharuveergala': 'தருவீர்களா',

  // Clinic & Medical Context
  'appointment': 'அப்பாய்ண்ட்மென்ட்',
  'consultation': 'கன்சல்டேஷன்',
  'treatment': 'சிகிச்சை',
  'sikichai': 'சிகிச்சை',
  'doctor': 'டாக்டர்',
  'maruthuvar': 'மருத்துவர்',
  'neram': 'நேரம்',
  'naal': 'நாள்',
  'kaalai': 'காலை',
  'maalai': 'மாலை',
  'ippothu': 'இப்போது',
  'ippo': 'இப்போ',
  'thagaval': 'தகவல்',
  'thaval': 'தகவல்',
  'aluvallagam': 'அலுவலகம்',
  'clinic': 'கிளினிக்',
  'hospital': 'மருத்துவமனை',
  'maruthuvamanai': 'மருத்துவமனை',
};

// Vowels
const TAMIL_INDEPENDENT_VOWELS: [string, string][] = [
  ['aae', 'ஏ'], ['aai', 'ஐ'], ['ae', 'ஏ'], ['ai', 'ஐ'],
  ['aa', 'ஆ'], ['au', 'ஔ'], ['ou', 'ஔ'], ['ee', 'ஈ'],
  ['ii', 'ஈ'], ['oo', 'ஊ'], ['uu', 'ஊ'], ['oa', 'ஓ'],
  ['a', 'அ'], ['i', 'இ'], ['u', 'உ'], ['e', 'எ'], ['o', 'ஒ']
];

const TAMIL_DEPENDENT_VOWELS: Record<string, string> = {
  'aa': 'ா', 'a': '',
  'ii': 'ீ', 'ee': 'ீ', 'i': 'ி',
  'uu': 'ூ', 'oo': 'ூ', 'u': 'ு',
  'ae': 'ே', 'e': 'ெ',
  'ai': 'ை',
  'oa': 'ோ', 'o': 'ொ',
  'au': 'ௌ', 'ou': 'ௌ'
};

// Base consonants without virama
const TAMIL_CONSONANTS: [string, string][] = [
  ['sri', 'ஸ்ரீ'], ['shree', 'ஸ்ரீ'],
  ['ng', 'ங'], ['nj', 'ஞ'], ['gn', 'ஞ'],
  ['th', 'த'], ['dh', 'த'], ['ch', 'ச'], ['sh', 'ஷ'],
  ['zh', 'ழ'], ['zhh', 'ழ'],
  ['k', 'க'], ['g', 'க'], ['c', 'ச'], ['j', 'ஜ'],
  ['t', 'ட'], ['d', 'ட'], ['T', 'ட'],
  ['N', 'ண'], ['n', 'ந'],
  ['p', 'ப'], ['b', 'ப'], ['m', 'ம'],
  ['y', 'ய'], ['r', 'ர'], ['R', 'ற'],
  ['l', 'ல'], ['L', 'ள'], ['v', 'வ'], ['w', 'வ'],
  ['s', 'ஸ'], ['h', 'ஹ']
];

const TAMIL_VIRAMA = '\u0BCD'; // ்

/**
 * Phonetically transliterate a single Romanized Tamil word into Tamil Unicode
 */
export function transliterateTamilWord(rawWord: string): string {
  if (!rawWord) return '';

  const cleanWord = rawWord.toLowerCase();

  // 1. Direct dictionary match
  if (TAMIL_WORD_DICT[cleanWord]) {
    return TAMIL_WORD_DICT[cleanWord];
  }

  // 2. Multi-syllable rule engine
  let result = '';
  let i = 0;
  const len = rawWord.length;

  while (i < len) {
    // Check for independent vowel if at start or after a completed syllable
    let matchedVowel = false;
    if (i === 0 || result.endsWith(' ') || result === '') {
      for (const [vKey, vChar] of TAMIL_INDEPENDENT_VOWELS) {
        if (cleanWord.substring(i).startsWith(vKey)) {
          result += vChar;
          i += vKey.length;
          matchedVowel = true;
          break;
        }
      }
      if (matchedVowel) continue;
    }

    // Try to match consonant
    let matchedConsonant: [string, string] | null = null;
    for (const [cKey, cChar] of TAMIL_CONSONANTS) {
      if (cleanWord.substring(i).startsWith(cKey)) {
        matchedConsonant = [cKey, cChar];
        break;
      }
    }

    if (matchedConsonant) {
      const [cKey, baseConsonant] = matchedConsonant;
      let cChar = baseConsonant;

      // Special contextual rules for 'n':
      // 'n' at end of word or before 'r'/'d' is often ன் (\u0BA9) instead of ந (\u0BA8)
      if (cKey === 'n') {
        if (i > 0 && (i + 1 >= len || cleanWord[i + 1] === 'r' || cleanWord[i + 1] === 't' || cleanWord[i + 1] === 'd')) {
          cChar = 'ன';
        }
      }

      i += cKey.length;

      // Check if followed by vowel
      let matchedDepVowel: [string, string] | null = null;
      for (const vKey of Object.keys(TAMIL_DEPENDENT_VOWELS)) {
        if (cleanWord.substring(i).startsWith(vKey)) {
          matchedDepVowel = [vKey, TAMIL_DEPENDENT_VOWELS[vKey]];
          break;
        }
      }

      if (matchedDepVowel) {
        const [vKey, vSign] = matchedDepVowel;
        result += cChar + vSign;
        i += vKey.length;
      } else {
        // Pure consonant with virama (pulli)
        result += cChar + TAMIL_VIRAMA;
      }
    } else {
      // Check for standalone vowel inside word (e.g., hiatus)
      let foundMidVowel = false;
      for (const [vKey, vChar] of TAMIL_INDEPENDENT_VOWELS) {
        if (cleanWord.substring(i).startsWith(vKey)) {
          result += vChar;
          i += vKey.length;
          foundMidVowel = true;
          break;
        }
      }

      if (!foundMidVowel) {
        // Fallback: copy non-alphabetic character
        result += rawWord[i];
        i++;
      }
    }
  }

  return result;
}


// ==========================================
// SINHALA DICTIONARY & PHONETIC RULES
// ==========================================

const SINHALA_WORD_DICT: Record<string, string> = {
  // Greetings & Courtesies
  'ayubowan': 'ආයුබෝවන්',
  'aayubowan': 'ආයුබෝවන්',
  'kohomada': 'කොහොමද',
  'istuti': 'ස්තූතියි',
  'sthuthi': 'ස්තූතියි',
  'stuti': 'ස්තූතියි',
  'bohoma': 'බොහෝම',
  'subha': 'සුභ',
  'dawasak': 'දවසක්',
  'karunakarala': 'කරුණාකර',
  'karunakara': 'කරුණාකර',
  'ow': 'ඔව්',
  'ou': 'ඔව්',
  'nehe': 'නැහැ',
  'naha': 'නැහැ',
  'hondai': 'හොඳයි',
  'hari': 'හරි',

  // Pronouns & Conversational phrases
  'mama': 'මම',
  'mata': 'මට',
  'oba': 'ඔබ',
  'obata': 'ඔබට',
  'oyata': 'ඔයාට',
  'oya': 'ඔයා',
  'sahayak': 'සහයක්',
  'sahaya': 'සහය',
  'awashyai': 'අවශ්‍යයි',
  'awashyada': 'අවශ්‍යද',
  'vendanawa': 'අවශ්‍යයි', // mapped from user example
  'mokakda': 'මොකක්ද',
  'monawada': 'මොනවද',
  'kawadada': 'කවදද',
  'kohedha': 'කොහෙද',
  'koheda': 'කොහෙද',

  // Verbs & Common Helpers
  'denna': 'දෙන්න',
  'danna': 'දන්න',
  'puluwanda': 'පුළුවන්ද',
  'puluwan': 'පුළුවන්',
  'karanna': 'කරන්න',
  'katha': 'කථා',
  'karanne': 'කරන්නෙ',
  'enawa': 'එනවා',
  'balanna': 'බලන්න',
  'dan': 'දැන්',
  'passe': 'පස්සේ',

  // Clinic & Appointment Context
  'appointment': 'අපොයින්ට්මන්ට්',
  'appointmentekak': 'අපොයින්ට්මන්ට් එකක්',
  'ekak': 'එකක්',
  'dosthara': 'දොස්තර',
  'dostharathuma': 'දොස්තරතුමා',
  'prathikara': 'ප්‍රතිකාර',
  'prathikaraya': 'ප්‍රතිකාරය',
  'welawa': 'වේලාව',
  'dinaya': 'දිනය',
  'hospital': 'රෝහල',
  'clinic': 'සායනය',
};

const SINHALA_INDEPENDENT_VOWELS: [string, string][] = [
  ['aae', 'ඈ'], ['ae', 'ඇ'],
  ['aa', 'ආ'], ['au', 'ඖ'], ['ai', 'ඓ'],
  ['ee', 'ඒ'], ['ii', 'ඊ'], ['oo', 'ඌ'], ['uu', 'ඌ'],
  ['a', 'අ'], ['i', 'ඉ'], ['u', 'උ'], ['e', 'එ'], ['o', 'ඔ']
];

const SINHALA_DEPENDENT_VOWELS: Record<string, string> = {
  'aae': 'ෑ', 'ae': 'ැ',
  'aa': 'ා', 'a': '',
  'ii': 'ී', 'ee': 'ී', 'i': 'ි',
  'uu': 'ූ', 'oo': 'ූ', 'u': 'ු',
  'ea': 'ේ', 'e': 'ෙ',
  'ai': 'ෛ',
  'oa': 'ෝ', 'o': 'ො',
  'au': 'ෞ'
};

const SINHALA_CONSONANTS: [string, string][] = [
  ['nng', 'ඟ'], ['ndh', 'ඳ'], ['mbh', 'ඹ'],
  ['thh', 'ථ'], ['dhh', 'ඪ'], ['chh', 'ඡ'], ['jhh', 'ඣ'],
  ['sh', 'ශ'], ['Sh', 'ෂ'], ['th', 'ත'], ['dh', 'ද'],
  ['ch', 'ච'], ['kh', 'ඛ'], ['gh', 'ඝ'], ['ph', 'ඵ'], ['bh', 'භ'],
  ['k', 'ක'], ['g', 'ග'], ['c', 'ච'], ['j', 'ජ'],
  ['t', 'ට'], ['T', 'ත'], ['d', 'ඩ'], ['D', 'ද'],
  ['n', 'න'], ['N', 'ණ'],
  ['p', 'ප'], ['b', 'බ'], ['m', 'ම'],
  ['y', 'ය'], ['r', 'ර'],
  ['l', 'ල'], ['L', 'ළ'], ['v', 'ව'], ['w', 'ව'],
  ['s', 'ස'], ['h', 'හ'], ['f', 'ෆ']
];

const SINHALA_VIRAMA = '\u0DCA'; // ් (al-lakuna)

/**
 * Phonetically transliterate a single Romanized Sinhala word into Sinhala Unicode
 */
export function transliterateSinhalaWord(rawWord: string): string {
  if (!rawWord) return '';

  const cleanWord = rawWord.toLowerCase();

  // 1. Direct dictionary match
  if (SINHALA_WORD_DICT[cleanWord]) {
    return SINHALA_WORD_DICT[cleanWord];
  }

  // 2. Multi-syllable rule engine
  let result = '';
  let i = 0;
  const len = rawWord.length;

  while (i < len) {
    // Check for independent vowel if at start or after a completed syllable
    let matchedVowel = false;
    if (i === 0 || result.endsWith(' ') || result === '') {
      for (const [vKey, vChar] of SINHALA_INDEPENDENT_VOWELS) {
        if (cleanWord.substring(i).startsWith(vKey)) {
          result += vChar;
          i += vKey.length;
          matchedVowel = true;
          break;
        }
      }
      if (matchedVowel) continue;
    }

    // Match consonant
    let matchedConsonant: [string, string] | null = null;
    for (const [cKey, cChar] of SINHALA_CONSONANTS) {
      if (cleanWord.substring(i).startsWith(cKey)) {
        matchedConsonant = [cKey, cChar];
        break;
      }
    }

    if (matchedConsonant) {
      const [cKey, baseConsonant] = matchedConsonant;
      i += cKey.length;

      // Check if followed by vowel
      let matchedDepVowel: [string, string] | null = null;
      for (const vKey of Object.keys(SINHALA_DEPENDENT_VOWELS)) {
        if (cleanWord.substring(i).startsWith(vKey)) {
          matchedDepVowel = [vKey, SINHALA_DEPENDENT_VOWELS[vKey]];
          break;
        }
      }

      if (matchedDepVowel) {
        const [vKey, vSign] = matchedDepVowel;
        result += baseConsonant + vSign;
        i += vKey.length;
      } else {
        // Hal consonant with al-lakuna
        result += baseConsonant + SINHALA_VIRAMA;
      }
    } else {
      // Check for standalone vowel inside word
      let foundMidVowel = false;
      for (const [vKey, vChar] of SINHALA_INDEPENDENT_VOWELS) {
        if (cleanWord.substring(i).startsWith(vKey)) {
          result += vChar;
          i += vKey.length;
          foundMidVowel = true;
          break;
        }
      }

      if (!foundMidVowel) {
        result += rawWord[i];
        i++;
      }
    }
  }

  return result;
}

const PRESERVED_ABBREVIATIONS = new Set([
  'AM', 'PM', 'OK', 'CRM', 'RWC', 'CRAS', 'VIP', 'OTP', 'URL', 'ID', 'PDF', 'SMS', 'SOS', 'LKR', 'USD', 'RS', 'DR', 'MR', 'MRS'
]);

/**
 * Transliterates full text word-by-word while preserving delimiters, spaces, punctuation and emojis
 */
export function transliterateText(text: string, lang: TypingLanguage): string {
  if (!text || lang === 'en') return text;

  // Split by word boundaries (spaces, newlines, punctuation)
  const tokens = text.split(/([ \t\r\n.,?!:;()\-+*/"'`]+)/);

  return tokens.map(token => {
    // If token is whitespace or punctuation, return as-is
    if (/^[ \t\r\n.,?!:;()\-+*/"'`]+$/.test(token)) {
      return token;
    }
    // If token contains non-ASCII characters (e.g. already Tamil/Sinhala/emojis), preserve it
    if (/[^\x00-\x7F]/.test(token)) {
      return token;
    }
    // If token is purely digits or symbols, preserve it
    if (/^[\d$%#@&]+$/.test(token)) {
      return token;
    }
    // If token is preserved abbreviation
    if (PRESERVED_ABBREVIATIONS.has(token.toUpperCase())) {
      return token;
    }

    if (lang === 'ta') {
      return transliterateTamilWord(token);
    } else if (lang === 'si') {
      return transliterateSinhalaWord(token);
    }
    return token;
  }).join('');
}

/**
 * Transliterate only the active word being typed at cursor position
 */
export function transliterateActiveWord(word: string, lang: TypingLanguage): string {
  if (!word || lang === 'en') return word;
  if (PRESERVED_ABBREVIATIONS.has(word.toUpperCase())) return word;
  if (lang === 'ta') return transliterateTamilWord(word);
  if (lang === 'si') return transliterateSinhalaWord(word);
  return word;
}

/**
 * Transliterate the word immediately preceding the cursor in a text input.
 * Triggered on Space, Enter, or punctuation.
 */
export function transliterateWordAtCursor(
  text: string,
  cursorPos: number,
  lang: TypingLanguage
): { newText: string; newCursorPos: number; convertedWord: string | null } {
  if (lang === 'en' || cursorPos <= 0) {
    return { newText: text, newCursorPos: cursorPos, convertedWord: null };
  }

  const textBefore = text.slice(0, cursorPos);
  const textAfter = text.slice(cursorPos);

  // Match the English word immediately before the cursor (only Latin letters)
  const match = textBefore.match(/([a-zA-Z]+)$/);
  if (!match) {
    return { newText: text, newCursorPos: cursorPos, convertedWord: null };
  }

  const rawWord = match[1];
  if (PRESERVED_ABBREVIATIONS.has(rawWord.toUpperCase())) {
    return { newText: text, newCursorPos: cursorPos, convertedWord: null };
  }

  const converted = transliterateActiveWord(rawWord, lang);
  if (converted === rawWord) {
    return { newText: text, newCursorPos: cursorPos, convertedWord: null };
  }

  const wordStart = textBefore.length - rawWord.length;
  const newTextBefore = textBefore.slice(0, wordStart) + converted;
  const newText = newTextBefore + textAfter;
  const newCursorPos = newTextBefore.length;

  return { newText, newCursorPos, convertedWord: converted };
}
