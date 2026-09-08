import crypto from 'crypto';
import { env } from './env';

// Klucz musi być 32-bajtowy (64 znaki hex). Generacja: crypto.randomBytes(32).toString('hex')
function getKey(): Buffer {
  const hex = env.encryptionKey();
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY musi być 32-bajtowym kluczem w hex (64 znaki)');
  }
  return key;
}

// Format zapisu: base64(iv) + '.' + base64(authTag) + '.' + base64(ciphertext)
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Nieprawidłowy format zaszyfrowanych danych');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// Losowy identyfikator (state, pv_id, session token) - kryptograficznie bezpieczny.
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

// Do haszowania session tokenów przed zapisem w bazie (DB leak nie ujawnia usable session id).
export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// IP nigdy nie trzymamy w bazie w czystej postaci - tylko hash, do rate limitingu/audytu.
export function hashIp(ip: string): string {
  return sha256Hex(`ip:${ip}`);
}
