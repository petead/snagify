# Snagify

Dubai property inspection app (Next.js 14, Supabase, Claude).

## Requirements

- **Node.js 18.17+** (Next.js 14 needs it). Check with `node -v`.

If you use **nvm**:

```bash
nvm use 20    # or: nvm use   when in project folder (.nvmrc is set to 20)
npm run dev
```

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Env

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
