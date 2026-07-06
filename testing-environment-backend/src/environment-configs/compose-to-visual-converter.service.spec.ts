import { EnvironmentImportAnalyzerService } from '../environment-import/environment-import-analyzer.service';
import { ComposeToVisualConverterService } from './compose-to-visual-converter.service';

describe('ComposeToVisualConverterService', () => {
  const service = new ComposeToVisualConverterService(new EnvironmentImportAnalyzerService());

  it('converts compose services into visual config', () => {
    const result = service.convert(
      `services:
  api:
    image: nginx:latest
    ports:
      - "8000:80"
    depends_on:
      - db
  db:
    image: postgres:16
`,
      'paste',
    );

    expect(result.visualConfig.services).toHaveLength(2);
    expect(result.visualConfig.app.mainServiceName).toBe('api');
    expect(result.visualConfig.services[0].ports?.[0]).toEqual({
      host: '8000',
      container: '80',
    });
  });
});
