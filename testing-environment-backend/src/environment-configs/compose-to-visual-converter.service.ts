import { Injectable } from '@nestjs/common';
import { EnvironmentImportAnalyzerService } from '../environment-import/environment-import-analyzer.service';
import { ComposeAnalysisResult } from '../environment-import/types/import-analysis.types';
import {
  EnvironmentServiceConfig,
  EnvironmentVariable,
  EnvironmentVisualConfig,
} from './types/environment-visual-config.types';

export interface ComposeImportResult {
  visualConfig: EnvironmentVisualConfig;
  analysis: ComposeAnalysisResult;
  importWarnings: string[];
  unsupportedFields: string[];
}

@Injectable()
export class ComposeToVisualConverterService {
  constructor(private readonly analyzer: EnvironmentImportAnalyzerService) {}

  convert(composeYaml: string, source: 'paste' | 'upload'): ComposeImportResult {
    const analysis = this.analyzer.analyze(
      composeYaml,
      source === 'upload' ? 'UPLOAD' : 'PASTE',
    );
    const importWarnings: string[] = [];
    const unsupportedFields: string[] = [];
    const services: EnvironmentServiceConfig[] = analysis.services.map((service) => {
      if (service.volumes.length > 0) {
        unsupportedFields.push(`Service "${service.name}" volumes are not editable in visual mode`);
      }
      if (service.healthcheck) {
        importWarnings.push(`Service "${service.name}" healthcheck was detected but app healthcheck uses editor settings`);
      }
      return {
        name: service.name,
        image: service.image,
        buildContext: service.buildContext,
        buildDockerfile: service.buildDockerfile,
        ports: service.ports.map((port) => ({
          host: port.host ?? port.container,
          container: port.container,
        })),
        environment: service.environment.map(
          (entry): EnvironmentVariable => ({
            key: entry.key,
            value: entry.isSensitive ? undefined : entry.value,
            valueType: entry.isSensitive ? 'secret' : 'literal',
            secretKey: entry.isSensitive ? entry.key : undefined,
          }),
        ),
        dependsOn: service.dependencies,
      };
    });

    const mainServiceName =
      analysis.probableMainService?.serviceName ?? services[0]?.name ?? 'api';
    const visualConfig: EnvironmentVisualConfig = {
      version: '1.0',
      services,
      app: {
        mainServiceName,
        baseUrl: analysis.probableBaseUrl ?? 'http://localhost:8000',
        healthcheckPath: '/health',
        healthcheckExpectedStatus: 200,
        healthcheckTimeoutSeconds: 60,
      },
      run: {
        timeoutMinutes: 10,
        cleanup: true,
      },
    };

    if (analysis.securityWarnings.length > 0) {
      importWarnings.push(
        ...analysis.securityWarnings.map((warning) => warning.message),
      );
    }

    return {
      visualConfig,
      analysis,
      importWarnings,
      unsupportedFields,
    };
  }
}
