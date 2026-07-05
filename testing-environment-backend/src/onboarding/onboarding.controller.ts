import {
  Body,
  Controller,
  Get,
  NotImplementedException,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AnalyzeComposeDto } from '../environment-import/dto/analyze-compose.dto';
import { EnvironmentImportAnalyzerService } from '../environment-import/environment-import-analyzer.service';
import { ConfirmOnboardingDto } from './dto/confirm-onboarding.dto';
import { UpdateOnboardingSessionDto } from './dto/update-onboarding-session.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly analyzer: EnvironmentImportAnalyzerService,
  ) {}

  @Get('session')
  session(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getOrCreateSession(user.companyId, user.id);
  }

  @Patch('session')
  updateSession(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOnboardingSessionDto) {
    return this.onboarding.updateSession(user.companyId, user.id, dto);
  }

  @Post('analyze-compose')
  analyzeCompose(@Body() dto: AnalyzeComposeDto) {
    return this.analyzer.analyze(dto.composeYaml, dto.source);
  }

  @Post('git-repository')
  gitRepositoryImport() {
    throw new NotImplementedException('Git repository import is planned for a later phase');
  }

  @Get('templates')
  templates() {
    return this.onboarding.templatesList();
  }

  @Post('confirm')
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmOnboardingDto) {
    return this.onboarding.confirm(user.companyId, user.id, dto);
  }

  @Post('demo-project')
  demoProject(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.createDemoProject(user.companyId, user.id);
  }
}
