import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { MentoriasService } from './mentorias.service';
import { ActionTemplatesService } from './action-templates.service';
import { EditableTextsService } from './editable-texts.service';
import { GlobalAcademyService } from './global-academy.service';
import {
  MENTORIA_FORMATS,
  MENTORIA_STATUSES,
  type PlatformAdmin,
} from '@crivo/types';

// ── DTOs ──────────────────────────────────────────────────────────────

class CreateMentoriaDto {
  @IsUUID() tenantId!: string;
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsEnum(MENTORIA_FORMATS) format!: (typeof MENTORIA_FORMATS)[number];
  @IsString() @MinLength(2) @MaxLength(120) mentorName!: string;
  @IsString() @MinLength(2) @MaxLength(160) attendee!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsInt() @Min(15) @Max(480) durationMin?: number;
  @IsOptional() @IsString() @MaxLength(400) meetingUrl?: string;
  @IsOptional() @IsString() @MaxLength(240) location?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

class UpdateMentoriaDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsEnum(MENTORIA_FORMATS) format?: (typeof MENTORIA_FORMATS)[number];
  @IsOptional() @IsString() @MaxLength(120) mentorName?: string;
  @IsOptional() @IsString() @MaxLength(160) attendee?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsInt() @Min(15) @Max(480) durationMin?: number;
  @IsOptional() @IsString() @MaxLength(400) meetingUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(240) location?: string | null;
  @IsOptional() @IsEnum(MENTORIA_STATUSES) status?: (typeof MENTORIA_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(400) recordingUrl?: string | null;
}

class ListMentoriasQuery {
  @IsOptional() @IsUUID() tenantId?: string;
}

class UpsertActionTemplateDto {
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsString() @MinLength(2) @MaxLength(60) category!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(160) suggestedResponsible?: string;
  @IsOptional() @IsString() @MaxLength(400) expectedEvidence?: string;
  @IsOptional() @IsInt() @Min(1) @Max(365) defaultReviewDays?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class ListActionTemplatesQuery {
  @IsOptional() @IsString() @MaxLength(60) category?: string;
}

class UpsertEditableTextDto {
  @IsString() @MinLength(2) @MaxLength(80) key!: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsString() @MaxLength(20000) content!: string;
}

class ListEditableTextsQuery {
  @IsOptional() @IsString() @MaxLength(40) category?: string;
}

class UpsertGlobalAcademyDto {
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsString() @MinLength(2) @MaxLength(30) kind!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(400) url?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() published?: boolean;
}

class ListGlobalAcademyQuery {
  @IsOptional() @IsString() @MaxLength(30) kind?: string;
  @IsOptional() @IsBoolean() publishedOnly?: boolean;
}

// ── Mentorias ─────────────────────────────────────────────────────────

@Controller('admin/mentorias')
@UseGuards(SuperAdminGuard)
export class MentoriasController {
  constructor(private readonly svc: MentoriasService) {}

  @Get()
  list(@Query() q: ListMentoriasQuery) {
    return this.svc.list(q.tenantId);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.getById(id);
  }

  @Post()
  create(@Body() dto: CreateMentoriaDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMentoriaDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}

// ── Action Templates (Biblioteca de Ações) ───────────────────────────

@Controller('admin/action-templates')
@UseGuards(SuperAdminGuard)
export class ActionTemplatesController {
  constructor(private readonly svc: ActionTemplatesService) {}

  @Get()
  list(@Query() q: ListActionTemplatesQuery) {
    return this.svc.list(q.category);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.getById(id);
  }

  @Post()
  create(@Body() dto: UpsertActionTemplateDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpsertActionTemplateDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}

// ── Editable Texts (Copy editável) ───────────────────────────────────

@Controller('admin/editable-texts')
@UseGuards(SuperAdminGuard)
export class EditableTextsController {
  constructor(private readonly svc: EditableTextsService) {}

  @Get()
  list(@Query() q: ListEditableTextsQuery) {
    return this.svc.list(q.category);
  }

  @Get(':key')
  getByKey(@Param('key') key: string) {
    return this.svc.getByKey(key);
  }

  /** Upsert por key — usa email do super admin como audit trail. */
  @Put()
  upsert(@Body() dto: UpsertEditableTextDto, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.upsert(dto, admin?.email);
  }

  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.svc.remove(key);
  }
}

// ── Global Academy Content ───────────────────────────────────────────

@Controller('admin/global-academy')
@UseGuards(SuperAdminGuard)
export class GlobalAcademyController {
  constructor(private readonly svc: GlobalAcademyService) {}

  @Get()
  list(@Query() q: ListGlobalAcademyQuery) {
    return this.svc.list({ kind: q.kind, publishedOnly: q.publishedOnly });
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.getById(id);
  }

  @Post()
  create(@Body() dto: UpsertGlobalAcademyDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpsertGlobalAcademyDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}
