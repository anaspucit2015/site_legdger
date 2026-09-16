# SiteLedger — Technical Documentation

> Construction Invoice Management System

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [API Reference](#8-api-reference)
9. [Invoice Lifecycle](#9-invoice-lifecycle)
10. [Role-Based Access](#10-role-based-access)
11. [Data Flow](#11-data-flow)
12. [Environment Variables](#12-environment-variables)

---

## 1. Overview

SiteLedger is a multi-role web application for managing construction site invoices. Vendors submit invoices for work done on sites, admins review and approve/reject them, and accountants release payment.

**Three user roles:**
- **Admin** — manages users, sites, tasks; approves/rejects invoices
- **Vendor** — submits and tracks invoices
- **Accountant** — reviews approved invoices and marks them paid

---

## 2. Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | NestJS v11 (Node.js) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma v5 |
| Auth | JWT (passport-jwt, @nestjs/jwt) |
| Password Hashing | bcrypt |
| Validation | class-validator + class-transformer |
| Reports | ExcelJS |
| Port | 3001 |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| State / API | Redux Toolkit + RTK Query |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| UI Primitives | Radix UI (Dialog, Label) |
| Port | 3000 |

---

## 3. Project Structure

```
site_ledger/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Full data model
│   │   └── seed.ts                # Database seeder
│   ├── src/
│   │   ├── main.ts                # Bootstrap (CORS, validation, port)
│   │   ├── app.module.ts          # Root module
│   │   ├── prisma/                # Prisma service
│   │   ├── auth/                  # Login + JWT strategy
│   │   ├── common/                # Guards + decorators
│   │   ├── users/                 # User CRUD
│   │   ├── sites/                 # Site CRUD
│   │   ├── tasks/                 # Task CRUD + rate history
│   │   ├── invoices/              # Core invoice logic
│   │   └── reports/               # Excel report generation
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── package.json
│
└── frontend/
    ├── app/
    │   ├── (auth)/login/          # Login page
    │   └── (dashboard)/           # Protected routes (with sidebar)
    │       ├── layout.tsx         # Sidebar + role-based nav
    │       ├── admin/             # Admin pages
    │       ├── vendor/            # Vendor pages
    │       └── accountant/        # Accountant pages
    ├── components/
    │   ├── ui/                    # Button, Input, Select, Modal, Table...
    │   ├── auth-guard.tsx         # Route protection
    │   ├── invoice-detail-modal.tsx
    │   ├── report-download.tsx
    │   └── status-stamp.tsx
    ├── lib/
    │   ├── auth.ts                # localStorage token helpers
    │   ├── store.ts               # Redux store
    │   └── api/                   # RTK Query API slices
    │       ├── baseApi.ts         # Base URL + auth header
    │       ├── authApi.ts
    │       ├── invoicesApi.ts
    │       ├── tasksApi.ts
    │       ├── sitesApi.ts
    │       └── usersApi.ts
    ├── next.config.ts
    └── package.json
```

### Backend Module Pattern

Every feature follows the same NestJS module structure:

```
feature/
├── feature.module.ts      # Imports, providers, exports
├── feature.controller.ts  # Routes, guards, decorators
├── feature.service.ts     # Business logic
└── feature.dto.ts         # Request validation schemas
```

---

## 4. Database Schema

**Database:** PostgreSQL via Prisma ORM

### Enums

```prisma
enum Role {
  admin
  vendor
  accountant
}

enum InvoiceStatus {
  pending
  approved
  rejected
  paid
}
```

### Models

#### User
```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String          # bcrypt hashed
  role      Role
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  invoices  Invoice[] @relation("VendorInvoices")
}
```

#### Site
```prisma
model Site {
  id        String   @id @default(cuid())
  siteCode  Int      @unique @default(autoincrement())
  name      String
  location  String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  invoices  Invoice[]
}
```

#### Task
```prisma
model Task {
  id        String   @id @default(cuid())
  name      String
  unit      String
  unitCost  Decimal?          # null = vendor enters amount manually
  isCustom  Boolean  @default(false)
  isActive  Boolean  @default(true)
  createdBy String
  createdAt DateTime @default(now())

  rateHistory TaskRateHistory[]
  invoices    Invoice[]
}
```

#### TaskRateHistory
```prisma
model TaskRateHistory {
  id        String   @id @default(cuid())
  taskId    String
  oldRate   Decimal?
  newRate   Decimal
  changedBy String
  changedAt DateTime @default(now())

  task      Task @relation(fields: [taskId], references: [id])
}
```

#### Invoice
```prisma
model Invoice {
  id                   String        @id @default(cuid())

  # Task reference (either predefined or ad-hoc custom)
  taskId               String?
  customTaskName       String?

  siteId               String
  vendorId             String

  unit                 String
  quantity             Decimal
  unitCostSnapshot     Decimal?      # Locked at submission time
  amount               Decimal       # Locked at submission time

  description          String?
  attachmentUrl        String?

  status               InvoiceStatus @default(pending)

  # Rejection
  rejectionReason      String?
  rejectionReasonOther String?

  # Delete request flow
  deleteRequested      Boolean   @default(false)
  deleteRequestedBy    String?
  deleteRequestedAt    DateTime?
  deleteApprovedBy     String?
  deleteDecisionAt     DateTime?

  # Audit trail
  submittedAt          DateTime  @default(now())
  approvedBy           String?
  approvedAt           DateTime?
  paidBy               String?
  paidAt               DateTime?
  paymentRef           String?

  syncVersion          Int       @default(1)
  updatedAt            DateTime  @updatedAt

  task    Task? @relation(fields: [taskId], references: [id])
  site    Site  @relation(fields: [siteId], references: [id])
  vendor  User  @relation("VendorInvoices", fields: [vendorId], references: [id])
}
```

---

## 5. Backend Architecture

### Entry Point — `main.ts`

```typescript
// Global validation pipe (whitelist: true strips unknown fields)
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

// CORS — allow frontend origins
app.enableCors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Port
await app.listen(process.env.PORT ?? 3001);
```

### Auth Module

**JWT Strategy** (`auth/jwt.strategy.ts`):
- Extracts token from `Authorization: Bearer <token>`
- Secret: `process.env.JWT_SECRET` (fallback: `'dev_secret'`)
- Expiry: 7 days
- Validates user is active; injects `{ id, email, role }` into `req.user`

**Auth Service** (`auth/auth.service.ts`):
- `login(dto)` — finds user by email → `bcrypt.compare` → returns JWT + user info

### Guards

| Guard | File | Purpose |
|-------|------|---------|
| `JwtAuthGuard` | `common/guards/jwt-auth.guard.ts` | Enforces a valid JWT on a route |
| `RolesGuard` | `common/guards/roles.guard.ts` | Checks `req.user.role` against `@Roles()` |

Usage on a controller:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post()
create(...) {}
```

### Modules Overview

| Module | Routes | Roles |
|--------|--------|-------|
| `AuthModule` | `POST /auth/login` | Public |
| `UsersModule` | `GET/POST/PATCH /users` | Admin |
| `SitesModule` | `GET /sites` (all), write (Admin) | All read, Admin write |
| `TasksModule` | `GET /tasks` (all), write (Admin) | All read, Admin write |
| `InvoicesModule` | Full CRUD + lifecycle | Role-based (see §10) |
| `ReportsModule` | `GET /reports/invoices` → Excel | Admin, Accountant |

---

## 6. Frontend Architecture

### Routing (Next.js App Router)

**Route groups:**

```
(auth)/          → No sidebar — login page only
(dashboard)/     → Protected layout with sidebar
```

**Admin routes:**
```
/admin                              Dashboard
/admin/invoices                     All invoices (approve/reject)
/admin/invoices/new                 Submit invoice
/admin/invoices/delete-requests     Delete request queue
/admin/my-invoices                  Own submitted invoices
/admin/tasks                        Task management
/admin/sites                        Site management
/admin/users                        User management
/admin/reports                      Report download
```

**Vendor routes:**
```
/vendor/my-invoices                 Own invoices
/vendor/invoices                    All invoices on a site
/vendor/invoices/new                Submit invoice
```

**Accountant routes:**
```
/accountant/invoices                Approved + paid invoices (release payment)
/accountant/invoices/new            Submit invoice
/accountant/my-invoices             Own invoices
/accountant/reports                 Report download
```

### Auth Guard

`components/auth-guard.tsx` wraps every dashboard page. It:
1. Reads `getToken()` and `getUser()` from localStorage
2. Redirects to `/login` if missing
3. Redirects to the correct role root if the path doesn't match the user's role

### API Layer — RTK Query

**Base config** (`lib/api/baseApi.ts`):
```typescript
baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// Auto-attach auth header
prepareHeaders: (headers) => {
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

// 401 handler → clearAuth() + redirect to /login
```

**Each API file** injects endpoints into `baseApi` with tag-based cache invalidation:

```typescript
// Example: after creating an invoice, invalidate the list cache
invalidatesTags: ['Invoice']
```

### Token Storage (`lib/auth.ts`)

| Key | Value |
|-----|-------|
| `sl_token` | JWT string |
| `sl_user` | JSON: `{ id, name, email, role }` |

Functions: `getToken()`, `getUser()`, `setAuth(token, user)`, `clearAuth()`

### UI Components (`components/ui/`)

Reusable primitives styled with Tailwind + CSS custom properties:

| Component | Purpose |
|-----------|---------|
| `Button` | Primary, outline, ghost variants; loading state |
| `Input` | Label, error, mono mode; password show/hide toggle |
| `Select` | Radix-based dropdown |
| `Modal` | Radix Dialog wrapper |
| `Table / THead / TBody / Th / Tr / Td` | Consistent table layout |
| `PageHeader` | Title + subtitle + action slot |
| `TableLoading` | Skeleton loading state |

**CSS custom properties (design tokens):**
```
--navy        #1b2a4a   (sidebar, headings)
--amber       #e8a33d   (active state, brand accent)
--rust        #c0392b   (errors, destructive)
--green       #27ae60   (approved, success)
--paper       #f5f6fa   (page background)
--border      #e2e6ef   (input borders)
--text-muted  #9aa4b8
```

---

## 7. Authentication & Authorization

### Login Flow

```
1. User submits email + password on /login
2. POST /auth/login → { accessToken, user }
3. setAuth(token, user) → stores in localStorage
4. router.replace('/admin' | '/vendor' | '/accountant')
```

### Request Flow (every API call)

```
1. RTK Query prepareHeaders reads getToken() from localStorage
2. Attaches: Authorization: Bearer <jwt>
3. Backend JwtAuthGuard validates token
4. User object { id, email, role } injected into req.user
5. RolesGuard checks @Roles() decorator (if present)
6. If 401 returned → clearAuth() + redirect /login
```

### JWT Payload

```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1700000000,
  "exp": 1700604800
}
```

---

## 8. API Reference

### Auth

```
POST /auth/login
Body:     { email: string, password: string }
Response: { accessToken: string, user: { id, name, email, role } }
```

### Users — Admin only

```
POST   /users                   Create user
GET    /users                   List all users
GET    /users/:id               Get one user
PATCH  /users/:id               Update (name, role, isActive)
DELETE /users/:id               Deactivate (sets isActive = false)
```

### Sites — All roles read, Admin write

```
GET    /sites                   All sites (including inactive)
GET    /sites/active            Active sites only
GET    /sites/:id               Single site
POST   /sites                   Create  { name, location }
PATCH  /sites/:id               Update  { name?, location?, isActive? }
DELETE /sites/:id               Deactivate
```

### Tasks — All roles read, Admin write

```
GET    /tasks                   All tasks (with rate history)
GET    /tasks?active=true       Active tasks only
GET    /tasks/:id               Single task with rate history
GET    /tasks/:id/rate-history  Rate history for a task
POST   /tasks                   Create  { name, unit, unitCost? }
PATCH  /tasks/:id               Update  { name?, unit?, unitCost?, isActive? }
DELETE /tasks/:id               Deactivate
```

### Invoices — Role-based

```
GET    /invoices
  Query params: siteId, vendorId, status, mine=true
  Admin:       all invoices, any filter combination
  Vendor:      own invoices (no siteId) OR all on a site (with siteId)
  Accountant:  approved + paid only
  mine=true:   own invoices for any role

GET    /invoices/delete-requests          Admin only — pending delete queue

GET    /invoices/:id                      Single invoice

POST   /invoices                          Create (Vendor / Admin / Accountant)
  Body (predefined task):
    { siteId, taskId, quantity, description?, attachmentUrl?, status? }
  Body (custom task):
    { siteId, customTaskName, customTaskUnit, customTaskUnitCost,
      quantity, description?, attachmentUrl?, status? }
  Note: status field only honoured when caller is Admin

PATCH  /invoices/:id                      Edit pending invoice (Vendor only)
  Body: { quantity?, amount?, description?, attachmentUrl? }

POST   /invoices/:id/approve              Approve (Admin only)

POST   /invoices/:id/reject               Reject (Admin only)
  Body: { rejectionReason, rejectionReasonOther? }
  Allowed reasons: 'Duplicate submission' | 'Incorrect quantity' |
                   'Incorrect amount' | 'Missing receipt' |
                   'Task not authorized' | 'Other'

POST   /invoices/:id/delete-request       Request delete (Vendor only, pending only)

POST   /invoices/:id/delete-request/resolve?approve=true|false   (Admin only)
  approve=true  → permanently deletes invoice
  approve=false → rejects deletion, invoice stays

POST   /invoices/:id/pay                  Release payment (Accountant only)
  Body: { paymentRef: string }
```

### Reports — Admin + Accountant

```
GET    /reports/vendors                   Active vendors list { id, name }

GET    /reports/invoices                  Download Excel report
  Query: siteId?, vendorId?, status?, dateFrom?, dateTo?
  Response: .xlsx file (invoices-report-YYYY-MM-DD.xlsx)
  Columns: ID, Site, Vendor, Task, Unit, Qty, Unit Cost, Amount,
           Status, Submitted, Approved, Paid, Payment Ref, Description
  Includes: totals row, frozen header, status-colored rows
```

---

## 9. Invoice Lifecycle

```
                    ┌─────────────────────────┐
                    │   VENDOR / ADMIN         │
                    │   POST /invoices         │
                    └────────────┬────────────┘
                                 │
                          status: pending
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
         VENDOR edits                     VENDOR requests delete
         (pending only)                   POST /invoices/:id/delete-request
         PATCH /invoices/:id                       │
                                          ┌────────┴────────┐
                                      Admin deny        Admin approve
                                     (restored)       (permanently deleted)
                │
        ┌───────┴────────┐
   ADMIN approves    ADMIN rejects
        │                │
   status: approved  status: rejected
        │
   ACCOUNTANT pays
   POST /invoices/:id/pay
        │
   status: paid
```

### Key Business Rules

| Rule | Detail |
|------|--------|
| Amount locking | `amount` and `unitCostSnapshot` are set at creation and never change |
| Edit window | Vendors can only edit invoices with `status = pending` |
| Rate history | Changing a task's `unitCost` logs a `TaskRateHistory` record but does NOT change past invoices |
| Two task types | **Predefined** (`isCustom=false`) — uses admin-set rate. **Custom** — vendor enters rate ad-hoc |
| Delete queue | Vendor marks invoice for deletion → admin sees it in queue → approves/denies |
| Payment | Only `approved` invoices can be moved to `paid` — accountant must provide a `paymentRef` |
| Admin creation | When admin submits an invoice, `status` can be set to `pending`, `approved`, or `paid` at creation |

---

## 10. Role-Based Access

### What Each Role Can Do

| Action | Admin | Vendor | Accountant |
|--------|-------|--------|------------|
| Login | ✓ | ✓ | ✓ |
| Submit invoice | ✓ | ✓ | ✓ |
| Set invoice status on create | ✓ | ✗ | ✗ |
| Edit own pending invoice | ✓ | ✓ | ✓ |
| View all invoices | ✓ | ✗ | ✗ |
| View own invoices | ✓ | ✓ | ✓ |
| View site invoices (all vendors on site) | ✓ | ✓ | ✗ |
| View approved + paid invoices | ✓ | ✗ | ✓ |
| Approve invoice | ✓ | ✗ | ✗ |
| Reject invoice | ✓ | ✗ | ✗ |
| Request invoice delete | ✓ | ✓ | ✓ |
| Resolve delete requests | ✓ | ✗ | ✗ |
| Release payment | ✗ | ✗ | ✓ |
| Manage users | ✓ | ✗ | ✗ |
| Manage sites | ✓ | ✗ | ✗ |
| Manage tasks | ✓ | ✗ | ✗ |
| Download reports | ✓ | ✗ | ✓ |

### Sidebar Navigation by Role

**Admin** sidebar:
- Dashboard
- Invoices ▾ (dropdown)
  - All Invoices
  - Delete Requests
  - My Invoices
  - Submit Invoice
- Tasks
- Sites
- Users
- Reports

**Vendor** sidebar:
- Invoices ▾ (dropdown)
  - My Invoices
  - Site Invoices
  - Submit Invoice

**Accountant** sidebar:
- Invoices ▾ (dropdown)
  - All Invoices
  - My Invoices
  - Submit Invoice
- Reports

---

## 11. Data Flow

### Vendor submits an invoice

```
1. Vendor visits /vendor/invoices/new
2. Selects site from GET /sites/active
3. Selects task from GET /tasks?active=true   (or toggles Custom Task mode)
4. Enters quantity → amount auto-calculated (unitCost × qty) and shown as preview
5. On submit: POST /invoices
   → Backend calculates and locks amount
   → Creates Invoice { status: 'pending' }
   → RTK Query invalidates ['Invoice'] cache
6. Redirected to /vendor/my-invoices
```

### Admin approves an invoice

```
1. Admin visits /admin/invoices
2. GET /invoices → all invoices fetched
3. Admin clicks approve on a pending invoice
4. POST /invoices/:id/approve
   → Backend sets status='approved', approvedBy, approvedAt
   → RTK Query invalidates cache
5. Invoice now visible to accountant
```

### Accountant releases payment

```
1. Accountant visits /accountant/invoices
2. GET /invoices → returns only approved + paid
3. Accountant enters paymentRef and confirms
4. POST /invoices/:id/pay { paymentRef }
   → Backend sets status='paid', paidBy, paidAt, paymentRef
5. Invoice marked paid in all views
```

### RTK Query Cache Invalidation

```
Mutation                    Invalidates
─────────────────────────────────────────
createInvoice               ['Invoice']
updateInvoice               ['Invoice']
approveInvoice              ['Invoice']
rejectInvoice               ['Invoice']
releasePayment              ['Invoice']
createUser                  ['User']
deactivateUser              ['User']
createSite                  ['Site']
updateSite                  ['Site']
createTask                  ['Task']
updateTask                  ['Task']
```

---

## 12. Environment Variables

### Backend — `.env`

```env
DATABASE_URL=postgresql://user:password@localhost:5432/site_ledger
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

### Frontend — `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Quick Start

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev          # runs on :3001

# Frontend
cd frontend
npm install
npm run dev                # runs on :3000
```
