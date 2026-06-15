import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateIcdCycleDto {
  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsInt()
  @Min(2024)
  @Max(2100)
  year!: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}
