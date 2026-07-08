import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateNotificationSettingDto {
  @IsOptional() @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional() @IsBoolean()
  pushEnabled?: boolean;
}

export class RegisterPushTokenDto {
  @IsString() @MaxLength(4096)
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}

/**
 * Disparo de push de TESTE (diagnóstico admin). Informe um `token` FCM direto OU
 * um `userId` (resolve os tokens do usuário). `title`/`body` são opcionais e têm
 * um texto de teste padrão.
 */
export class SendTestPushDto {
  @IsOptional() @IsString() @MaxLength(4096)
  token?: string;

  @IsOptional() @IsUUID()
  userId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  title?: string;

  @IsOptional() @IsString() @MaxLength(240)
  body?: string;
}
