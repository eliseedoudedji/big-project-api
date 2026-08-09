import { Module } from '@nestjs/common';
import { KeyService } from './key.service';
import { KeyController } from './key.controller';

@Module({
  controllers: [KeyController],
  providers: [KeyService],
})
export class KeyModule {}
