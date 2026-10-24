import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from '../../src/modules/channel-connection/infrastructure/token-encryption.service.js';

describe('TokenEncryptionService (AES-256-GCM)', () => {
  const secretKey = 'this_is_a_very_secure_and_long_secret_key_for_testing_123';
  const configService = new ConfigService({
    TOKEN_ENCRYPTION_KEY: secretKey,
  });

  const encryptionService = new TokenEncryptionService(configService);

  it('should encrypt and decrypt a plaintext token successfully', () => {
    const rawToken = 'EAABwb12948190248_meta_page_access_token_secret';
    const encrypted = encryptionService.encrypt(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:cipher

    const decrypted = encryptionService.decrypt(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('should generate different ciphertexts for the same plaintext due to random IV', () => {
    const rawToken = 'same_plaintext_token';
    const enc1 = encryptionService.encrypt(rawToken);
    const enc2 = encryptionService.encrypt(rawToken);

    expect(enc1).not.toBe(enc2);
    expect(encryptionService.decrypt(enc1)).toBe(rawToken);
    expect(encryptionService.decrypt(enc2)).toBe(rawToken);
  });

  it('should identify valid and invalid encrypted strings via isEncrypted', () => {
    const rawToken = 'plaintext_sample';
    const encrypted = encryptionService.encrypt(rawToken);

    expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    expect(encryptionService.isEncrypted(rawToken)).toBe(false);
    expect(encryptionService.isEncrypted('invalid:format')).toBe(false);
    expect(encryptionService.isEncrypted('')).toBe(false);
  });

  it('should throw an error when decrypting tampered data', () => {
    const rawToken = 'sensitive_data';
    const encrypted = encryptionService.encrypt(rawToken);
    const parts = encrypted.split(':');

    // Tamper with the ciphertext
    const tamperedCipher = parts[2].substring(0, parts[2].length - 2) + 'ff';
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(() => encryptionService.decrypt(tamperedPayload)).toThrow(
      /Token decryption failed/,
    );
  });

  it('should throw an error when payload format is invalid', () => {
    expect(() => encryptionService.decrypt('not_a_valid_payload')).toThrow(
      /Invalid encrypted token format/,
    );
  });

  it('should reject empty or null inputs', () => {
    expect(() => encryptionService.encrypt('')).toThrow(
      /Cannot encrypt empty or null text/,
    );
    expect(() => encryptionService.decrypt('')).toThrow(
      /Cannot decrypt empty or null payload/,
    );
  });
});
