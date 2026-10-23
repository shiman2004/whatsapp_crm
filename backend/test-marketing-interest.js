import assert from 'node:assert/strict';
import { detectMarketingInterest, isExplicitConsentReply } from './src/modules/marketing/services/marketingInterest.service.js';

assert.equal(detectMarketingInterest('I want to book a consultation').outcome, 'INTERESTED');
assert.equal(detectMarketingInterest('Tell me about course fees').outcome, 'INTERESTED');
assert.equal(detectMarketingInterest('Call me tomorrow').outcome, 'FOLLOW_UP');
assert.equal(detectMarketingInterest('Not interested').outcome, 'NOT_INTERESTED');
assert.equal(detectMarketingInterest('STOP').outcome, 'OPTED_OUT');
assert.equal(isExplicitConsentReply('YES'), 'verified');
assert.equal(isExplicitConsentReply('Hi'), null);

console.log('marketing interest rules: passed');
