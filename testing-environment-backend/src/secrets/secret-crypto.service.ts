import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class SecretCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('SECRET_ENCRYPTION_KEY', '');
    const decoded = Buffer.from(raw, 'base64');
    this.key = decoded.length === 32 ? decoded : Buffer.from(raw.padEnd(32, '0')).subarray(0, 32);
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [iv, tag, encrypted] = payload.split(':');
    if (!iv || !tag || !encrypted) {
      throw new BadRequestException('Invalid encrypted secret payload');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
