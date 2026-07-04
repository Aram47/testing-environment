import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: this.getMessage(body, exception),
    });
  }

  private getMessage(body: string | object | null, exception: unknown): string | object {
    if (body && typeof body === 'object') {
      return body;
    }
    if (typeof body === 'string') {
      return body;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error';
  }
}
