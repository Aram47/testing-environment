import { Module } from '@nestjs/common';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { OnboardingCoreModule } from '../onboarding/onboarding-core.module';
import { ExecutionPlanCompilerModule } from '../test-suites/execution-plan-compiler.module';
import { SecretsCoreModule } from '../secrets/secrets-core.module';
import { TestRunStateModule } from '../test-runs/test-run-state.module';
import { RealtimeCoreModule } from '../websocket/realtime-core.module';
import { AssertionEngineService } from './assertion-engine.service';
import { DockerComposeManagerService } from './docker-compose-manager.service';
import { HealthcheckService } from './healthcheck.service';
import { HttpTestExecutorService } from './http-test-executor.service';
import { RunnerOrchestratorService } from './runner-orchestrator.service';
import { VariableStoreService } from './variable-store.service';
import { YamlTestParserService } from './yaml-test-parser.service';

@Module({
  imports: [
    RealtimeCoreModule,
    TestRunStateModule,
    ExecutionPlanCompilerModule,
    SecretsCoreModule,
    ArtifactsModule,
    OnboardingCoreModule,
  ],
  providers: [
    AssertionEngineService,
    DockerComposeManagerService,
    HealthcheckService,
    HttpTestExecutorService,
    RunnerOrchestratorService,
    VariableStoreService,
    YamlTestParserService,
  ],
  exports: [
    AssertionEngineService,
    DockerComposeManagerService,
    HealthcheckService,
    RunnerOrchestratorService,
    VariableStoreService,
    YamlTestParserService,
  ],
})
export class RunnerModule {}
