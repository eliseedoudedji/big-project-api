import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const admin = context.switchToHttp().getRequest().admin as
      { role: string } | undefined;
    if (!admin || !required.includes(admin.role)) {
      throw new ForbiddenException('Droits insuffisants');
    }
    return true;
  }
}
