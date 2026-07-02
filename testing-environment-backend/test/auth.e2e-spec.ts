import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn().mockResolvedValue({ accessToken: 'token', user: { email: 'a@b.com' } }),
    register: jest.fn(),
    me: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns an access token', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'password123' })
      .expect(201)
      .expect({ accessToken: 'token', user: { email: 'a@b.com' } });
  });
});
