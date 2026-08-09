import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminIdentity } from '../guards/jwt-auth.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminIdentity => {
    return ctx.switchToHttp().getRequest().admin;
  },
);
