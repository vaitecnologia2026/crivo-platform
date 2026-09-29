import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DecisionsService } from './decisions.service';
import {
  CreateAudienceDto,
  CreateCategoryDto,
  CreateDecisionDto,
  ListDecisionsQueryDto,
  SubmitDecisionIcdDto,
  UpdateDecisionDto,
} from './dto';
import { ICD_AXIS_QUESTIONS } from '@crivo/types';
import { AuthGuard } from '../iam/guards/auth.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { LeaderGuard } from '../iam/guards/leader.guard';
import { Roles } from '../iam/roles.decorator';
import { CurrentUser } from '../iam/current-user.decorator';
import type { SessionUser } from '@crivo/types';

// Catálogos (categorias, públicos, P1–P8) valem para qualquer papel; as rotas
// da decisão em si são conteúdo PRIVADO de Minha Jornada (LeaderGuard, depois
// do AuthGuard da classe) — "Somente Administrador" não registra decisão nem
// entra no ICD da empresa (Spec V1 v1.2 §3).
@Controller('decisions')
@UseGuards(AuthGuard, RolesGuard)
export class DecisionsController {
  constructor(private readonly decisions: DecisionsService) {}

  // ── Catálogos por-tenant ──────────────────────────────────────────────

  /** Categorias ativas (qualquer papel autenticado as vê). */
  @Get('categories')
  listCategories(@CurrentUser() user: SessionUser) {
    return this.decisions.listCategories(user.tenantId);
  }

  /** Cria nova categoria — RH/GESTOR/CEO/ADMIN. */
  @Post('categories')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  createCategory(@CurrentUser() user: SessionUser, @Body() dto: CreateCategoryDto) {
    return this.decisions.createCategory(user.tenantId, dto);
  }

  @Get('audiences')
  listAudiences(@CurrentUser() user: SessionUser) {
    return this.decisions.listAudiences(user.tenantId);
  }

  @Post('audiences')
  @Roles('RH', 'GESTOR', 'CEO', 'ADMIN')
  createAudience(@CurrentUser() user: SessionUser, @Body() dto: CreateAudienceDto) {
    return this.decisions.createAudience(user.tenantId, dto);
  }

  // ── Decisões ──────────────────────────────────────────────────────────

  /** Lista decisões.
   *  - Sem ?mine=true (default): mostra do líder logado (Anexo §11 — privacidade).
   *  - ?mine=false só vale para RH/GESTOR/CEO/ADMIN, e ainda assim devolve
   *    dados AGREGADOS (sem detalhes nominativos) — uso de filtros agregados é
   *    feito no endpoint /icd/dashboard. Aqui mantemos sempre o escopo do líder
   *    para garantir a privacidade individual. */
  @Get()
  @UseGuards(LeaderGuard)
  list(@CurrentUser() user: SessionUser, @Query() query: ListDecisionsQueryDto) {
    return this.decisions.list(user.tenantId, user.id, query, true);
  }

  /** Detalhe de uma decisão (apenas a própria). */
  @Get(':id')
  @UseGuards(LeaderGuard)
  get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.decisions.get(user.tenantId, user.id, id, true);
  }

  /** Cria uma decisão como REGISTRADA. */
  @Post()
  @UseGuards(LeaderGuard)
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateDecisionDto) {
    return this.decisions.create(user.tenantId, user.id, dto);
  }

  @Put(':id')
  @UseGuards(LeaderGuard)
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDecisionDto,
  ) {
    return this.decisions.update(user.tenantId, user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(LeaderGuard)
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.decisions.remove(user.tenantId, user.id, id);
  }

  // ── ICD da decisão (Anexo §6–§9) ──────────────────────────────────────

  /** Catálogo oficial das 8 afirmações P1-P8 para o front renderizar.
   *  Não requer ID de decisão — é o mesmo conjunto para qualquer decisão. */
  @Get('icd/questions')
  icdQuestions() {
    return ICD_AXIS_QUESTIONS;
  }

  /** Submete as 8 respostas P1-P8 da decisão. Calcula e persiste o ICD,
   *  promove a decisão para AVALIADA_PELO_ICD. Apenas o líder dono. */
  @Post(':id/icd')
  @UseGuards(LeaderGuard)
  submitIcd(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmitDecisionIcdDto,
  ) {
    return this.decisions.submitIcd(user.tenantId, user.id, id, dto);
  }

  /** ICD persistido da decisão (apenas a própria). */
  @Get(':id/icd')
  @UseGuards(LeaderGuard)
  getIcd(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.decisions.getIcd(user.tenantId, user.id, id);
  }
}
