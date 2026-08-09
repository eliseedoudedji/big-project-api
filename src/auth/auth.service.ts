import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin) throw new UnauthorizedException('Identifiants invalides');

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');

    const accessToken = await this.jwtService.signAsync(
      { username: admin.username, role: admin.role },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ??
          '2h') as JwtSignOptions['expiresIn'],
      },
    );

    return {
      accessToken,
      admin: { username: admin.username, role: admin.role },
    };
  }

  /**
   * Crée le compte admin par défaut au premier démarrage (identifiants via .env).
   */
  async ensureDefaultAdmin(): Promise<void> {
    const username = this.config.get<string>('ADMIN_USERNAME');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!username || !password) {
      this.logger.warn(
        'ADMIN_USERNAME / ADMIN_PASSWORD non définis : aucun admin par défaut créé.',
      );
      return;
    }
    const exists = await this.prisma.admin.findUnique({ where: { username } });
    if (exists) return;

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.admin.create({
      data: { username, passwordHash, role: 'superadmin' },
    });
    this.logger.log(`Compte admin « ${username} » créé (superadmin).`);
  }
}
