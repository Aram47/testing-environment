import { Response } from 'express';
import { ExecutionContextService } from './execution-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  it('preserves incoming request id and exposes it on the response', () => {
    const context = { run: jest.fn((_context, callback: () => void) => callback()) };
    const response = { setHeader: jest.fn() };
    const next = jest.fn();
    const middleware = new RequestContextMiddleware(context as unknown as ExecutionContextService);

    middleware.use(
      {
        headers: { 'x-request-id': 'request-1' },
        params: { projectId: 'project-1', runId: 'run-1' },
        user: { companyId: 'company-1' },
      } as never,
      response as unknown as Response,
      next,
    );

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'request-1');
    expect(context.run).toHaveBeenCalledWith(
      {
        requestId: 'request-1',
        companyId: 'company-1',
        projectId: 'project-1',
        runId: 'run-1',
      },
      next,
    );
  });

  it('generates a request id when the caller does not provide one', () => {
    const context = { run: jest.fn((_context, callback: () => void) => callback()) };
    const response = { setHeader: jest.fn() };
    const middleware = new RequestContextMiddleware(context as unknown as ExecutionContextService);

    middleware.use({ headers: {}, params: {} } as never, response as unknown as Response, jest.fn());

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
    expect(context.run).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.any(String) }),
      expect.any(Function),
    );
  });
});
