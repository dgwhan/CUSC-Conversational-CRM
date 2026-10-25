import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';

@Controller()
export class OwnerController {
  @Get('owner-only')
  @Roles('OWNER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getOwnerOnly(): { ok: true } {
    return { ok: true };
  }
}
