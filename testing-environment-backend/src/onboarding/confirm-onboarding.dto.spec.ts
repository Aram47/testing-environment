import { BadRequestException } from '@nestjs/common';
import { EnvironmentConfigType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmOnboardingDto } from './dto/confirm-onboarding.dto';
import { OnboardingService } from './onboarding.service';

const validPayload = {
  project: {
    name: 'My API',
    baseUrl: 'http://localhost:3000',
    mainServiceName: 'api',
    healthcheckPath: '/health',
    healthcheckExpectedStatus: 200,
    healthcheckTimeoutSeconds: 60,
  },
  environmentType: EnvironmentConfigType.DOCKER_COMPOSE,
  composeYaml: 'services:\n  api:\n    image: node:22',
  backendTestYaml: 'version: "1.0"\nenvironment:\n  type: "external_url"',
};

async function validateConfirmDto(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(ConfirmOnboardingDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('ConfirmOnboardingDto validation', () => {
  it('accepts healthcheck numeric fields on nested project', async () => {
    const messages = await validateConfirmDto(validPayload);

    expect(messages).toEqual([]);
  });

  it('rejects unknown top-level properties', async () => {
    const messages = await validateConfirmDto({
      ...validPayload,
      importSource: 'PASTE',
    });

    expect(messages.some((message) => message.includes('importSource'))).toBe(true);
  });

  it('rejects missing backendTestYaml', async () => {
    const { backendTestYaml: _removed, ...payload } = validPayload;

    const messages = await validateConfirmDto(payload);

    expect(messages.length).toBeGreaterThan(0);
  });
});

describe('OnboardingService confirm validation', () => {
  const service = Object.create(OnboardingService.prototype) as OnboardingService;

  it('requires composeYaml for DOCKER_COMPOSE environments', () => {
    expect(() =>
      (
        service as unknown as { validateConfirm(dto: ConfirmOnboardingDto): void }
      ).validateConfirm({
        ...validPayload,
        composeYaml: '   ',
      } as ConfirmOnboardingDto),
    ).toThrow(new BadRequestException('Docker Compose YAML is required'));
  });
});
