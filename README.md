# API C-World

Backend de **C-World** : API NestJS avec Prisma (PostgreSQL). Elle gère la géolocalisation des visiteurs, la vérification de la clé d'accès du jeu, la revendication de pays et l'espace admin (liste, filtres, bannissement).

## Setup (local)

PostgreSQL est requis. Le plus simple en local est Docker :

```bash
docker run -d --name cworld-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cworld -p 5432:5432 postgres:16
```

Puis :

```bash
npm install
cp .env.example .env   # puis éditer DATABASE_URL dans .env
npm run prisma:migrate # applique les migrations sur la base PostgreSQL
npm run start:dev      # http://localhost:3000
```

> Sans Docker, tu peux pointer `DATABASE_URL` vers une base PostgreSQL hébergée (ex. celle de Render).
> Le fichier `prisma/dev.db` (ancienne base SQLite) n'est plus utilisé et peut être supprimé.

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

## Déploiement (Render)

1. Crée une base **PostgreSQL** (render.com → New → PostgreSQL).
2. Copie sa `Internal Database URL` (ou External) dans `DATABASE_URL` du service API.
3. Les migrations sont appliquées automatiquement au démarrage (`prisma migrate deploy`). En alternative, ajoute `npx prisma migrate deploy` à la fin de la commande de build du service.

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
