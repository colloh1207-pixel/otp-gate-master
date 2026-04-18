// API key generation and verification helpers (server-only).
import crypto from "node:crypto";

const KEY_PREFIX_PUBLIC = "wak_live_";

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX_PUBLIC}${random}`;
  const prefix = plaintext.slice(0, 12); // wak_live_XXX
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, hash };
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function isValidKeyShape(key: string): boolean {
  return typeof key === "string" && key.startsWith(KEY_PREFIX_PUBLIC) && key.length > 20 && key.length < 200;
}
