import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type AdminIdentity = {
  id: string;
  username: string;
  role: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentification requise');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        username: string;
        role: string;
      }>(auth.slice(7), { secret: this.config.get<string>('JWT_SECRET') });
      request.admin = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      } satisfies AdminIdentity;
      return true;
    } catch {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
  }
}
