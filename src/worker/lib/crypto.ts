// Password hashing, tokens and hashing helpers built on WebCrypto (available in Workers and Node).
const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers caps PBKDF2 at 100,000 iterations.
const encoder = new TextEncoder();

export const toB64 = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
export const fromB64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const toHex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export const sha256Hex = async (input: string | Uint8Array): Promise<string> => {
  const data = typeof input === "string" ? encoder.encode(input) : input;
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource)));
};

export const randomToken = (bytes = 32): string => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

export const timingSafeEqual = (a: string, b: string): boolean => {
  const ea = encoder.encode(a);
  const eb = encoder.encode(b);
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
};

const derive = async (password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
};

/** Format: pbkdf2-sha256$<iterations>$<salt b64>$<hash b64> */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iter || !saltB64 || !hashB64) return false;
  const iterations = Number(iter);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  const actual = await derive(password, fromB64(saltB64), iterations);
  return timingSafeEqual(toB64(actual), hashB64);
};

/** Used to equalise timing when the account does not exist. */
export const DUMMY_HASH = `pbkdf2-sha256$${PBKDF2_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;
