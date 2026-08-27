import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { AiCustomPromptsService } from './ai-custom-prompts.service';

class CreateAiCustomPromptDto {
  @IsString() @MaxLength(160)
  name!: string;

  @IsString()
  body!: string;

  @IsOptional() @IsString() @MaxLength(80)
  instrumentSlug?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  instrumentSlugs?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  addonIds?: string[];

  @IsOptional() @IsBoolean()
  active?: boolean;
}

class UpdateAiCustomPromptDto {
  @IsOptional() @IsString() @MaxLength(160)
  name?: string;

  @IsOptional() @IsString()
  body?: string;

  @IsOptional() @IsString() @MaxLength(80)
  instrumentSlug?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  instrumentSlugs?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  addonIds?: string[];

  @IsOptional() @IsBoolean()
  active?: boolean;
}

class AddPromptFileDto {
  @IsString() @MaxLength(240)
  filename!: string;

  @IsString() @MaxLength(120)
  mimeType!: string;

  @IsString()
  dataBase64!: string;
}

class TestPromptDto {
  @IsOptional() @IsString() @MaxLength(4000)
  question?: string;
}

/**
 * Prompts personalizados da IA (Super Admin · IA da Plataforma · Prompts e
 * Políticas). Rotas sob /admin/ai/custom-prompts (após o prefixo /api).
 * Super admin only.
 */
@Controller('admin/ai/custom-prompts')
@UseGuards(SuperAdminGuard)
export class AiCustomPromptsController {
  constructor(private readonly svc: AiCustomPromptsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get('instrument-options')
  instrumentOptions() {
    return this.svc.instrumentOptions();
  }

  @Post()
  create(@Body() dto: CreateAiCustomPromptDto, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.create(dto, { id: admin.id, email: admin.email });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAiCustomPromptDto,
    @CurrentAdmin() admin: PlatformAdmin,
  ) {
    return this.svc.update(id, dto, { id: admin.id, email: admin.email });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.remove(id, { id: admin.id, email: admin.email });
  }

  @Post(':id/files')
  addFile(
    @Param('id') id: string,
    @Body() dto: AddPromptFileDto,
    @CurrentAdmin() admin: PlatformAdmin,
  ) {
    return this.svc.addFile(id, dto, { id: admin.id, email: admin.email });
  }

  @Delete(':id/files/:fileId')
  removeFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentAdmin() admin: PlatformAdmin,
  ) {
    return this.svc.removeFile(id, fileId, { id: admin.id, email: admin.email });
  }

  @Post(':id/test')
  test(@Param('id') id: string, @Body() dto: TestPromptDto) {
    return this.svc.test(id, dto.question);
  }
}
