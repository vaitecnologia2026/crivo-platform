import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SaveIntegrationDto {
  @IsOptional() @IsString() @MaxLength(600)
  credential?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsBoolean()
  sandbox?: boolean;
}

export class UploadTemplateDto {
  @IsString() @MaxLength(160)
  name!: string;

  @IsString() @MaxLength(240)
  fileName!: string;

  @IsString() @MaxLength(120)
  mimeType!: string;

  @IsString()
  data!: string; // base64 do arquivo
}

export class SignContractDto {
  @IsString() @MaxLength(160)
  name!: string;

  @IsString() @MaxLength(200)
  email!: string;

  @IsString()
  templateId!: string;

  @IsOptional() @IsString() @MaxLength(500)
  message?: string;
}

export class ChargeDto {
  @IsIn(['asaas', 'mercadopago'])
  provider!: 'asaas' | 'mercadopago';

  @IsString() @MaxLength(160)
  name!: string;

  @IsString() @MaxLength(200)
  email!: string;

  @IsOptional() @IsString() @MaxLength(20)
  cpfCnpj?: string;

  @IsNumber() @Min(0)
  value!: number;

  @IsOptional() @IsString() @MaxLength(200)
  description?: string;
}
