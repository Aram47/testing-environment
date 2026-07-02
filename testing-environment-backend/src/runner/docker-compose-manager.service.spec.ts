import { BadRequestException } from '@nestjs/common';
import { DockerComposeManagerService } from './docker-compose-manager.service';

describe('DockerComposeManagerService', () => {
  const service = new DockerComposeManagerService();

  it('rejects privileged containers', () => {
    expect(() =>
      service.validateCompose(`
services:
  api:
    image: node:22
    privileged: true
`),
    ).toThrow(BadRequestException);
  });

  it('rejects docker socket mounts', () => {
    expect(() =>
      service.validateCompose(`
services:
  api:
    image: node:22
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
`),
    ).toThrow(BadRequestException);
  });
});
