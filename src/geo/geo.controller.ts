import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GeoService } from './geo.service';
import {
  VisitorsService,
  type ClientIdentity,
} from '../visitors/visitors.service';
import { ClaimCountryDto } from './dto/claim-country.dto';
import { ProbeDto } from './dto/probe.dto';
import { StepDto } from './dto/step.dto';
import { EventDto } from './dto/event.dto';
import { clientIpOf } from './geo.service';

const parseUtcOffset = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 86400 ? n : null;
};

const identityOf = (
  ip: string,
  headers: Record<string, string>,
): ClientIdentity => ({
  ip,
  clientId: headers['x-client-id']?.trim() || null,
});

@Controller('geo')
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class GeoController {
  constructor(
    private readonly geoService: GeoService,
    private readonly visitorsService: VisitorsService,
  ) {}

  @Get()
  async getGeo(@Ip() ip: string, @Headers() headers: Record<string, string>) {
    const clientIp = clientIpOf(ip, headers['x-forwarded-for']);
    const clientUtcOffset = parseUtcOffset(headers['x-client-utc-offset']);
    const clientTimezone = headers['x-client-timezone'] || null;
    const clientLang = headers['x-client-lang'] || null;

    const geo = await this.geoService.lookup(
      clientIp,
      {
        utcOffset: clientUtcOffset,
        timezone: clientTimezone,
        lang: clientLang,
      },
      headers['accept-language'] ?? null,
    );
    const { visitor } = await this.visitorsService.register(
      identityOf(clientIp, headers),
      {
        userAgent: headers['user-agent'] ?? null,
        acceptLanguage: headers['accept-language'] ?? null,
      },
      geo,
    );

    return {
      geo,
      strikes: visitor.strikes,
      banned: visitor.banned,
      attempts: visitor.attempts,
      step: visitor.step ?? null,
      claimedCountry: visitor.claimedCountry ?? null,
      keySolved: visitor.keySolved,
    };
  }

  @Post('attempt')
  async attempt(@Ip() ip: string, @Headers() headers: Record<string, string>) {
    const clientIp = clientIpOf(ip, headers['x-forwarded-for']);
    return this.visitorsService.incrementAttempts(
      identityOf(clientIp, headers),
    );
  }

  @Post('step')
  async step(
    @Ip() ip: string,
    @Headers() headers: Record<string, string>,
    @Body() dto: StepDto,
  ) {
    const clientIp = clientIpOf(ip, headers['x-forwarded-for']);
    return this.visitorsService.saveStep(
      identityOf(clientIp, headers),
      dto.step,
    );
  }

  @Post('event')
  async event(
    @Ip() ip: string,
    @Headers() headers: Record<string, string>,
    @Body() dto: EventDto,
  ) {
    const clientIp = clientIpOf(ip, headers['x-forwarded-for']);
    await this.visitorsService.recordEventForIp(
      identityOf(clientIp, headers),
      dto.type,
      dto.payload ?? undefined,
    );
    return { ok: true };
  }

  @Post('claim')
  async claim(
    @Ip() ip: string,
    @Headers() headers: Record<string, string>,
    @Body() dto: ClaimCountryDto,
  ) {
    const clientIp = clientIpOf(ip, headers['x-forwarded-for']);
    return this.visitorsService.claimCountry(
      identityOf(clientIp, headers),
      dto.code.toUpperCase(),
    );
  }

  @Post('probe')
  async probe(
    @Ip() ip: string,
    @Headers() headers: Record<string, string>,
    @Body() dto: ProbeDto,
  ) {
    const clientIp = clientIpOf(ip, headers['x-forwarded-for']);
    return this.visitorsService.recordProbe(identityOf(clientIp, headers), dto);
  }
}
