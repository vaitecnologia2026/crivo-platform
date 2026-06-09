import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto';

// Endpoint PÚBLICO (sem AuthGuard) para a LP enviar leads direto ao pipeline.
// Protegido por segredo compartilhado (header x-intake-secret) + rate limit.
@Controller('leads')
export class LeadsIntakeController {
  constructor(private readonly leads: LeadsService) {}

  @Post('intake')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  intake(@Headers('x-intake-secret') secret: string, @Body() dto: CreateLeadDto) {
    return this.leads.intake(secret, dto);
  }
}
