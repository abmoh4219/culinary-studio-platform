import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;

type CipherOptions = {
  fieldName?: string;
  allowPlaintextFallback?: boolean;
};

export type EncryptedField = {
  ciphertext: string;
  iv: string;
};

export class FieldEncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldEncryptionConfigError';
  }
}

export class FieldEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldEncryptionError';
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function parseBase64Key(raw: string): Buffer | null {
  try {
    const normalized = raw.replace(/\s+/g, '');
    const parsed = Buffer.from(normalized, 'base64');
    if (parsed.length !== 32) {
      return null;
    }

    const canonical = parsed.toString('base64').replace(/=+$/g, '');
    const candidate = normalized.replace(/=+$/g, '');
    return canonical === candidate ? parsed : null;
  } catch {
    return null;
  }
}

function parseEncryptionKeyMaterial(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new FieldEncryptionConfigError(
      'FIELD_ENCRYPTION_KEY is empty. Provide a 32-byte UTF-8 key or base64-encoded 32-byte key.'
    );
  }

  const base64Value = trimmed.startsWith('base64:') ? trimmed.slice('base64:'.length) : trimmed;
  const fromBase64 = parseBase64Key(base64Value);
  if (fromBase64) {
    return fromBase64;
  }

  const fromUtf8 = Buffer.from(trimmed, 'utf8');
  if (fromUtf8.length === 32) {
    return fromUtf8;
  }

  throw new FieldEncryptionConfigError(
    'FIELD_ENCRYPTION_KEY must be exactly 32 bytes (UTF-8) or base64 for 32 raw bytes.'
  );
}

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    if (isProduction()) {
      throw new FieldEncryptionConfigError(
        'FIELD_ENCRYPTION_KEY is required in production for at-rest encryption/decryption.'
      );
    }

    throw new FieldEncryptionConfigError(
      'FIELD_ENCRYPTION_KEY is not configured. Set it before writing/reading encrypted fields.'
    );
  }

  cachedKey = parseEncryptionKeyMaterial(raw);
  return cachedKey;
}

function fallbackEnabled(options: CipherOptions): boolean {
  if (options.allowPlaintextFallback === true) {
    return true;
  }

  return process.env.FIELD_ENCRYPTION_ALLOW_PLAINTEXT_FALLBACK === 'true';
}

function fieldLabel(options: CipherOptions): string {
  return options.fieldName ?? 'value';
}

export function clearEncryptionKeyCache(): void {
  cachedKey = null;
}

export function encryptFieldValue(value: string): EncryptedField {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = `${ciphertext.toString('base64')}.${tag.toString('base64')}`;

  return {
    ciphertext: packed,
    iv: iv.toString('base64')
  };
}

export function decryptFieldValue(ciphertext: string, iv: string): string {
  const key = getEncryptionKey();
  const [encodedCiphertext, encodedTag] = ciphertext.split('.');
  if (!encodedCiphertext || !encodedTag) {
    throw new FieldEncryptionError('Invalid encrypted payload format.');
  }

  const ivBuffer = Buffer.from(iv, 'base64');
  const ciphertextBuffer = Buffer.from(encodedCiphertext, 'base64');
  const tagBuffer = Buffer.from(encodedTag, 'base64');

  if (ivBuffer.length !== IV_BYTE_LENGTH) {
    throw new FieldEncryptionError('Invalid IV size for encrypted value.');
  }

  if (tagBuffer.length !== AUTH_TAG_BYTE_LENGTH) {
    throw new FieldEncryptionError('Invalid auth tag size for encrypted value.');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    const plaintext = Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw new FieldEncryptionError('Failed to decrypt encrypted value.');
  }
}

export function encryptOptionalField(
  value: string | null | undefined
): { ciphertext: string | null; iv: string | null } {
  if (value === null || value === undefined) {
    return {
      ciphertext: null,
      iv: null
    };
  }

  return encryptFieldValue(value);
}

export function decryptOptionalField(
  ciphertext: string | null | undefined,
  iv: string | null | undefined,
  options: CipherOptions = {}
): string | null {
  if (ciphertext === null || ciphertext === undefined) {
    return null;
  }

  const fallback = fallbackEnabled(options);
  if (!iv) {
    if (fallback) {
      return ciphertext;
    }

    throw new FieldEncryptionError(
      `Encrypted field ${fieldLabel(options)} is missing IV and plaintext fallback is disabled.`
    );
  }

  try {
    return decryptFieldValue(ciphertext, iv);
  } catch (error) {
    if (fallback) {
      return ciphertext;
    }

    throw new FieldEncryptionError(
      `Unable to decrypt field ${fieldLabel(options)}. ${
        error instanceof Error ? error.message : 'Unknown decrypt error.'
      }`
    );
  }
}
