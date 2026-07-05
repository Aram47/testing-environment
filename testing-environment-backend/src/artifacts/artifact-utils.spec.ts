import {
  gunzipBuffer,
  gzipBuffer,
  previewJson,
  sanitizeArtifactKeySegment,
  truncateTextByBytes,
} from './artifact-utils';

describe('artifact utils', () => {
  it('compresses and decompresses buffers', async () => {
    const compressed = await gzipBuffer(Buffer.from('hello artifact', 'utf8'));
    await expect(gunzipBuffer(compressed)).resolves.toEqual(Buffer.from('hello artifact', 'utf8'));
  });

  it('truncates text and JSON previews by bytes', () => {
    expect(truncateTextByBytes('abcdef', 3)).toEqual({ preview: 'abc', truncated: true });
    expect(previewJson({ value: 'abcdef' }, 8)).toEqual({
      preview: '{\n  "val',
      truncated: true,
    });
  });

  it('sanitizes artifact key path segments', () => {
    expect(sanitizeArtifactKeySegment('../step/id "x"', 'fallback')).toBe('.._step_id_x');
    expect(sanitizeArtifactKeySegment('', 'fallback')).toBe('fallback');
  });
});
