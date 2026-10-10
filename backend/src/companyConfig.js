/**
 * Multi-Company Configuration: Royal Wellness Center (RWC) & College of Royal Aesthetic of Sri Lanka (CRAS)
 */

export const COMPANIES = {
  RWC: {
    code: 'RWC',
    tag: '(RWC)',
    name: 'Royal Wellness Center',
    shortName: 'Royal Wellness',
    colorHex: '#008000', // Green requested by user
    color: '#008000',
    phoneId: process.env.META_PHONE_NUMBER_ID_RWC || '1358157244046701',
    phoneNumber: '+94 70 639 3353',
    phone: '+94 70 639 3353',
    displayPhoneDigits: '94706393353',
  },
  CRAS: {
    code: 'CRAS',
    tag: '(CRAS)',
    name: 'College of Royal Aesthetic of Sri Lanka',
    shortName: 'CRAS College',
    colorHex: '#800000', // Maroon requested by user
    color: '#800000',
    phoneId: process.env.META_PHONE_NUMBER_ID_CRAS || '1378201582041705',
    phoneNumber: '+94 70 637 3353',
    phone: '+94 70 637 3353',
    displayPhoneDigits: '94706373353',
  }
};

/**
 * Resolves company by incoming Meta phone_number_id or display_phone_number
 */
export function resolveCompany(phoneId, displayPhoneNumber) {
  const pId = String(phoneId || '').trim();
  const dPhone = String(displayPhoneNumber || '').replace(/[^0-9]/g, '');

  if (pId === '1378201582041705' || dPhone.includes('6373353')) {
    return COMPANIES.CRAS;
  }
  return COMPANIES.RWC;
}
