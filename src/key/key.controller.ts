import { Body, Controller, Headers, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { KeyService } from './key.service';
import { VerifyKeyDto } from './dto/verify-key.dto';
import { clientIpOf } from '../geo/geo.service';
import type { ClientIdentity } from '../visitors/visitors.service';

@Controller('key')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class KeyController {
  constructor(private readonly keyService: KeyService) {}

  @Post('verify')
  async verify(
    @Ip() ip: string,
    @Headers() headers: Record<string, string>,
    @Body() dto: VerifyKeyDto,
  ) {
    const identity: ClientIdentity = {
      ip: clientIpOf(ip, headers['x-forwarded-for']),
      clientId: headers['x-client-id']?.trim() || null,
    };
    return this.keyService.verify(identity, dto.key);
  }
}
