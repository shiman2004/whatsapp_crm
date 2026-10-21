// Marketing records remain company-scoped even though a normalized phone is globally unique.
export function getMarketingCompanyScope(user) {
  if (user?.role === 'super_admin') return user.company || null;
  return user?.company || null;
}

export function canAccessMarketingCompany(user, company) {
  if (!company) return false;
  return user?.role === 'super_admin' || getMarketingCompanyScope(user) === company;
}
