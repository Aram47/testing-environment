import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { FilesystemArtifactStorage } from './filesystem-artifact-storage.service';

describe('FilesystemArtifactStorage', () => {
  const root = join(tmpdir(), `artifact-storage-${Date.now()}`);

  beforeAll(async () => {
    await mkdir(root, { recursive: true });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('puts, gets, deletes, and creates local download references', async () => {
    const storage = new FilesystemArtifactStorage({
      get: jest.fn((_key: string, fallback: string) => root ?? fallback),
    } as never);

    const reference = await storage.put({
      objectKey: 'runs/run-1/report.json',
      data: Buffer.from('{"ok":true}', 'utf8'),
    });

    expect(reference.byteSize).toBe(11);
    expect(reference.checksum).toHaveLength(64);
    await expect(storage.get(reference.objectKey)).resolves.toEqual(
      Buffer.from('{"ok":true}', 'utf8'),
    );
    await expect(storage.createDownloadUrl(reference.objectKey)).resolves.toBe(
      'artifact://runs/run-1/report.json',
    );
    await storage.delete(reference.objectKey);
    await expect(storage.get(reference.objectKey)).rejects.toThrow();
  });

  it('rejects object keys that escape the storage root', async () => {
    const storage = new FilesystemArtifactStorage({
      get: jest.fn((_key: string, fallback: string) => root ?? fallback),
    } as never);

    await expect(
      storage.put({ objectKey: '../escape.txt', data: Buffer.from('bad', 'utf8') }),
    ).rejects.toThrow('parent segments');
    await expect(storage.createDownloadUrl('/absolute/path.txt')).rejects.toThrow('relative');
  });
});
