import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  VisitorsService,
  type ClientIdentity,
} from '../visitors/visitors.service';

@Injectable()
export class KeyService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly visitorsService: VisitorsService,
  ) {}

  async verify(
    identity: ClientIdentity,
    key: string,
  ): Promise<{ ok: boolean; correct: number }> {
    const visitor = await this.visitorsService.getOrCreate(identity);
    if (visitor.banned) return { ok: false, correct: 0 };

    const expected = (
      this.config.get<string>('ACCESS_KEY') ?? ''
    ).toUpperCase();
    const entered = (key ?? '').toUpperCase();
    const ok = entered.length > 0 && entered === expected;

    let correct = 0;
    for (let i = 0; i < expected.length; i++) {
      if (entered[i] === expected[i]) correct++;
    }

    const failedCount = await this.prisma.visitorEvent.count({
      where: { visitorId: visitor.id, type: 'key_failed' },
    });

    this.visitorsService.recordEvent(
      visitor.id,
      ok ? 'key_success' : 'key_failed',
      {
        attempts: failedCount + 1,
        correct,
      },
    );

    if (ok) {
      await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: { keySolved: true, step: 'level3' },
      });
    }

    return { ok, correct };
  }
}
