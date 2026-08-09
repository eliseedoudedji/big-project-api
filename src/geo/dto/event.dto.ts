import { IsObject, IsOptional, IsString } from 'class-validator';

export class EventDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
