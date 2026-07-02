import yaml from 'js-yaml';

export class YamlValidator {
  static validate(value: string): { ok: true } | { ok: false; message: string } {
    try {
      yaml.load(value);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Invalid YAML',
      };
    }
  }
}
