import type {
  FlowApiNode,
  FlowAssertNode,
  FlowNode,
  FlowPollUntilNode,
  FlowSetVariableNode,
  FlowWaitNode,
} from '../../../../types';
import type { NodeTemplateId } from '../types';
import { defaultRetryPolicy } from './flowNodeUtils';

function defaultPosition(index: number) {
  return { x: 120 + index * 48, y: 80 + index * 32 };
}

export function createApiNode(index: number, overrides?: Partial<FlowApiNode>): FlowApiNode {
  const id = `api-${Date.now()}-${index}`;
  return {
    id,
    type: 'apiRequest',
    version: 'apiRequest/v1',
    position: defaultPosition(index),
    name: `API call ${index}`,
    method: 'GET',
    path: '/',
    expectStatus: 200,
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
    ...overrides,
  };
}

export function createWaitNode(index: number, overrides?: Partial<FlowWaitNode>): FlowWaitNode {
  const id = `wait-${Date.now()}-${index}`;
  return {
    id,
    type: 'wait',
    version: 'wait/v1',
    position: defaultPosition(index),
    name: `Wait ${index}`,
    durationMs: 1000,
    timeoutMs: 60000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
    ...overrides,
  };
}

export function createPollNode(index: number, overrides?: Partial<FlowPollUntilNode>): FlowPollUntilNode {
  const id = `poll-${Date.now()}-${index}`;
  return {
    id,
    type: 'pollUntil',
    version: 'pollUntil/v1',
    position: defaultPosition(index),
    name: `Poll ${index}`,
    method: 'GET',
    path: '/',
    expectStatus: 200,
    timeoutSeconds: 30,
    intervalSeconds: 2,
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
    ...overrides,
  };
}

export function createSetVariableNode(index: number, overrides?: Partial<FlowSetVariableNode>): FlowSetVariableNode {
  const id = `set-variable-${Date.now()}-${index}`;
  return {
    id,
    type: 'setVariable',
    version: 'setVariable/v1',
    position: defaultPosition(index),
    name: `Set variable ${index}`,
    variableName: `variable_${index}`,
    value: '',
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
    ...overrides,
  };
}

export function createAssertNode(index: number, overrides?: Partial<FlowAssertNode>): FlowAssertNode {
  const id = `assert-${Date.now()}-${index}`;
  return {
    id,
    type: 'assert',
    version: 'assert/v1',
    position: defaultPosition(index),
    name: `Assert ${index}`,
    fieldPath: '$.',
    operator: 'exists',
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
    ...overrides,
  };
}

export function createNodeFromTemplate(templateId: NodeTemplateId, index: number): FlowNode {
  switch (templateId) {
    case 'health-check':
      return createApiNode(index, { name: 'Health check', method: 'GET', path: '/health', expectStatus: 200 });
    case 'create-resource':
      return createApiNode(index, { name: 'Create resource', method: 'POST', path: '/resources', expectStatus: 201 });
    case 'poll-status':
      return createPollNode(index, { name: 'Poll status', method: 'GET', path: '/status', timeoutSeconds: 60, intervalSeconds: 2 });
    case 'wait-1s':
      return createWaitNode(index, { name: 'Wait 1s', durationMs: 1000 });
    case 'assert-field':
      return createAssertNode(index, { name: 'Assert field exists', fieldPath: '$.data', operator: 'exists' });
    default:
      return createApiNode(index);
  }
}
