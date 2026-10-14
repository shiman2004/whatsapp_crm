// Test suite for Tamil & Sinhala Phonetic Typing Converter
import { 
  transliterateText, 
  transliterateActiveWord, 
  transliterateWordAtCursor 
} from '../frontend/src/utils/phoneticConverter.ts';

console.log('🇱🇰 Starting Tamil & Sinhala Phonetic Transliteration Test Suite...\n');

// 1. Tamil Core Examples (From prompt & reference screenshot)
const tamilExamples = [
  { input: 'vanakkam', expected: 'வணக்கம்' },
  { input: 'nandri', expected: 'நன்றி' },
  { input: 'neenga eppadi irukkinga', expected: 'நீங்க எப்படி இருக்கீங்க' },
  { input: 'neenga eppadi irukkireergal', expected: 'நீங்க எப்படி இருக்கிறீர்கள்' },
  { input: 'ungalukku enna uthavi vendum', expected: 'உங்களுக்கு என்ன உதவி வேண்டும்' },
  { input: 'appointment eppothu irukkum', expected: 'அப்பாய்ண்ட்மென்ட் எப்பொழுது இருக்கும்' },
  { input: 'vanakkam! ungalukku enna uthavi vendum?', expected: 'வணக்கம்! உங்களுக்கு என்ன உதவி வேண்டும்?' }
];

console.log('Testing Tamil Transliterations:');
for (const test of tamilExamples) {
  const output = transliterateText(test.input, 'ta');
  if (output !== test.expected) {
    console.error(`❌ FAIL: "${test.input}" -> "${output}" !== "${test.expected}"`);
    process.exit(1);
  }
  console.log(`  ✅ "${test.input}" -> "${output}"`);
}

// 2. Sinhala Core Examples (From prompt & reference screenshot)
const sinhalaExamples = [
  { input: 'ayubowan', expected: 'ආයුබෝවන්' },
  { input: 'kohomada', expected: 'කොහොමද' },
  { input: 'mama sahayak vendanawa', expected: 'මම සහයක් අවශ්‍යයි' },
  { input: 'appointment ekak denna puluwanda', expected: 'අපොයින්ට්මන්ට් එකක් දෙන්න පුළුවන්ද' },
  { input: 'appointment ekak denna puluwanda?', expected: 'අපොයින්ට්මන්ට් එකක් දෙන්න පුළුවන්ද?' },
  { input: 'istuti', expected: 'ස්තූතියි' },
  { input: 'ayubowan! kohomada oyata?', expected: 'ආයුබෝවන්! කොහොමද ඔයාට?' }
];

console.log('\nTesting Sinhala Transliterations:');
for (const test of sinhalaExamples) {
  const output = transliterateText(test.input, 'si');
  if (output !== test.expected) {
    console.error(`❌ FAIL: "${test.input}" -> "${output}" !== "${test.expected}"`);
    process.exit(1);
  }
  console.log(`  ✅ "${test.input}" -> "${output}"`);
}

// 3. English Mode Bypass (Must preserve English identically)
console.log('\nTesting English Mode Bypass:');
const englishSample = 'Hello Dr. Zeenath, appointment is confirmed for 10:30 AM.';
const englishOut = transliterateText(englishSample, 'en');
if (englishOut !== englishSample) {
  console.error(`❌ FAIL: English text modified in 'en' mode`);
  process.exit(1);
}
console.log(`  ✅ "${englishSample}" -> "${englishOut}"`);

// 4. Mixed Text & Preserved Numbers / Punctuation
console.log('\nTesting Mixed Mode & Preserved Entities:');
const mixedTamil = 'vanakkam! 10:30 AM appointment sari?';
const expectedMixedTamil = 'வணக்கம்! 10:30 AM அப்பாய்ண்ட்மென்ட் சரி?';
const outMixedTamil = transliterateText(mixedTamil, 'ta');
if (outMixedTamil !== expectedMixedTamil) {
  console.error(`❌ FAIL: Mixed text "${outMixedTamil}" !== "${expectedMixedTamil}"`);
  process.exit(1);
}
console.log(`  ✅ "${mixedTamil}" -> "${outMixedTamil}"`);

// 5. Cursor Word-by-Word Transliteration
console.log('\nTesting Real-Time Cursor Transliteration:');
const cursorSim = transliterateWordAtCursor('neenga eppadi irukkinga', 23, 'ta');
if (cursorSim.convertedWord !== 'இருக்கீங்க') {
  console.error(`❌ FAIL: Cursor conversion failed`);
  process.exit(1);
}
console.log(`  ✅ Cursor word-by-word conversion: "${cursorSim.convertedWord}"`);

console.log('\n🎉 ALL TAMIL & SINHALA PHONETIC CONVERTER TESTS PASSED SUCCESSFULLY!\n');
process.exit(0);
