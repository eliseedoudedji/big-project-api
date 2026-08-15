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

/**
 * Identité d'un visiteur côté serveur.
 * `clientId` (UUID stocké en localStorage) prime sur l'IP : il permet de
 * distinguer plusieurs appareils derrière une même IP (proxy/NAT/Render).
 */
export type ClientIdentity = {
  ip: string;
  clientId?: string | null;
};

export type ProbePayload = {
  probe?: Record<string, unknown> | null;
  signals?: Record<string, unknown> | null;
  vpn?: boolean;
  vpnReason?: string | null;
};

type Resolved = { visitor: Visitor; isNew: boolean };

@Injectable()
export class VisitorsService {
  private readonly logger = new Logger(VisitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly geoService: GeoService,
  ) {}

  /**
   * Résout le visiteur : priorité au `clientId`, puis à l'IP en fallback
   * (compatibilité avec les visiteurs enregistrés avant cette version).
   */
  async getOrCreate(
    identity: ClientIdentity,
    meta: VisitorMeta = {},
  ): Promise<Visitor> {
    const { visitor } = await this.resolve(identity, meta);
    return visitor;
  }

  async getOrCreateByIp(ip: string, meta: VisitorMeta = {}): Promise<Visitor> {
    return this.getOrCreate({ ip }, meta);
  }

  private async resolve(
    identity: ClientIdentity,
    meta: VisitorMeta,
  ): Promise<Resolved> {
    const { ip, clientId } = identity;
    const metaData = {
      userAgent: meta.userAgent ?? null,
      acceptLanguage: meta.acceptLanguage ?? null,
    };

    if (clientId) {
      const byClient = await this.prisma.visitor.findUnique({
        where: { clientId },
      });
      if (byClient) {
        const visitor = await this.prisma.visitor.update({
          where: { id: byClient.id },
          data: { ip, ...mergeMeta(byClient, metaData) },
        });
        return { visitor, isNew: false };
      }

      const byIp = await this.prisma.visitor.findUnique({ where: { ip } });
      if (byIp) {
        const visitor = await this.prisma.visitor.update({
          where: { id: byIp.id },
          data: { clientId, ...mergeMeta(byIp, metaData) },
        });
        return { visitor, isNew: false };
      }

      const visitor = await this.prisma.visitor.create({
        data: { ip, clientId, ...metaData },
      });
      return { visitor, isNew: true };
    }

    const existing = await this.prisma.visitor.findUnique({ where: { ip } });
    if (existing) {
      const visitor = await this.prisma.visitor.update({
        where: { id: existing.id },
        data: mergeMeta(existing, metaData),
      });
      return { visitor, isNew: false };
    }

    const visitor = await this.prisma.visitor.create({
      data: { ip, ...metaData },
    });
    return { visitor, isNew: true };
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
    identity: ClientIdentity,
    type: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const visitor = await this.getOrCreate(identity);
    this.recordEvent(visitor.id, type, payload);
  }

  async incrementAttempts(
    identity: ClientIdentity,
  ): Promise<{ attempts: number }> {
    const visitor = await this.getOrCreate(identity);
    const updated = await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: { attempts: { increment: 1 } },
    });
    this.recordEvent(updated.id, 'attempt', { attempts: updated.attempts });
    return { attempts: updated.attempts };
  }

  async saveStep(
    identity: ClientIdentity,
    step: string,
  ): Promise<{ step: string }> {
    const visitor = await this.getOrCreate(identity);
    await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: { step },
    });
    return { step };
  }

  async recordProbe(
    identity: ClientIdentity,
    payload: ProbePayload,
  ): Promise<{ vpn: boolean; vpnReason: string | null }> {
    const visitor = await this.getOrCreate(identity);

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
    identity: ClientIdentity,
    meta: VisitorMeta,
    geo: GeoResult,
  ): Promise<{ visitor: Visitor; isNew: boolean }> {
    const { visitor, isNew } = await this.resolve(identity, meta);

    const updated = await this.prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        countryCode: geo.countryCode || visitor.countryCode,
        countryName: geo.countryName || visitor.countryName,
        geoRaw: geoRawOf(visitor, geo),
      },
    });

    if (isNew)
      this.recordEvent(updated.id, 'registration', {
        geo: geo.countryCode ?? null,
      });

    return { visitor: updated, isNew };
  }

  async claimCountry(
    identity: ClientIdentity,
    code: string,
  ): Promise<ClaimResult> {
    const visitor = await this.getOrCreate(identity);
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
      const geo = await this.geoService.lookup(identity.ip);
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

function mergeMeta(
  existing: { userAgent: string | null; acceptLanguage: string | null },
  meta: { userAgent: string | null; acceptLanguage: string | null },
): { userAgent: string | null; acceptLanguage: string | null } {
  return {
    userAgent: meta.userAgent ?? existing.userAgent,
    acceptLanguage: meta.acceptLanguage ?? existing.acceptLanguage,
  };
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
