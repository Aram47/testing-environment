import { MODULE_METADATA } from '@nestjs/common/constants';
import { RunnerWorkerModule } from './runner-worker.module';
import { TestRunStateModule } from './test-runs/test-run-state.module';

describe('RunnerWorkerModule', () => {
  it('imports durable test run state for worker job failure handling', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RunnerWorkerModule) as unknown[];

    expect(imports).toContain(TestRunStateModule);
  });
});
