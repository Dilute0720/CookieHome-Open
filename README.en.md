# CookieHome

[中文 README](./README.md)

A private family blog and home kitchen management system.

> This project was fully generated and maintained with Codex, including product planning, implementation, UI iteration, debugging, documentation, and the open-source release process.

CookieHome is designed for a small household rather than a public community. It combines meal planning, recipe management, ordering, inventory, shopping lists, family journals, and a timeline into one warm personal website.

## Tech Stack

- Next.js App Router
- TypeScript
- TailwindCSS
- Local shadcn/ui-style components
- Prisma
- SQLite for local development, PostgreSQL reserved for production
- Family password gate, with Auth.js reserved for future email/GitHub login

## Local Development

```bash
cp .env.example .env
npm install
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

The local family access password is configured through `.env`:

```env
FAMILY_ACCESS_PASSWORD="change-this-family-password"
FAMILY_AUTH_TOKEN="change-this-random-session-token"
FAMILY_AUTH_COOKIE_SECURE="false"
```

Use your own strong password and random token before deployment.

If `prisma migrate dev` fails locally with a vague `Schema engine error`, you can apply the generated initial migration instead:

```bash
npm run db:apply:init
npm run db:seed
```

## Implemented MVP

- Create, edit, delete, and upload images for dishes
- Dish library with search, category filters, tag filters, sorting, price, and summary stats
- Dish detail pages with structured ingredients, recipe steps, cooking notes, and cooking journals
- Multi-member meal ordering with a food-delivery-style browsing experience
- Menu recommendations based on inventory, recent repetition, favorite level, and cooking time
- Todo-style menu aggregation and status updates
- Family inventory management
- Automatic ingredient merging, inventory deduction, and final shopping-list generation
- Home page integration for planned meals, shopping reminders, and family updates
- Family login protection and logout

## File Storage

Local development stores uploaded files under `public/uploads`.

A unified storage interface is reserved at `lib/storage.ts`. The current driver is `FILE_STORAGE_DRIVER=local`; an OSS-compatible driver can be added later with `FILE_STORAGE_DRIVER=oss`.

## Documentation

- [Project State](./docs/PROJECT_STATE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Database](./docs/DATABASE.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Inventory Import CLI](./docs/INVENTORY_IMPORT.md)
- [Changelog](./docs/CHANGELOG.md)

## Security Notes

Do not commit real `.env` files, SQLite databases, uploaded family photos, passwords, tokens, or server addresses. The public repository intentionally uses placeholder values only.

## License

MIT
