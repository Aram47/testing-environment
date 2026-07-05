import { ImportParseInput, ImportParseResult } from '../../types/api-import.types';

export interface ApiImportParser {
  parse(input: ImportParseInput): ImportParseResult;
}
