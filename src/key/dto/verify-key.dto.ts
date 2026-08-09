import { IsString, Length } from 'class-validator';

export class VerifyKeyDto {
  @IsString()
  @Length(1, 32)
  key: string;
}
