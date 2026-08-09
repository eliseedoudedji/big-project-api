import { IsString, Matches } from 'class-validator';

export class ClaimCountryDto {
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'Le code pays doit contenir exactement 2 lettres',
  })
  code: string;
}
