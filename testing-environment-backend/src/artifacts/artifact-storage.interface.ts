import { Readable } from 'stream';

export interface ArtifactReference {
  objectKey: string;
  byteSize: number;
  checksum: string;
}

export interface PutArtifactInput {
  objectKey: string;
  data: Buffer | Readable;
}

export const ARTIFACT_STORAGE = Symbol('ARTIFACT_STORAGE');

export interface ArtifactStorage {
  put(input: PutArtifactInput): Promise<ArtifactReference>;
  get(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
  createDownloadUrl(objectKey: string): Promise<string>;
}
