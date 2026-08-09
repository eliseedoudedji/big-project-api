import { Global, Module } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { GeoService } from '../geo/geo.service';

@Global()
@Module({
  providers: [VisitorsService, GeoService],
  exports: [VisitorsService, GeoService],
})
export class VisitorsModule {}
