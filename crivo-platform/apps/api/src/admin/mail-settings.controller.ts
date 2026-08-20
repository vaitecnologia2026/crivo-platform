import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { MailSettingsService } from './mail-settings.service';

class SaveMailSettingsDto {
  /** true = as mensagens passam a sair por esta conta; false = voltam ao ambiente. */
  @IsBoolean()
  enabled!: boolean;

  @IsString() @MaxLength(200)
  host!: string;

  @IsInt() @Min(1) @Max(65535)
  port!: number;

  @IsBoolean()
  secure!: boolean;

  @IsString() @MaxLength(200)
  username!: string;

  /**
   * Opcional em conta que já existe: vazio mantém a senha atual. O painel nunca
   * recebe a senha de volta, então não teria como reenviá-la a cada gravação.
   */
  @IsOptional() @IsString() @MaxLength(200)
  password?: string;

  @IsOptional() @IsString() @MaxLength(120)
  fromName?: string | null;

  @IsEmail()
  fromEmail!: string;
}

/**
 * Governança · E-mail de envio — conta que dispara as mensagens da plataforma
 * (senha de acesso do cliente, Relatório Preliminar com o e-book em anexo e
 * convite de campanha do ICD). Rotas sob /admin/mail-settings (após o prefixo
 * /api). Super admin only.
 */
@Controller('admin/mail-settings')
@UseGuards(SuperAdminGuard)
export class MailSettingsController {
  constructor(private readonly svc: MailSettingsService) {}

  /** Configuração atual — a senha NUNCA volta, só a dica dos 4 últimos dígitos. */
  @Get()
  get() {
    return this.svc.get();
  }

  /** Grava a conta. Autentica no servidor antes de persistir. */
  @Put()
  save(@Body() dto: SaveMailSettingsDto, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.save(dto, { id: admin.id, email: admin.email });
  }
}
