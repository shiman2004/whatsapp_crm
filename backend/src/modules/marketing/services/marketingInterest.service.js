const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const rules = [
  ['OPTED_OUT', ['stop', 'unsubscribe', 'do not contact', "don't message", 'don’t message', 'අවශ්‍ය නැහැ', 'එපා', 'தொடர்பு வேண்டாம்']],
  ['NOT_INTERESTED', ['not interested', 'no thanks', 'no thank you', 'interested නැහැ', 'வேண்டாம்']],
  ['FOLLOW_UP', ['call me tomorrow', 'call tomorrow', 'follow up', 'later', 'පස්සේ', 'நாளை அழைக்க']],
  ['INTERESTED', ['consultation', 'appointment', 'book', 'treatment', 'course', 'fees', 'fee', 'price', 'information', 'details', 'interested', 'විස්තර', 'මිල', 'පාඨමාලාව', 'தகவல்', 'கட்டணம்', 'சிகிச்சை']],
];

export function detectMarketingInterest(message) {
  const text = normalize(message);
  if (!text) return { outcome: 'UNCLEAR', confidence: 'low', matchedRule: null };

  for (const [outcome, phrases] of rules) {
    const phrase = phrases.find(item => text.includes(item));
    if (phrase) return { outcome, confidence: 'high', matchedRule: phrase };
  }
  return { outcome: 'UNCLEAR', confidence: 'low', matchedRule: null };
}

export function isExplicitConsentReply(message) {
  const text = normalize(message);
  if (['yes', 'yes please', 'i agree', 'agree', 'ඔව්', 'ஆம்'].includes(text)) return 'verified';
  if (['no', 'no thanks', 'decline', 'නැහැ', 'இல்லை'].includes(text)) return 'opted_out';
  return null;
}
