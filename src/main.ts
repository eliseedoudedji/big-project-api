import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  const origins = (
    config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: false });

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
  app.enableShutdownHooks();

  await app.get(AuthService).ensureDefaultAdmin();

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  logger.log(`API C-WORLD démarrée sur http://localhost:${port}/api`);
}

void bootstrap();
