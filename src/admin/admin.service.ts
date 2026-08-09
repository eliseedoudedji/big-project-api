import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryVisitorsDto } from './dto/query-visitors.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';

const LIST_SELECT = {
  id: true,
  ip: true,
  userAgent: true,
  acceptLanguage: true,
  countryCode: true,
  countryName: true,
  claimedCountry: true,
  vpn: true,
  vpnReason: true,
  strikes: true,
  banned: true,
  status: true,
  attempts: true,
  keySolved: true,
  note: true,
  firstSeenAt: true,
  lastSeenAt: true,
  createdAt: true,
} satisfies Prisma.VisitorSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryVisitorsDto) {
    const { page = 1, limit = 20, q, status } = query;
    const where: Prisma.VisitorWhereInput = {};
    if (status) where.status = status;
    if (q && q.trim()) {
      const term = q.trim();
      where.OR = [
        { ip: { contains: term } },
        { countryName: { contains: term } },
        { claimedCountry: { contains: term } },
        { userAgent: { contains: term } },
        { note: { contains: term } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.visitor.count({ where }),
    ]);

    const grouped = await this.prisma.visitor.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const stats = {
      total: 0,
      byStatus: Object.fromEntries(
        grouped.map((g) => [g.status, g._count._all]),
      ),
    };
    for (const count of Object.values(stats.byStatus)) stats.total += count;

    return { items, total, page, limit, stats };
  }

  async getById(id: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 100 } },
    });
    if (!visitor) throw new NotFoundException('Visiteur introuvable');
    return visitor;
  }

  async update(id: string, dto: UpdateVisitorDto, adminName: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException('Visiteur introuvable');

    const data: Prisma.VisitorUpdateInput = {};
    if (dto.status) {
      data.status = dto.status;
      data.banned = dto.status === Status.BANNED;
    }
    if (dto.strikes !== undefined) data.strikes = dto.strikes;
    if (dto.note !== undefined) data.note = dto.note || null;

    const updated = await this.prisma.visitor.update({ where: { id }, data });
    if (dto.status && dto.status !== visitor.status) {
      await this.recordEvent(id, 'admin_status_change', {
        from: visitor.status,
        to: dto.status,
        by: adminName,
      });
    }
    return updated;
  }

  async ban(id: string, adminName: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException('Visiteur introuvable');
    const updated = await this.prisma.visitor.update({
      where: { id },
      data: { banned: true, status: Status.BANNED },
    });
    await this.recordEvent(id, 'admin_ban', { by: adminName });
    return updated;
  }

  async unban(id: string, adminName: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException('Visiteur introuvable');
    const updated = await this.prisma.visitor.update({
      where: { id },
      data: { banned: false, status: Status.ACTIVE },
    });
    await this.recordEvent(id, 'admin_unban', { by: adminName });
    return updated;
  }

  async integrate(id: string, adminName: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException('Visiteur introuvable');
    const updated = await this.prisma.visitor.update({
      where: { id },
      data: { banned: false, status: Status.INTEGRATED },
    });
    await this.recordEvent(id, 'admin_integrate', { by: adminName });
    return updated;
  }

  async remove(id: string, adminName: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException('Visiteur introuvable');
    await this.recordEvent(id, 'admin_delete', { by: adminName });
    await this.prisma.visitor.delete({ where: { id } });
    return { deleted: true };
  }

  private recordEvent(
    visitorId: string,
    type: string,
    payload?: Record<string, unknown>,
  ): void {
    void this.prisma.visitorEvent
      .create({
        data: {
          visitorId,
          type,
          payload: payload ? JSON.stringify(payload) : null,
        },
      })
      .catch(() => undefined);
  }
}
