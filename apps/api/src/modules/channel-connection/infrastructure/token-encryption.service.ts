import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class TokenEncryptionService {
  private readonly logger = new Logger(TokenEncryptionService.name);
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;

  constructor(configService: ConfigService) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    const rawSecret = configService.get<string>('TOKEN_ENCRYPTION_KEY');

    if (!rawSecret) {
      if (isProduction) {
        throw new Error(
          'CRITICAL SECURITY CONFIGURATION ERROR: TOKEN_ENCRYPTION_KEY must be configured in environment variables in production mode',
        );
      }
      this.logger.warn(
        'TOKEN_ENCRYPTION_KEY is not set in environment. Falling back to development key. DO NOT USE IN PRODUCTION.',
      );
    }

    const secretToUse =
      rawSecret || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Đảm bảo khóa luôn là 32 bytes (256 bits) chuẩn cho AES-256
    this.key = createHash('sha256').update(secretToUse).digest();
  }

  /**
   * Mã hóa văn bản thô (Access Token, Refresh Token) bằng AES-256-GCM
   * Trả về chuỗi an toàn: `ivHex:authTagHex:cipherHex`
   */
  encrypt(plainText: string): string {
    if (!plainText) {
      throw new Error('Cannot encrypt empty or null text');
    }

    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Giải mã chuỗi đã mã hóa bằng AES-256-GCM
   * Kiểm tra tính toàn vẹn thông qua authTag
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      throw new Error('Cannot decrypt empty or null payload');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format. Expected "iv:authTag:cipher"');
    }

    const [ivHex, authTagHex, cipherHex] = parts;

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const cipherText = Buffer.from(cipherHex, 'hex');

      if (iv.length !== this.ivLength || authTag.length !== this.authTagLength) {
        throw new Error('Invalid IV or AuthTag length in encrypted payload');
      }

      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(cipherText),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      this.logger.error('Failed to decrypt token. Data may have been tampered with or key is mismatched.');
      throw new Error('Token decryption failed: authentication tag verification error');
    }
  }

  /**
   * Kiểm tra chuỗi có định dạng mã hóa AES-256-GCM hợp lệ hay không
   */
  isEncrypted(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    const parts = value.split(':');
    return (
      parts.length === 3 &&
      /^[0-9a-fA-F]{32}$/.test(parts[0]) && // 16 bytes IV hex = 32 chars
      /^[0-9a-fA-F]{32}$/.test(parts[1]) && // 16 bytes AuthTag hex = 32 chars
      /^[0-9a-fA-F]+$/.test(parts[2])
    );
  }
}
