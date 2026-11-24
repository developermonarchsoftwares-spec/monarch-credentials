import { encode } from "uqr";

/** Returns the QR module matrix (true = dark). Error correction M balances density and resilience. */
export const qrMatrix = (text: string): boolean[][] => encode(text, { ecc: "M", border: 0 }).data;
