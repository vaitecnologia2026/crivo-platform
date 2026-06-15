import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMentoriaRequest, MentoriaData, UpdateMentoriaRequest } from '@crivo/types';

/** Mentorias (Briefing §10) — agenda do líder. Control plane (super admin). */
@Injectable()
export class MentoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId?: string): Promise<MentoriaData[]> {
    const rows = await this.prisma.admin.mentoria.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { scheduledAt: 'desc' },
    });
    return rows.map(toData);
  }

  async getById(id: string): Promise<MentoriaData> {
    const row = await this.prisma.admin.mentoria.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Mentoria não encontrada.');
    return toData(row);
  }

  async create(dto: CreateMentoriaRequest): Promise<MentoriaData> {
    const scheduled = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      throw new BadRequestException('scheduledAt inválido.');
    }
    const row = await this.prisma.admin.mentoria.create({
      data: {
        tenantId: dto.tenantId,
        title: dto.title,
        format: dto.format,
        mentorName: dto.mentorName,
        attendee: dto.attendee,
        scheduledAt: scheduled,
        durationMin: dto.durationMin ?? 60,
        meetingUrl: dto.meetingUrl ?? null,
        location: dto.location ?? null,
        notes: dto.notes ?? null,
      },
    });
    return toData(row);
  }

  async update(id: string, dto: UpdateMentoriaRequest): Promise<MentoriaData> {
    const existing = await this.prisma.admin.mentoria.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Mentoria não encontrada.');
    const data: any = { ...dto };
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);
    const row = await this.prisma.admin.mentoria.update({ where: { id }, data });
    return toData(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.prisma.admin.mentoria.delete({ where: { id } });
    return { ok: true as const };
  }
}

function toData(row: any): MentoriaData {
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    format: row.format,
    mentorName: row.mentorName,
    attendee: row.attendee,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMin: row.durationMin,
    meetingUrl: row.meetingUrl,
    location: row.location,
    status: row.status,
    notes: row.notes,
    recordingUrl: row.recordingUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
