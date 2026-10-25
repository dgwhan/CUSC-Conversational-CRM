import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSettings, JwtTokenResult, JwtUser } from './jwt.types.js';

export * from './jwt.types.js';

@Injectable()
export class JwtTokenService {
  private readonly _jwtSettings: JwtSettings;
  private readonly _jwtService: JwtService;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() jwtService?: JwtService,
  ) {
    let key = '';
    if (this.configService) {
      key = this.configService.get<string>('JWT_ACCESS_SECRET') || '';
    }
    if (!key && process.env.JWT_ACCESS_SECRET) {
      key = process.env.JWT_ACCESS_SECRET;
    }
    if (!key) {
      throw new Error(
        'Bảo mật JWT: JWT_ACCESS_SECRET không được để trống hoặc thiếu cấu hình.',
      );
    }

    let issuer = 'CUSC-Recruitment-CRM';
    if (this.configService) {
      const configuredIssuer = this.configService.get<string>('JWT_ISSUER');
      if (configuredIssuer) {
        issuer = configuredIssuer;
      }
    } else if (process.env.JWT_ISSUER) {
      issuer = process.env.JWT_ISSUER;
    }

    let audience = 'CUSC-Recruitment-CRM-Client';
    if (this.configService) {
      const configuredAudience =
        this.configService.get<string>('JWT_AUDIENCE');
      if (configuredAudience) {
        audience = configuredAudience;
      }
    } else if (process.env.JWT_AUDIENCE) {
      audience = process.env.JWT_AUDIENCE;
    }

    let expiresInMinutes = 15;
    if (this.configService) {
      const configuredExpires = this.configService.get<number>(
        'JWT_EXPIRES_IN_MINUTES',
      );
      if (configuredExpires && !Number.isNaN(Number(configuredExpires))) {
        expiresInMinutes = Number(configuredExpires);
      }
    } else if (
      process.env.JWT_EXPIRES_IN_MINUTES &&
      !Number.isNaN(Number(process.env.JWT_EXPIRES_IN_MINUTES))
    ) {
      expiresInMinutes = Number(process.env.JWT_EXPIRES_IN_MINUTES);
    }

    this._jwtSettings = {
      Key: key,
      Issuer: issuer,
      Audience: audience,
      ExpiresInMinutes: expiresInMinutes,
    };

    if (jwtService) {
      this._jwtService = jwtService;
    } else {
      this._jwtService = new JwtService();
    }
  }

  public getSettings(): JwtSettings {
    return this._jwtSettings;
  }

  public GenerateToken(user: JwtUser): JwtTokenResult {
    const expires = new Date(
      Date.now() + this._jwtSettings.ExpiresInMinutes * 60 * 1000,
    );

    let uniqueName = user.email;
    if (user.username && user.username.trim().length > 0) {
      uniqueName = user.username.trim();
    } else if (user.fullName && user.fullName.trim().length > 0) {
      uniqueName = user.fullName.trim();
    }

    const claims: Record<string, unknown> = {
      jti: randomUUID(),
      sub: user.id.toString(),
      unique_name: uniqueName,
      email: user.email,
    };

    if (user.role) {
      claims.role = user.role;
    }

    if (typeof user.tokenVersion === 'number') {
      claims.tokenVersion = user.tokenVersion;
    }

    const accessToken = this._jwtService.sign(claims, {
      secret: this._jwtSettings.Key,
      issuer: this._jwtSettings.Issuer,
      audience: this._jwtSettings.Audience,
      expiresIn: `${this._jwtSettings.ExpiresInMinutes}m`,
    });

    const tokenResult: JwtTokenResult = {
      accessToken: accessToken,
      expiresAt: expires,
      ExpiresAt: expires,
    };

    return tokenResult;
  }

  public generateToken(user: JwtUser): JwtTokenResult {
    return this.GenerateToken(user);
  }
}
