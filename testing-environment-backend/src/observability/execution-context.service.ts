import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { ExecutionContextData } from './execution-context.types';

@Injectable()
export class ExecutionContextService {
  private readonly storage = new AsyncLocalStorage<ExecutionContextData>();

  run<T>(context: ExecutionContextData, callback: () => T): T {
    return this.storage.run({ ...this.current(), ...context }, callback);
  }

  current(): ExecutionContextData {
    return this.storage.getStore() ?? {};
  }

  merge(context: ExecutionContextData): void {
    const current = this.storage.getStore();
    if (!current) {
      return;
    }
    Object.assign(current, this.withoutEmptyValues(context));
  }

  snapshot(overrides: ExecutionContextData = {}): ExecutionContextData {
    return this.withoutEmptyValues({ ...this.current(), ...overrides });
  }

  private withoutEmptyValues(context: ExecutionContextData): ExecutionContextData {
    return Object.fromEntries(
      Object.entries(context).filter(([, value]) => typeof value === 'string' && value.length > 0),
    ) as ExecutionContextData;
  }
}
