# API C-World

Backend de **C-World** : API NestJS avec Prisma (SQLite). Elle gère la géolocalisation des visiteurs, la vérification de la clé d'accès du jeu, la revendication de pays et l'espace admin (liste, filtres, bannissement).

## Setup

```bash
npm install
cp .env.example .env   # puis éditer .env
npm run prisma:migrate # crée la base SQLite (prisma/dev.db)
npm run start:dev      # http://localhost:3000
```

## Scripts

| Commande | Description |
| --- | --- |
| `npm run start:dev` | Démarrage watch mode |
| `npm run start:prod` | Démarrage du build (`node dist/main`) |
| `npm run build` | Compilation Nest |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:e2e` | Tests unitaires / e2e |
| `npm run prisma:migrate` | Applique les migrations + régénère le client |
| `npm run prisma:deploy` | Applique les migrations en prod |
| `npm run prisma:studio` | Interface Prisma Studio |

## Configuration

Voir `.env.example` — le fichier `.env` contient : `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`, `TRUST_PROXY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ACCESS_KEY`, `MAX_STRIKES`.

Le compte admin est créé au premier démarrage à partir de `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Structure

```
src/
├── admin/      Contrôleur & service admin (visiteurs, bannissement)
├── auth/       Login admin (JWT)
├── geo/        Géolocalisation du client (IP, pays, VPN)
├── key/        Vérification de la clé d'accès du jeu
├── visitors/   Traçage des visiteurs
├── prisma/     Service Prisma
└── data/       Liste des pays
```
