import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve } from 'path';
import { Readable } from 'stream';
import { ArtifactReference, ArtifactStorage, PutArtifactInput } from './artifact-storage.interface';

@Injectable()
export class FilesystemArtifactStorage implements ArtifactStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(
      config.get<string>('ARTIFACT_STORAGE_ROOT', '/tmp/testing-environment-artifacts'),
    );
  }

  async put(input: PutArtifactInput): Promise<ArtifactReference> {
    const path = this.resolvePath(input.objectKey);
    await mkdir(dirname(path), { recursive: true });
    const data = Buffer.isBuffer(input.data) ? input.data : await this.readStream(input.data);
    await writeFile(path, data);
    return {
      objectKey: input.objectKey,
      byteSize: data.byteLength,
      checksum: createHash('sha256').update(data).digest('hex'),
    };
  }

  async get(objectKey: string): Promise<Buffer> {
    return readFile(this.resolvePath(objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    await rm(this.resolvePath(objectKey), { force: true });
  }

  async createDownloadUrl(objectKey: string): Promise<string> {
    this.resolvePath(objectKey);
    return `artifact://${objectKey}`;
  }

  private resolvePath(objectKey: string): string {
    if (objectKey.startsWith('/') || objectKey.startsWith('\\')) {
      throw new Error('Artifact object key must be relative');
    }
    const normalized = normalize(objectKey);
    if (normalized.split(/[\\/]/).includes('..')) {
      throw new Error('Artifact object key cannot contain parent segments');
    }
    const path = resolve(join(this.root, normalized));
    if (path !== this.root && !path.startsWith(`${this.root}/`)) {
      throw new Error('Artifact object key escapes storage root');
    }
    return path;
  }

  private readStream(stream: Readable): Promise<Buffer> {
    return new Promise((resolveBuffer, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      stream.on('error', reject);
      stream.on('end', () => resolveBuffer(Buffer.concat(chunks)));
    });
  }
}
