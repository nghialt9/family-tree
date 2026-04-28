# family-tree
All tasks are now complete. Here's what was just added:

  Dockerfile — 3-stage build:
  1. node:20-alpine builds the Vue frontend (npm run build)
  2. node:20-alpine compiles the TypeScript backend (prisma generate + tsc)
  3. Production image copies dist/ + public/ (frontend) + node_modules, runs prisma migrate deploy && node
  dist/server.js on start

  fly.toml — app = justinlam-familytree, region sin (Singapore), persistent volume at /data/uploads, HTTPS
  auto-redirect, auto-stop/start machines

  .github/workflows/deploy.yml — replaced the old GCP SSH workflow with flyctl deploy --remote-only triggered on
  push to main

  backend/tsconfig.json — now includes prisma/seed.ts so tsc compiles the seed script to dist/seed.js (run it with
  flyctl ssh console -C "node dist/seed.js")

  ---
  Steps you need to run once to go live:

  # 1. Install flyctl and login
  iwr https://fly.io/install.ps1 -useb | iex
  flyctl auth login

  # 2. Create app, postgres, and volume
  flyctl apps create justinlam-familytree
  flyctl postgres create --name justinlam-familytree-db --region sin
  flyctl postgres attach justinlam-familytree-db --app justinlam-familytree
  flyctl volumes create uploads --app justinlam-familytree --region sin --size 1

  # 3. Set JWT secret
  flyctl secrets set JWT_SECRET="$(openssl rand -hex 32)" JWT_EXPIRES_IN="30d" --app justinlam-familytree

  # 4. Get a deploy token for GitHub Actions
  flyctl tokens create deploy --name github-actions
  # → copy the token into GitHub repo Settings → Secrets → FLY_API_TOKEN

  # 5. Push to deploy
  git push origin main
  # GitHub Actions will build + deploy automatically

  # 6. Seed the Lâm family data
  flyctl ssh console --app justinlam-familytree -C "node dist/seed.js"

  After step 5 the app will be live at https://justinlam-familytree.fly.dev.