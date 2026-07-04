import { BadRequestException } from '@nestjs/common';
import { ExecutionPlanCompilerService } from './execution-plan-compiler.service';
import { VisualDslMigratorService } from './visual-dsl-migrator.service';
import { YamlSuiteAdapterService } from './yaml-suite-adapter.service';

describe('ExecutionPlanCompilerService', () => {
  let service: ExecutionPlanCompilerService;

  beforeEach(() => {
    service = new ExecutionPlanCompilerService(
      new VisualDslMigratorService(),
      new YamlSuiteAdapterService(),
    );
  });

  it('compiles legacy visual API nodes to execution-plan/v1', () => {
    const result = service.compileVisual({
      version: '1.0',
      suiteName: 'Legacy',
      nodes: [
        {
          id: 'legacy',
          position: { x: 0, y: 0 },
          name: 'Legacy API',
          method: 'GET',
          path: '/legacy',
        },
      ],
      edges: [],
    });

    expect(result.executionPlan).toMatchObject({
      schemaVersion: 'execution-plan/v1',
      suiteRevisionId: 'draft',
      steps: [
        expect.objectContaining({
          id: 'legacy',
          type: 'apiRequest',
          version: 'apiRequest/v1',
          config: expect.objectContaining({ method: 'GET', path: '/legacy' }),
        }),
      ],
      dependencies: { legacy: [] },
    });
    expect(result.yamlContent).toContain('request:');
  });

  it('rejects branching visual flows', () => {
    expect(() =>
      service.compileVisual({
        version: '1.1',
        suiteName: 'Branching',
        nodes: [
          { id: 'start', type: 'wait', position: { x: 0, y: 0 }, name: 'Start', durationMs: 1 },
          { id: 'left', position: { x: 1, y: 0 }, name: 'Left', method: 'GET', path: '/left' },
          { id: 'right', position: { x: 1, y: 1 }, name: 'Right', method: 'GET', path: '/right' },
        ],
        edges: [
          { id: 'start-left', source: 'start', target: 'left' },
          { id: 'start-right', source: 'start', target: 'right' },
        ],
      }),
    ).toThrow('Branching flows are not supported yet');
  });

  it('imports YAML steps into a deterministic execution plan and export', () => {
    const yamlContent = [
      'suite: Async',
      'tests:',
      '  - id: login',
      '    name: Login',
      '    request:',
      '      method: post',
      '      path: /login',
      '      save:',
      '        token: $.token',
      '  - id: wait',
      '    type: wait',
      '    name: Wait',
      '    wait:',
      '      duration_ms: 100',
      '  - id: poll',
      '    type: pollUntil',
      '    name: Poll',
      '    poll:',
      '      timeout_seconds: 5',
      '      interval_seconds: 1',
      '      request:',
      '        method: GET',
      '        path: /jobs/1',
      '        expect:',
      '          assertions:',
      '            - field_path: $.status',
      '              operator: equals',
      '              expected_value: done',
    ].join('\n');

    const first = service.compileRawYaml(yamlContent, { suiteRevisionId: 'revision-1' });
    const second = service.compileRawYaml(yamlContent, { suiteRevisionId: 'revision-1' });

    expect(first.executionPlan.steps.map((step) => step.type)).toEqual([
      'apiRequest',
      'wait',
      'pollUntil',
    ]);
    expect(first.executionPlan.variables).toEqual([
      { name: 'token', sourceStepId: 'login', path: '$.token' },
    ]);
    expect(first.executionPlan.dependencies).toEqual({
      login: [],
      poll: ['wait'],
      wait: ['login'],
    });
    expect(first.yamlContent).toBe(second.yamlContent);
  });

  it('rejects unsupported YAML step types', () => {
    expect(() =>
      service.compileRawYaml(
        [
          'suite: Unsupported',
          'tests:',
          '  - id: branch',
          '    type: branch',
          '    name: Branch',
        ].join('\n'),
      ),
    ).toThrow(BadRequestException);
  });
});
