import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { QueryVisitorsDto } from './dto/query-visitors.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import type { AdminIdentity } from '../common/guards/jwt-auth.guard';

@Controller('admin/visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  list(@Query() query: QueryVisitorsDto) {
    return this.adminService.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.adminService.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVisitorDto,
    @CurrentAdmin() admin: AdminIdentity,
  ) {
    return this.adminService.update(id, dto, admin.username);
  }

  @Post(':id/ban')
  ban(@Param('id') id: string, @CurrentAdmin() admin: AdminIdentity) {
    return this.adminService.ban(id, admin.username);
  }

  @Post(':id/unban')
  unban(@Param('id') id: string, @CurrentAdmin() admin: AdminIdentity) {
    return this.adminService.unban(id, admin.username);
  }

  @Post(':id/integrate')
  @Roles('superadmin', 'admin')
  integrate(@Param('id') id: string, @CurrentAdmin() admin: AdminIdentity) {
    return this.adminService.integrate(id, admin.username);
  }

  @Delete(':id')
  @Roles('superadmin')
  remove(@Param('id') id: string, @CurrentAdmin() admin: AdminIdentity) {
    return this.adminService.remove(id, admin.username);
  }
}
