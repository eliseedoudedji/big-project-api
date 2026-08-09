import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Status } from '@prisma/client';

export class UpdateVisitorDto {
  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  strikes?: number;

  @IsOptional()
  @IsString()
  @Max(2000)
  note?: string | null;
}
