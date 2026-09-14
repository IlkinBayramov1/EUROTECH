export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassport(passport: string): boolean {
  return passport.trim().length >= 6;
}

export function validatePhone(phone: string): boolean {
  return phone.replace(/[^0-9+]/g, '').length >= 9;
}

export function validateRequired(value?: string | number | null): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}
