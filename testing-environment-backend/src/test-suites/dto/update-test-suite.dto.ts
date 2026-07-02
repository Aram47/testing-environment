import { PartialType } from '@nestjs/swagger';
import { CreateTestSuiteDto } from './create-test-suite.dto';

export class UpdateTestSuiteDto extends PartialType(CreateTestSuiteDto) {}
