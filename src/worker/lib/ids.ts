// Non-guessable certificate identifiers: <PREFIX>-<YEAR>-<8 chars of Crockford base32>.
// 32^8 ≈ 1.1 trillion combinations per prefix/year, drawn from crypto.getRandomValues
// with rejection sampling (no modulo bias). Uniqueness is enforced by a DB UNIQUE constraint.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U

export const randomCode = (length = 8): string => {
  let out = "";
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < 224 && out.length < length) out += ALPHABET[b % 32]; // 224 = 7*32, rejects biased range
    }
  }
  return out;
};

export const generateCertificateId = (prefix: string, year: number): string =>
  `${prefix}-${year}-${randomCode(8)}`;

export const CERTIFICATE_ID_PATTERN = /^[A-Z]{3}-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/;

/** Normalises user input like " mps-2026-k7q4m9xb " and rejects anything malformed. */
export const normaliseCertificateId = (raw: string): string | null => {
  const v = raw.trim().toUpperCase();
  return CERTIFICATE_ID_PATTERN.test(v) ? v : null;
};
