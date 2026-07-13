# Construction Site Invoice Management System
## Functional Specification (Locked — Ready for Development)

---

## 1. System Overview

A multi-role web app (installable, works online & offline) for a construction company to manage **sites, tasks, and vendor invoices** — from submission on-site, through admin approval, to accountant-released payment.

**Roles:** Admin, Vendor, Accountant
**Currency:** PKR only (single currency, no multi-currency support)

---

## 2. Role-by-Role Feature Breakdown

### Admin
- **User Management** — create/edit/deactivate users, assign roles
- **Site Registration** — create/edit sites (name, location, status). No vendor-to-site assignment needed — access is fully open
- **Task Management** — create predefined tasks per site (name, unit, unit cost); edit/deactivate tasks. Every rate change logged in **rate history** (old rate, new rate, changed by, timestamp). New rate applies to future invoices only — past invoices always keep their locked snapshot rate
- **Invoice Approval** — approve or reject (dropdown reason + "Other" free-text option), view attached receipt photo
- **Delete Request Approval** — approves/denies vendor delete requests (pending invoices only)
- **Visibility** — sees all sites, vendors, invoices system-wide

### Vendor
- **Site Selection** — fully open; any vendor can select any active site at invoice creation time (no pre-assignment)
- **Invoice Creation:**
  - Predefined task → shows unit + rate → vendor enters quantity only → amount auto-calculates (`unitCostSnapshot × quantity`), **locked, non-editable**
  - Custom task → vendor enters task name, unit, quantity, and manually enters total amount
- **Edit / Delete (pending only)** — vendor can freely edit while status = `pending`. Cannot delete directly — submits a delete request that goes to Admin's queue. Only `pending` invoices are eligible; approved/rejected invoices are permanently locked (no edit, no delete request)
- **Attach Proof** — one receipt photo per invoice (Phase 1)
- **Status Tracking** — Pending → Approved/Rejected → Paid
- **Site-wide Visibility** — within a site, vendor sees **all invoices from all vendors** on that site (site-scoped, not vendor-scoped) — helps avoid duplicate submissions
- **Offline Submission** — works with no connectivity on-site; syncs automatically when back online

### Accountant
- **Invoice Visibility** — sees only Admin-approved invoices
- **Payment Release** — marks approved invoice as Paid, full amount, single payment (no partial payments)
- **Payment Record** — attaches payment reference/proof (bank ref, transaction ID)

---

## 3. Invoice Lifecycle

```
Vendor: Select Site + Task → PENDING
   ↓
Admin: Review → APPROVE or REJECT (with dropdown reason + optional "Other" text)
   ↓ (approve)                    ↓ (reject)
Accountant: sees approved      Vendor notified, may resubmit fresh
   ↓
Accountant: Release Payment → PAID (full amount, single payment, payment ref attached)
```

**Delete request flow (pending invoices only):**
```
Vendor: request delete on a PENDING invoice
   ↓
Admin: approve (invoice deleted) or deny (invoice stays as-is)
```

---

## 4. Data Model (Prisma-ready shape)

```prisma
model Task {
  id          String   @id @default(cuid())
  siteId      String
  name        String
  unit        String              // e.g. "sqft", "bag", "day" — present even for custom tasks
  unitCost    Decimal?            // null for custom tasks
  isCustom    Boolean  @default(false)
  createdBy   String              // adminId or vendorId
  createdAt   DateTime @default(now())
  rateHistory TaskRateHistory[]
}

model TaskRateHistory {
  id         String   @id @default(cuid())
  taskId     String
  oldRate    Decimal?
  newRate    Decimal
  changedBy  String   // adminId
  changedAt  DateTime @default(now())
}

model Invoice {
  id                  String   @id @default(cuid())
  taskId              String
  siteId              String
  vendorId            String
  unit                String              // snapshot from task at submission time
  quantity             Decimal
  unitCostSnapshot     Decimal?           // null for custom tasks; locked at submission
  amount               Decimal            // auto-calculated (predefined) or manual (custom) — locked once submitted
  description           String?
  attachmentUrl         String?            // one photo, phase 1

  status                String   @default("pending") // pending | approved | rejected | paid

  rejectionReason       String?            // dropdown value
  rejectionReasonOther  String?            // free text, only if "Other" selected

  deleteRequested       Boolean  @default(false)
  deleteRequestedBy     String?
  deleteRequestedAt     DateTime?
  deleteApprovedBy      String?            // admin who approved/denied
  deleteDecisionAt      DateTime?

  submittedAt           DateTime @default(now())
  approvedBy             String?
  approvedAt             DateTime?
  paidBy                 String?
  paidAt                 DateTime?
  paymentRef             String?

  syncVersion            Int      @default(1) // for offline conflict resolution
  updatedAt               DateTime @updatedAt
}
```

**Key rule:** `unitCostSnapshot` and `unit` are copied onto the Invoice at submission time — never recalculated from live Task data. This keeps historical invoices accurate even after rate changes.

---

## 5. Reporting Requirements

**Site-wise:** total invoices (submitted/approved/rejected/paid) per site, total spend per site, breakdown by task within a site
**Vendor-wise:** total invoices per vendor, approval/rejection rate, total amount paid per vendor
**Task-wise:** most frequently invoiced tasks, total spend per task type company-wide, custom vs. predefined ratio

**Filters:** date range, site, vendor, status — Admin sees everything; Accountant sees a financial/payment-focused view.

---

## 6. Confirmed Business Rules (Final — Locked)

- ✅ One company, multiple sites
- ✅ Vendor ↔ Site is many-to-many and fully open — no assignment/restriction feature
- ✅ Tasks: predefined by Admin, or custom (created ad-hoc by vendor)
- ✅ Predefined task amount = `unitCostSnapshot × quantity`, locked, no override
- ✅ Custom task: vendor enters unit, quantity, and manual amount
- ✅ No Site Manager/Engineer step — Vendor → Admin directly
- ✅ No partial payments — one full payment per approved invoice
- ✅ Accountant sees only Admin-approved invoices
- ✅ Full offline support for all three roles, actions sync when connectivity returns
- ✅ Single currency: PKR
- ✅ Vendor can edit pending invoices; delete requires admin-approved delete request; only pending invoices are eligible for delete requests
- ✅ Rejection reason: dropdown + "Other" free-text option
- ✅ Vendor invoice visibility is site-scoped (sees all vendors' invoices within a site)
- ✅ Task rate changes apply to future invoices only; rate history log maintained
- ✅ Notifications: out of scope for Phase 1
- ✅ One receipt photo per invoice for Phase 1

---

## 7. Tech Stack

**Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Redux Toolkit + RTK Query, `@ducanh2912/next-pwa`
**Offline/Sync:** Dexie.js (IndexedDB), `dexie-react-hooks`, custom generic sync queue (handles create/edit/status-change actions, and dependent records like custom-task-before-invoice)
**Backend:** NestJS, TypeScript, PostgreSQL, Prisma, `class-validator`/`class-transformer`, `@nestjs/passport` + JWT, role guards (`@Roles()`)
**File storage:** Cloudinary (receipt photos)
**Deployment:** Vercel (frontend), Railway/Render (backend + Postgres)

---

## 8. Suggested Build Order

1. Prisma schema + migrations (Section 4 above)
2. NestJS backend — online-only first: Users → Sites → Tasks (+ rate history) → Invoices (approve/reject/delete-request flow) → Sync endpoints
3. Next.js frontend — online-only, all three role dashboards working against the live API
4. Offline layer last — Dexie + sync queue bolted onto the working online app