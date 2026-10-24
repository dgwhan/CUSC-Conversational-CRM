import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';

@Controller()
export class AdminController {
  @Get('admin-only')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getAdminOnly(): { ok: true } {
    return { ok: true };
  }
}
