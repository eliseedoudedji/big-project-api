import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class ProbeDto {
  @IsOptional()
  @IsObject()
  probe?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  signals?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  vpn?: boolean;

  @IsOptional()
  @IsString()
  vpnReason?: string;
}
