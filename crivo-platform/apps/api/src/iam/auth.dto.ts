import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}

/** Passo 1 da recuperação: a pessoa confirma o e-mail da conta. */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(200)
  email!: string;
}

/** Passo 3: o token do link + a senha nova. O mínimo de 8 é o mesmo de
 *  ChangePasswordDto — recuperar não pode ser um atalho para senha mais fraca. */
export class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
