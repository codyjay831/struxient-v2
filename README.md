# Struxient

Execution-first operations platform.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: PostgreSQL + Prisma
- **Auth**: Clerk

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)
- Clerk account (for authentication)

### Setup

1. **Clone and install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your values.

3. **Start PostgreSQL (via Docker)**

   ```bash
   docker run --name struxient-db \
     -e POSTGRES_USER=struxient \
     -e POSTGRES_PASSWORD=struxient_dev \
     -e POSTGRES_DB=struxient_v2 \
     -p 5432:5432 \
     -d postgres:16
   ```

4. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema changes (no migration) |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/              # API routes
│   ├── (app)/            # Authenticated application core
│   │   ├── (fullbleed)/workstation # Work Station Manager Dashboard (v1)
│   ├── sign-in/          # Auth pages
│   └── sign-up/
├── components/
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Utilities
└── middleware.ts         # Clerk auth middleware

prisma/
├── schema.prisma         # Database schema
└── migrations/           # Migration files
```

## Authentication

Clerk is configured for authentication. To enable:

1. Create an account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your API keys to `.env`:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

For local development without keys, Clerk runs in "keyless mode".

## Database

The project uses Prisma with PostgreSQL. Key commands:

```bash
# Generate client after schema changes
npm run db:generate

# Create and apply migrations
npm run db:migrate

# Open database GUI
npm run db:studio
```

## Health Check

A health check endpoint is available at `/api/health`:

```bash
curl http://localhost:3000/api/health
# Returns: {"status":"ok","database":"connected"}
```
