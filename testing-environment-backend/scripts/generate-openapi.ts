import { writeFile } from 'fs/promises';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OpenApiDocumentFactory } from '../src/openapi';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    const document = OpenApiDocumentFactory.create(app);
    await writeFile(join(process.cwd(), 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

generateOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
