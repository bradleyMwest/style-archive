import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const DELIMITER = ':';

export function hashPassword(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(plainText, salt, KEY_LENGTH).toString('hex');
  return `${salt}${DELIMITER}${derivedKey}`;
}

export function verifyPassword(plainText: string, hashedValue: string): boolean {
  if (!plainText || !hashedValue) {
    return false;
  }

  const [salt, storedKey] = hashedValue.split(DELIMITER);
  if (!salt || !storedKey) {
    return false;
  }

  const derivedKey = scryptSync(plainText, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(storedKey, 'hex');

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}
