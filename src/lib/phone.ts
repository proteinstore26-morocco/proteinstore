// Moroccan phone helpers shared by checkout, tracking and admin messaging.

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalise to a local 10-digit number (`0[5-7]XXXXXXXX`), or null when invalid. */
export function normalizeMoroccanPhone(value: string): string | null {
  let digits = digitsOnly(value);
  if (digits.startsWith("00212")) digits = digits.slice(5);
  else if (digits.startsWith("212")) digits = digits.slice(3);
  if (digits.length === 9) digits = "0" + digits;
  return /^0[5-7]\d{8}$/.test(digits) ? digits : null;
}

/** WhatsApp expects international digits without `+`. */
export function waNumber(value: string): string {
  const normalized = normalizeMoroccanPhone(value);
  if (normalized) return "212" + normalized.slice(1);
  return digitsOnly(value);
}

/** Compare numbers by their last 9 digits (tracking does not require exact formatting). */
export function samePhone(a: string, b: string): boolean {
  const left = digitsOnly(a).slice(-9);
  const right = digitsOnly(b).slice(-9);
  return left.length === 9 && left === right;
}
