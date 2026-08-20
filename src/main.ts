import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { ensureDatabaseSchema, resetFalseVpnFlags } from './prisma/bootstrap';
import { PrismaService } from './prisma/prisma.service';

const logger = new Logger('Bootstrap');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL manquante : configurez une base (SQLite local "file:./dev.db" ou PostgreSQL "postgresql://...")',
  );
}

function corsOrigins(config: ConfigService): string[] | string {
  const raw = config.get<string>('CORS_ORIGINS');
  const list = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.length === 0 || list.includes('*')) return '*';
  return list;
}

async function createApp(): Promise<NestExpressApplication> {
  await ensureDatabaseSchema();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: corsOrigins(config), credentials: false });

  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy && trustProxy !== 'false') {
    app.set('trust proxy', trustProxy === 'true' ? true : Number(trustProxy));
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.get(AuthService).ensureDefaultAdmin();

  const prisma = app.get(PrismaService);
  await resetFalseVpnFlags(prisma);

  return app;
}

async function bootstrapLocal(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  logger.log(`API C-WORLD démarrée sur http://localhost:${port}/api`);
}

void bootstrapLocal();
