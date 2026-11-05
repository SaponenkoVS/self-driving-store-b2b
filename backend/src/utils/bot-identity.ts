/**
 * Normalisation shared with the Relay (packages/protocol/src/nip.ts). Keep the two in sync.
 */
const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

/** Polish NIP: 10 digits with a checksum. Accepts "PL", spaces and dashes. */
export function normalizeNip(input: string): string | null {
  const digits = input.trim().toUpperCase().replace(/^PL/, "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return null;
  const sum = NIP_WEIGHTS.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const check = sum % 11;
  if (check === 10 || check !== Number(digits[9])) return null;
  return digits;
}

/** "Bella-Bau Sp. z o.o.", "bella bau sp z oo" and "BellaBau spzoo" all compare equal. */
export function normalizeCompanyName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ""); // ignore spaces and punctuation entirely: "o.o." == "oo" == "o o"
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
