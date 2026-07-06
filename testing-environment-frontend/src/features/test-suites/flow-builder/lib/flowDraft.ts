import type { FlowSuiteDefinition } from '../../../../types';
import type { FlowDraftRecord } from '../types';
import { serializeFlowForCompare } from './flowGraph';

export function shouldOfferDraftRestore(draft: FlowDraftRecord | null, currentFlow: FlowSuiteDefinition): boolean {
  if (!draft) {
    return false;
  }
  return serializeFlowForCompare(draft.flow) !== serializeFlowForCompare(currentFlow);
}
