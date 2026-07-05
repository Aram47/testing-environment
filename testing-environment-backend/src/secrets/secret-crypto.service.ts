import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class SecretCryptoService {
  private readonly keys: Map<string, Buffer>;
  private readonly activeKeyVersion: string;

  constructor(config: ConfigService) {
    this.keys = this.loadKeys(config);
    this.activeKeyVersion = config.get<string>('ACTIVE_SECRET_ENCRYPTION_KEY_VERSION', 'v1');
    if (!this.keys.has(this.activeKeyVersion)) {
      throw new BadRequestException('Active secret encryption key version is not configured');
    }
  }

  getActiveKeyVersion(): string {
    return this.activeKeyVersion;
  }

  encrypt(value: string, keyVersion = this.activeKeyVersion): string {
    const key = this.getKey(keyVersion);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(payload: string, keyVersion = 'v1'): string {
    const [iv, tag, encrypted] = payload.split(':');
    if (!iv || !tag || !encrypted) {
      throw new BadRequestException('Invalid encrypted secret payload');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(keyVersion),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private loadKeys(config: ConfigService): Map<string, Buffer> {
    const configured = config.get<string>('SECRET_ENCRYPTION_KEYS');
    if (configured?.trim()) {
      const parsed = JSON.parse(configured) as Record<string, string>;
      return new Map(
        Object.entries(parsed).map(([version, raw]) => [version, this.normalizeKey(raw)]),
      );
    }

    return new Map([['v1', this.normalizeKey(config.get<string>('SECRET_ENCRYPTION_KEY', ''))]]);
  }

  private getKey(version: string): Buffer {
    const key = this.keys.get(version);
    if (!key) {
      throw new BadRequestException(`Secret encryption key version is not configured: ${version}`);
    }
    return key;
  }

  private normalizeKey(raw: string): Buffer {
    const decoded = Buffer.from(raw, 'base64');
    return decoded.length === 32 ? decoded : Buffer.from(raw.padEnd(32, '0')).subarray(0, 32);
  }
}
