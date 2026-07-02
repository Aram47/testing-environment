import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { BackendTestFile, TestSuiteFile } from './types/yaml-test.types';

@Injectable()
export class YamlTestParserService {
  parseBackendTest(content: string): BackendTestFile {
    const parsed = yaml.load(content) as BackendTestFile;
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('Invalid backend-test.yml');
    }
    return parsed;
  }

  parseSuite(content: string): TestSuiteFile {
    const parsed = yaml.load(content) as TestSuiteFile;
    if (!parsed?.suite || !Array.isArray(parsed.tests)) {
      throw new BadRequestException('Invalid test suite YAML');
    }
    return parsed;
  }
}
