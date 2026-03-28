import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FieldEncryptionError,
  clearEncryptionKeyCache,
  decryptFieldValue,
  encryptFieldValue
} from '../../backend/src/lib/crypto';

describe('field encryption helpers', () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY;

  beforeEach(() => {
    clearEncryptionKeyCache();
  });

  afterEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = originalKey;
    clearEncryptionKeyCache();
  });

  it('encrypts and decrypts a value round-trip', () => {
    process.env.FIELD_ENCRYPTION_KEY = '12345678901234567890123456789012';

    const encrypted = encryptFieldValue('sensitive-value');

    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.ciphertext).not.toBe('sensitive-value');

    const decrypted = decryptFieldValue(encrypted.ciphertext, encrypted.iv);
    expect(decrypted).toBe('sensitive-value');
  });

  it('fails decrypt with a different key', () => {
    process.env.FIELD_ENCRYPTION_KEY = '12345678901234567890123456789012';
    const encrypted = encryptFieldValue('sensitive-value');

    process.env.FIELD_ENCRYPTION_KEY = 'abcdefghijklmnopqrstuvwxzy123456';
    clearEncryptionKeyCache();

    expect(() => decryptFieldValue(encrypted.ciphertext, encrypted.iv)).toThrow(FieldEncryptionError);
  });

  it('fails decrypt when ciphertext is tampered', () => {
    process.env.FIELD_ENCRYPTION_KEY = '12345678901234567890123456789012';
    const encrypted = encryptFieldValue('sensitive-value');

    const parts = encrypted.ciphertext.split('.');
    const tamperedCiphertext = `${parts[0].slice(0, -2)}AA.${parts[1]}`;

    expect(() => decryptFieldValue(tamperedCiphertext, encrypted.iv)).toThrow(FieldEncryptionError);
  });
});
