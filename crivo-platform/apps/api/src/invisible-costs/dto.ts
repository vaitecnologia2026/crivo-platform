import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class CostItemDto {
  @IsString() @MaxLength(40)
  key!: string;

  @IsString() @MaxLength(120)
  label!: string;

  @IsOptional() @IsString() @MaxLength(120)
  indicator?: string;

  @IsNumber()
  variation!: number;

  @IsNumber()
  volume!: number;

  @IsNumber()
  unitCost!: number;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

class ScenariosDto {
  @IsNumber() @Min(0)
  conservador!: number;

  @IsNumber() @Min(0)
  moderado!: number;

  @IsNumber() @Min(0)
  otimista!: number;
}

export class SaveInvisibleCostsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CostItemDto)
  items!: CostItemDto[];

  @ValidateNested() @Type(() => ScenariosDto)
  scenarios!: ScenariosDto;

  @IsOptional() @IsIn(['ALTA', 'MEDIA', 'BAIXA'])
  confidence?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}
