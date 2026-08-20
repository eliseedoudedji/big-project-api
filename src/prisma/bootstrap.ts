import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const execFileAsync = promisify(execFile);

const logger = new Logger('Bootstrap');

/**
 * Applique les migrations Prisma au démarrage si le schéma est absent.
 * Idempotent et indispensable pour les déploiements serverless (Render)
 * où la commande de build ne garantit pas l'exécution de `prisma migrate deploy`.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  const root = process.cwd();
  const isSqlite = (process.env.DATABASE_URL ?? '').startsWith('file:');
  const schemaPath = isSqlite
    ? join(root, 'prisma', 'sqlite', 'schema.prisma')
    : join(root, 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath)) {
    logger.warn(
      `Schéma Prisma introuvable à ${schemaPath} : migrations ignorées.`,
    );
    return;
  }

  const prismaBin = join(root, 'node_modules', '.bin', 'prisma');
  const cmd = existsSync(prismaBin) ? prismaBin : 'npx';
  const args = existsSync(prismaBin)
    ? ['migrate', 'deploy', '--schema', schemaPath]
    : ['prisma', 'migrate', 'deploy', '--schema', schemaPath];

  try {
    await execFileAsync(cmd, args, {
      cwd: root,
      env: process.env,
      timeout: 120_000,
    });
    logger.log(
      `Migrations appliquées (${isSqlite ? 'SQLite' : 'PostgreSQL'}).`,
    );
  } catch (err) {
    logger.error(
      `Échec des migrations (${isSqlite ? 'SQLite' : 'PostgreSQL'}) : ${(err as Error).message}`,
    );
    throw err;
  }
}

/**
 * Réinitialise les faux positifs VPN (webrtc_proxy) pour les visiteurs non bannis.
 * Les vrais VPN seront redétectés au prochain `postProbe`.
 */
export async function resetFalseVpnFlags(prisma: PrismaService): Promise<void> {
  try {
    const result = await prisma.visitor.updateMany({
      where: { vpn: true, banned: false },
      data: { vpn: false, vpnReason: null },
    });
    if (result.count > 0) {
      logger.log(
        `${result.count} visiteur(s) débloqué(s) (reset faux positifs VPN).`,
      );
    }
  } catch (err) {
    logger.warn(`Reset VPN ignoré : ${(err as Error).message}`);
  }
}
