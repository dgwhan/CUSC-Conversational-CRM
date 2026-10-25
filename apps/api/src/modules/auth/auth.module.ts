import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { OwnerController } from './presentation/controllers/owner.controller.js';
import { AuthService } from './application/services/auth.service.js';
import { RolesGuard } from './presentation/guards/roles.guard.js';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard.js';
import { JwtTokenService } from '../../platform/config/jwt.config.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController, OwnerController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, JwtTokenService],
  exports: [JwtAuthGuard, RolesGuard, JwtTokenService],
})
export class AuthModule {}
