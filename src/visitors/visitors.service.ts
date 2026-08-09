import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Status, type Visitor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService, GeoResult } from '../geo/geo.service';
import { isCountryClaimValid } from '../data/countries';

export type ClaimResult = {
  ok: boolean;
  strikes: number;
  banned: boolean;
  vpn: boolean;
  realCountry: string;
};

export type VisitorMeta = {
  userAgent?: string | null;
  acceptLanguage?: string | null;
};

export type ProbePayload = {
  probe?: Record<string, unknown> | null;
  signals?: Record<string, unknown> | null;
  vpn?: boolean;
  vpnReason?: string | null;
};

@Injectable()
export class VisitorsService {
  private readonly logger = new Logger(VisitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly geoService: GeoService,
  ) {}

  async getOrCreateByIp(ip: string, meta: VisitorMeta = {}) {
    const existing = await this.prisma.visitor.findUnique({ where: { ip } });
    if (existing) {
      return this.prisma.visitor.update({
        where: { ip },
        data: {
          userAgent: meta.userAgent ?? existing.userAgent,
          acceptLanguage: meta.acceptLanguage ?? existing.acceptLanguage,
        },
      });
    }
    return this.prisma.visitor.create({
      data: {
        ip,
        userAgent: meta.userAgent ?? null,
        acceptLanguage: meta.acceptLanguage ?? null,
      },
    });
  }

  recordEvent(
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
      .catch((err) =>
        this.logger.warn(
          `Impossible d'enregistrer l'événement ${type}: ${err}`,
        ),
      );
  }

  async recordEventForIp(
    ip: string,
    type: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const visitor = await this.getOrCreateByIp(ip);
    this.recordEvent(visitor.id, type, payload);
  }

  async incrementAttempts(ip: string): Promise<{ attempts: number }> {
    const visitor = await this.getOrCreateByIp(ip);
    const updated = await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: { attempts: { increment: 1 } },
    });
    this.recordEvent(updated.id, 'attempt', { attempts: updated.attempts });
    return { attempts: updated.attempts };
  }

  async saveStep(ip: string, step: string): Promise<{ step: string }> {
    const visitor = await this.getOrCreateByIp(ip);
    await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: { step },
    });
    return { step };
  }

  async recordProbe(
    ip: string,
    payload: ProbePayload,
  ): Promise<{ vpn: boolean; vpnReason: string | null }> {
    const visitor = await this.getOrCreateByIp(ip);

    const vpn = payload.vpn === true;
    const vpnReason =
      vpn &&
      typeof payload.vpnReason === 'string' &&
      payload.vpnReason.length > 0
        ? payload.vpnReason
        : null;

    await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        fingerprint: JSON.stringify({
          probe: payload.probe ?? null,
          signals: payload.signals ?? null,
          vpn,
          vpnReason,
          detectedAt: new Date().toISOString(),
        }),
        vpn,
        vpnReason,
      },
    });

    if (vpn && !visitor.vpn) {
      this.recordEvent(visitor.id, 'vpn_detected', {
        reason: vpnReason ?? null,
        source: 'client_probe',
        signals: payload.signals ?? null,
      });
    } else if (!vpn && visitor.vpn) {
      this.recordEvent(visitor.id, 'vpn_cleared', {});
    }

    return { vpn, vpnReason };
  }

  async register(
    ip: string,
    meta: VisitorMeta,
    geo: GeoResult,
  ): Promise<{ visitor: Visitor; isNew: boolean }> {
    const existing = await this.prisma.visitor.findUnique({ where: { ip } });
    const isNew = !existing;
    const visitor = existing
      ? await this.prisma.visitor.update({
          where: { ip },
          data: {
            userAgent: meta.userAgent ?? existing.userAgent,
            acceptLanguage: meta.acceptLanguage ?? existing.acceptLanguage,
            countryCode: geo.countryCode || existing.countryCode,
            countryName: geo.countryName || existing.countryName,
            geoRaw: geoRawOf(existing, geo),
          },
        })
      : await this.prisma.visitor.create({
          data: {
            ip,
            userAgent: meta.userAgent ?? null,
            acceptLanguage: meta.acceptLanguage ?? null,
            countryCode: geo.countryCode || null,
            countryName: geo.countryName || null,
            geoRaw: JSON.stringify({
              ip: geo.ip,
              countryCode: geo.countryCode,
              countryName: geo.countryName,
            }),
          },
        });

    if (isNew)
      this.recordEvent(visitor.id, 'registration', {
        geo: geo.countryCode ?? null,
      });

    return { visitor, isNew };
  }

  async claimCountry(ip: string, code: string): Promise<ClaimResult> {
    const visitor = await this.getOrCreateByIp(ip);
    const realCountry = visitor.countryName ?? 'inconnu';

    if (visitor.banned) {
      return {
        ok: false,
        strikes: visitor.strikes,
        banned: true,
        vpn: false,
        realCountry,
      };
    }

    let geoCode = visitor.countryCode;
    if (!geoCode) {
      const geo = await this.geoService.lookup(ip);
      await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: {
          countryCode: geo.countryCode || null,
          countryName: geo.countryName || null,
        },
      });
      geoCode = geo.countryCode || null;
    }

    const valid = isCountryClaimValid(code, geoCode);
    if (valid) {
      this.recordEvent(visitor.id, 'country_claim', { code, valid: true });
      await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: { claimedCountry: code },
      });
      return {
        ok: true,
        strikes: visitor.strikes,
        banned: false,
        vpn: false,
        realCountry,
      };
    }

    const maxStrikes = this.maxStrikes();
    const strikes = visitor.strikes + 1;
    const banned = strikes >= maxStrikes;
    const updated = await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        strikes,
        banned,
        status: banned ? Status.BANNED : visitor.status,
        claimedCountry: code,
      },
    });
    this.recordEvent(updated.id, banned ? 'banned' : 'geo_warning', {
      code,
      realCountry,
      strikes,
      maxStrikes,
    });

    return {
      ok: false,
      strikes,
      banned,
      vpn: false,
      realCountry: realCountryOf(updated),
    };
  }

  private maxStrikes(): number {
    const value = Number(this.config.get<string>('MAX_STRIKES') ?? 3);
    return Number.isFinite(value) && value > 0 ? value : 3;
  }
}

function geoRawOf(
  existing: { geoRaw: string | null },
  geo: GeoResult,
): string | null {
  let prev: Record<string, unknown> = {};
  if (existing.geoRaw) {
    try {
      prev = JSON.parse(existing.geoRaw) as Record<string, unknown>;
    } catch {
      prev = {};
    }
  }
  return JSON.stringify({
    ...prev,
    ip: geo.ip,
    countryCode: geo.countryCode,
    countryName: geo.countryName,
    vpn: geo.vpn,
    vpnReason: geo.vpnReason ?? null,
    updatedAt: new Date().toISOString(),
  });
}

function realCountryOf(v: { countryName: string | null }): string {
  return v.countryName ?? 'inconnu';
}
