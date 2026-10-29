import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { OwnerController } from './presentation/controllers/owner.controller.js';
import { AuthService } from './application/services/auth.service.js';
import { LoginService } from './application/services/login.service.js';
import { RegisterService } from './application/services/register.service.js';
import { PasswordService } from './application/services/password.service.js';
import { RefreshTokenService } from './application/services/refresh-token.service.js';
import { RolesGuard } from './presentation/guards/roles.guard.js';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard.js';
import { JwtTokenService } from '../../platform/config/jwt.config.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController, OwnerController],
  providers: [
    AuthService,
    LoginService,
    RegisterService,
    RefreshTokenService,
    PasswordService,
    JwtAuthGuard,
    RolesGuard,
    JwtTokenService,
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    JwtTokenService,
    AuthService,
    LoginService,
    RegisterService,
    RefreshTokenService,
    PasswordService,
  ],
})
export class AuthModule {}
