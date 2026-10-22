import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

@Controller()
export class AdminController {
  @Get('admin-only')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getAdminOnly(): { ok: true } {
    return { ok: true };
  }
}
