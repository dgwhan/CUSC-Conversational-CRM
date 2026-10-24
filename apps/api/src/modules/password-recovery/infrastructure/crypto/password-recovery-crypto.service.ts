import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

const OTP_DIGIT_COUNT = 6;
const OTP_VALUE_LIMIT = 10 ** OTP_DIGIT_COUNT;
const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const CURRENT_EMAIL_KEY_VERSION = 1;
const CURRENT_OTP_KEY_VERSION = 1;
const CURRENT_CIPHERTEXT_KEY_VERSION = 1;

export function formatRecoveryOtp(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= OTP_VALUE_LIMIT) {
    throw new RangeError('OTP value is outside the six-digit range');
  }

  return value.toString().padStart(OTP_DIGIT_COUNT, '0');
}

@Injectable()
// Tập trung tạo và kiểm tra OTP cùng các giá trị HMAC/mã hóa liên quan.
export class PasswordRecoveryCryptoService {
  private readonly emailHmacKey: Buffer;
  private readonly otpHmacKey: Buffer;
  private readonly otpEncryptionKey: Buffer;

  readonly emailKeyVersion = CURRENT_EMAIL_KEY_VERSION;
  readonly otpKeyVersion = CURRENT_OTP_KEY_VERSION;
  readonly ciphertextKeyVersion = CURRENT_CIPHERTEXT_KEY_VERSION;

  constructor(configService: ConfigService) {
    this.emailHmacKey = decodeKey(
      configService.getOrThrow<string>('PASSWORD_RECOVERY_EMAIL_HMAC_KEY'),
    );
    this.otpHmacKey = decodeKey(
      configService.getOrThrow<string>('PASSWORD_RECOVERY_OTP_HMAC_KEY'),
    );
    this.otpEncryptionKey = decodeKey(
      configService.getOrThrow<string>('PASSWORD_RECOVERY_OTP_ENCRYPTION_KEY'),
    );
  }

  createEmailKey(normalizedEmail: string): string {
    return createHmac('sha256', this.emailHmacKey)
      .update(`email:${normalizedEmail}`)
      .digest('hex');
  }

  createIpKey(ipAddress: string): string {
    return createHmac('sha256', this.emailHmacKey)
      .update(`ip:${ipAddress}`)
      .digest('hex');
  }

  generateOtp(): string {
    return formatRecoveryOtp(randomInt(0, OTP_VALUE_LIMIT));
  }

  createOtpVerifier(challengeId: string, otp: string): string {
    return createHmac('sha256', this.otpHmacKey)
      .update(`${challengeId}:${otp}`)
      .digest('hex');
  }

  verifyOtp(challengeId: string, otp: string, verifier: string): boolean {
    const expected = Buffer.from(verifier, 'hex');
    const actual = Buffer.from(this.createOtpVerifier(challengeId, otp), 'hex');

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  // Mã hóa OTP trong outbox; challenge và generation được gắn vào AAD.
  encryptOtp(challengeId: string, generation: number, otp: string): Buffer {
    const nonce = randomBytes(AES_GCM_NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.otpEncryptionKey, nonce);
    cipher.setAAD(Buffer.from(`${challengeId}:${generation}`));

    const encrypted = Buffer.concat([
      cipher.update(otp, 'utf8'),
      cipher.final(),
    ]);

    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
  }

  decryptOtp(
    challengeId: string,
    generation: number,
    ciphertext: Uint8Array,
    keyVersion: number,
  ): string {
    // Từ chối ciphertext sai phiên bản hoặc không đủ nonce, tag và nội dung.
    if (
      keyVersion !== this.ciphertextKeyVersion ||
      ciphertext.length <= AES_GCM_NONCE_BYTES + AES_GCM_TAG_BYTES
    ) {
      throw new Error('Could not decrypt recovery code');
    }

    const nonce = ciphertext.subarray(0, AES_GCM_NONCE_BYTES);
    const tag = ciphertext.subarray(
      AES_GCM_NONCE_BYTES,
      AES_GCM_NONCE_BYTES + AES_GCM_TAG_BYTES,
    );
    const encrypted = ciphertext.subarray(
      AES_GCM_NONCE_BYTES + AES_GCM_TAG_BYTES,
    );

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.otpEncryptionKey,
        nonce,
      );
      decipher.setAAD(Buffer.from(`${challengeId}:${generation}`));
      decipher.setAuthTag(tag);

      const otp = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');

      if (!/^\d{6}$/.test(otp)) {
        throw new Error('Invalid recovery code');
      }

      return otp;
    } catch {
      throw new Error('Could not decrypt recovery code');
    }
  }
}

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new Error(
      'Password recovery keys must be base64-encoded 32-byte values',
    );
  }

  return key;
}
