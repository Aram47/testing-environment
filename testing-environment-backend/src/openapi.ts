import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export class OpenApiDocumentFactory {
  static create(app: INestApplication): OpenAPIObject {
    const config = new DocumentBuilder()
      .setTitle('Backend Test Runner API')
      .setDescription('MVP backend control plane and local runner engine.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    return SwaggerModule.createDocument(app, config);
  }
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, OpenApiDocumentFactory.create(app));
}
