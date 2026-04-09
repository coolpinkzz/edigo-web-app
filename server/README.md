# EduRapid Server

Express + TypeScript + MongoDB API boilerplate.

## Setup

### 1. Install dependencies

```bash
cd server && npm install
```

### 2. Environment variables

Copy the example env file and edit as needed:

```bash
cp .env.example .env
```

### 3. Run MongoDB

Ensure MongoDB is running locally (or update `MONGODB_URI` in `.env`).

### 4. Start the server

**Development** (with hot reload):

```bash
npm run dev
```

**Production** (build then run):

```bash
npm run build
npm start
```

## Endpoints

### Public

- `GET /health` - Health check
- `GET /` - API info
- `POST /auth/signup` - Create tenant + admin user
- `POST /auth/login` - Login (returns JWT)

### Protected (Bearer token required)

- `GET /auth/me` - Current user info
- `POST /auth/invite` - Invite user (TENANT_ADMIN+)

### Auth Flow

1. **Signup**: Creates new tenant (org) + admin user. Same email can exist in different tenants.
2. **Login**: Requires `tenantSlug` to identify which org to login into.
3. **JWT payload**: `userId`, `tenantId`, `role`, `email`. Use for RBAC.

### Roles (RBAC)

- `SUPER_ADMIN` - Cross-tenant
- `TENANT_ADMIN` - Admin within tenant
- `STAFF` - Manage students, fees, payments
- `VIEWER` - Read-only

## Structure

```
server/
├── src/
│   ├── config/          # Env config, Swagger
│   ├── db/              # MongoDB connection
│   ├── middleware/      # Auth, RBAC, Joi validate()
│   ├── modules/
│   │   ├── auth/        # Models, auth service, controller, validation stub
│   │   └── student/     # Model, service, controller, Joi validation
│   ├── routes/          # HTTP routers (auth, student)
│   ├── types/           # Roles, Express augment
│   ├── utils/           # tenantSchema helper
│   ├── app.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── .env.example
```
