import { IsString } from 'class-validator';

export class StepDto {
  @IsString()
  step: string;
}
