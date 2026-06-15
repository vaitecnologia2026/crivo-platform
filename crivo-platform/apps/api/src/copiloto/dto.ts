import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CopilotoAskRequest } from '@crivo/types';

export class AskCopilotoDto implements CopilotoAskRequest {
  @IsString() @MaxLength(2000)
  question!: string;

  @IsOptional() @IsObject()
  context?: CopilotoAskRequest['context'];
}
