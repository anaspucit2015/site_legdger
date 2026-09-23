# Vendor Payment Management System
## Feature Specification — v2.0

*Status: Awaiting client confirmation before implementation begins*
*v2.0 replaces the per-invoice settlement model (v1.1) with a fully decoupled model —
see Section 0 for what changed and why.*

---

## 0. What Changed From v1.1 → v2.0

**v1.1 model:** Paying an invoice/bill *was* the settlement action — accountant chose CASH / ADVANCE / BALANCE at the moment of payment, per document.

**v2.0 model (this version):** Approving an invoice/bill is now a purely **debt-recording** event — it automatically credits the vendor's outstanding balance, with no method choice. Actually paying the vendor happens entirely separately, in a dedicated **Payment section**, as a lump-sum action against the vendor's overall balance — never tied to a specific invoice or bill.

This removes settlement-method selection from the approval flow entirely and collapses invoice/bill status down to just `pending → approved / rejected` (no "paid" state).

**Confirmed decisions for v2.0:**
1. Approved is the final state for an invoice/bill — no separate "paid" status.
2. Advance does **not** auto-offset outstanding balance as invoices are approved. A new manual **Apply Advance to Balance** action lets the accountant choose when to net them.
3. Vendor payments may carry an optional free-text reference note (e.g. "roughly covers invoices #42, #45") but this is **not** a real database link to specific invoices — purely informational.

---

## 1. Overview

A vendor financial ledger and payment system for SiteLedger, fully decoupled from the invoice/bill approval workflow. Every vendor has a running **Outstanding Balance** and **Advance Balance**; all actual cash movement (advances, applying advance, and vendor payments) happens through a dedicated Payment / Vendor Ledger section.

---

## 2. Core Concepts

### 2.1 Vendor Financial Position

| Balance | Meaning |
|---|---|
| **Outstanding Balance** | Total amount we owe the vendor. Increases automatically whenever an invoice or bill is approved. Decreases when the accountant makes a payment, or applies advance to it. |
| **Advance Balance** | Cash given to the vendor upfront, not yet applied against outstanding balance. Increases when advance is given. Decreases when advance is applied. |
| **Net Payable** | `Outstanding Balance − Advance Balance` — informational only; does not auto-net. |

### 2.2 What Happens on Approval (No Settlement Choice)

```
Admin approves Invoice/Bill (with a linked vendor)
        ↓
vendor.outstandingBalance += invoice.amount
        ↓
VendorTransaction created { type: INVOICE_APPROVED | BILL_APPROVED }
        ↓
Invoice/Bill status = 'approved'  ← this is now the final state
```

Invoices/bills with **no vendor linked** are approved normally but skip the balance credit and VendorTransaction creation entirely (nothing to credit against).

### 2.3 Payment Section — Three Vendor-Level Actions

| Action | Effect |
|---|---|
| **Give Advance** | `advanceBalance += amount`. Cash handed to vendor upfront. |
| **Apply Advance to Balance** | `advanceBalance -= amount`, `outstandingBalance -= amount`. Manual netting — accountant decides when. Capped at `min(advanceBalance, outstandingBalance)`. |
| **Pay Vendor** | `outstandingBalance -= amount`. Real cash payment, using a structured payment method. Optional free-text reference note. Capped at `outstandingBalance` (cannot overpay). |

None of these three actions reference a specific invoice or bill — they operate purely on the vendor's aggregate balances.

---

## 3. Full Transaction Flow Example

```
Step 1: Invoice #42, PKR 120,000, approved
        → vendor.outstandingBalance = 120,000
        → VendorTransaction { type: INVOICE_APPROVED, amount: 120,000 }

Step 2: Bill #7, PKR 80,000, approved
        → vendor.outstandingBalance = 200,000
        → VendorTransaction { type: BILL_APPROVED, amount: 80,000 }

Step 3: Accountant gives vendor an advance of PKR 50,000
        → vendor.advanceBalance = 50,000
        → VendorTransaction { type: ADVANCE_GIVEN, amount: 50,000 }

Step 4: Accountant applies PKR 50,000 of advance to outstanding balance
        → vendor.advanceBalance = 0
        → vendor.outstandingBalance = 150,000   (200,000 − 50,000)
        → VendorTransaction { type: ADVANCE_APPLIED, amount: 50,000 }

Step 5: Accountant pays vendor PKR 150,000 via Bank Transfer
        POST /vendors/:id/pay
        { amount: 150,000, paymentMethod: 'BANK_TRANSFER',
          paymentRef: 'TXN-778', note: 'Covers invoice #42, bill #7' }
        → vendor.outstandingBalance = 0
        → VendorTransaction { type: VENDOR_PAYMENT, amount: 150,000 }

Final state: outstandingBalance = 0, advanceBalance = 0, Net Payable = 0
```

---

## 4. Database Changes

### 4.1 Enums

```prisma
enum VendorTxnType {
  ADVANCE_GIVEN        // Cash advance handed to vendor
  INVOICE_APPROVED     // Invoice approved -> outstanding balance credited
  BILL_APPROVED        // Bill approved -> outstanding balance credited
  ADVANCE_APPLIED      // Manual: advance netted against outstanding balance
  VENDOR_PAYMENT       // Real cash payment made to vendor
  REVERSAL             // Offsetting entry correcting a prior transaction
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  CHEQUE
  JAZZCASH_EASYPAISA
}
```

> **Removed from v1.1:** `SettlementMethod` enum, and the `settlementMethod` field on Invoice/Bill — no longer needed since approval no longer involves a settlement choice.

### 4.2 `VendorTransaction` Model

```prisma
model VendorTransaction {
  id                    String            @id @default(cuid())
  vendorId              String
  type                  VendorTxnType

  amount                Decimal           @db.Decimal(12, 2)

  // Populated only for VENDOR_PAYMENT rows
  paymentMethod         PaymentMethod?
  paymentRef            String?           // Transaction ID / Cheque No. + Bank / Platform Ref, per method
  invoiceReferenceNote  String?           // Free text only -- NOT a real link to any invoice/bill

  // Populated only for INVOICE_APPROVED / BILL_APPROVED rows
  invoiceId             String?
  billId                String?

  // Populated only for REVERSAL rows
  reversesId            String?

  // Running balance snapshot at the moment this transaction was created
  outstandingAfter      Decimal           @db.Decimal(12, 2)
  advanceAfter           Decimal          @db.Decimal(12, 2)

  notes                  String?
  performedById           String
  createdAt               DateTime        @default(now())

  vendor      Vendor             @relation(fields: [vendorId], references: [id])
  invoice     Invoice?           @relation(fields: [invoiceId], references: [id])
  bill        Bill?              @relation(fields: [billId], references: [id])
  performedBy User               @relation(fields: [performedById], references: [id])
  reverses    VendorTransaction? @relation("Reversal", fields: [reversesId], references: [id])
}
```

### 4.3 `Vendor` Model — unchanged from v1.1

```prisma
model Vendor {
  // ... existing fields unchanged ...
  currentBalance   Decimal  @default(0)  // Outstanding Balance
  advanceBalance   Decimal  @default(0)  // Advance given, not yet applied
  transactions     VendorTransaction[]
}
```

### 4.4 `Invoice` / `Bill` Models

```prisma
model Invoice {
  // ... existing fields unchanged ...
  // settlementMethod REMOVED -- no longer applicable
  transactions      VendorTransaction[]
  // status enum simplifies to: pending | approved | rejected
}

model Bill {
  // ... existing fields unchanged ...
  // settlementMethod REMOVED
  transactions      VendorTransaction[]
  // status enum simplifies to: pending | approved | rejected
}
```

---

## 5. API Endpoints

### 5.1 Modified — Approval Endpoints Now Credit Balance

```
POST /invoices/:id/approve     (admin only -- unchanged role)
POST /bills/:id/approve        (admin only -- unchanged role)

New business logic (in addition to existing approve logic):
  - If invoice/bill has a linked vendorId:
      - vendor.outstandingBalance += amount   (row-level locked, see Section 8.1)
      - Create VendorTransaction { type: INVOICE_APPROVED | BILL_APPROVED }
  - If no vendorId: approve normally, skip balance/transaction creation
  - Wrapped in a single Prisma $transaction for atomicity
```

### 5.2 Removed

```
POST /invoices/:id/pay   -- REMOVED, no longer exists
POST /bills/:id/pay      -- REMOVED, no longer exists
```

### 5.3 Payment Section — New / Modified Endpoints

#### Give Vendor Advance -- unchanged from v1.1
```
POST /vendors/:id/advance
Roles: admin, accountant
Body: { amount: number, notes?: string }
```

#### Apply Advance to Balance -- NEW
```
POST /vendors/:id/apply-advance
Roles: admin, accountant
Body: { amount: number, notes?: string }

Validations:
  - amount > 0
  - amount <= vendor.advanceBalance
  - amount <= vendor.outstandingBalance
    (cannot apply more than either balance actually has)

Effect:
  - vendor.advanceBalance -= amount
  - vendor.outstandingBalance -= amount
  - Creates VendorTransaction { type: ADVANCE_APPLIED }
```

#### Pay Vendor -- replaces `pay-balance`
```
POST /vendors/:id/pay
Roles: admin, accountant
Body: {
  amount: number,
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'JAZZCASH_EASYPAISA',
  paymentRef?: string,           // required for BANK_TRANSFER / CHEQUE / JAZZCASH_EASYPAISA, optional for CASH
  invoiceReferenceNote?: string, // free text only, e.g. "covers invoices #42, #45"
  notes?: string
}

Validations:
  - amount > 0
  - amount <= vendor.outstandingBalance (cannot overpay -- blocked, per earlier decision)
  - paymentRef required unless paymentMethod === 'CASH'

Effect:
  - vendor.outstandingBalance -= amount
  - Creates VendorTransaction { type: VENDOR_PAYMENT, paymentMethod, paymentRef, invoiceReferenceNote }
```

#### Reverse a Transaction -- unchanged concept from v1.1
```
POST /vendors/transactions/:id/reverse
Roles: admin, accountant
Body: { reason: string }

Creates an offsetting VendorTransaction { type: REVERSAL, reversesId }.
Applies inverse balance effect. Original row is never edited or deleted.

Note: reversing an INVOICE_APPROVED / BILL_APPROVED transaction undoes only
the balance credit -- it does NOT change the invoice/bill's status back to
pending. See Open Question 1 below.
```

#### Vendor Transaction Ledger & Statement -- unchanged shape from v1.1
```
GET /vendors/:id/transactions?page=1&limit=20
GET /vendors/:id/statement
```

---

## 6. Role Permissions Summary

| Action | Admin | Accountant | Site Supervisor |
|---|:---:|:---:|:---:|
| Approve invoice/bill (now also credits vendor balance) | Yes | No | No |
| Give vendor advance | Yes | Yes | No |
| Apply advance to balance | Yes | Yes | No |
| Pay vendor | Yes | Yes | No |
| View vendor transaction ledger / statement | Yes | Yes | No |
| Reverse a vendor transaction | Yes | Yes | No |

---

## 7. Frontend Changes

### 7.1 Removed
- Pay Invoice / Pay Bill modal -- no longer exists. Approving is now the only action available on an approved-eligible invoice/bill; there is no separate "release payment" step per document.

### 7.2 Vendor Detail / List Pages

Three balance indicators (unchanged from v1.1):
```
Outstanding Balance:  PKR 200,000
Advance Balance:      PKR  50,000
Net Payable:          PKR 150,000
```

Three action buttons (admin/accountant only):
- **Give Advance**
- **Apply Advance to Balance** -- NEW. Shows both current balances; amount capped at the lower of the two.
- **Pay Vendor** -- replaces "Pay Balance". Now includes:
  - Payment Method dropdown (Cash / Bank Transfer / Cheque / JazzCash-EasyPaisa)
  - Method-specific reference field (Transaction ID / Cheque No. + Bank / Platform Ref), required except for Cash
  - Optional free-text "Reference Note" (e.g. which invoices this roughly covers) -- clearly labeled as informational only, not a real link

### 7.3 Vendor Ledger Page -- unchanged route, updated content

Transaction table now shows the new type set: Advance Given, Invoice Approved, Bill Approved, Advance Applied, Vendor Payment, Reversal -- each with its own badge color. Payment Method and Reference Note columns shown only for Vendor Payment rows.

### 7.4 Invoice / Bill Detail Pages

Approved invoices/bills now show a note such as *"PKR 120,000 added to [Vendor]'s outstanding balance on approval"* with a link to that vendor's ledger -- for traceability, since there's no longer a "paid" state to look at directly on the invoice itself.

---

## 8. Additional Considerations (carried forward from v1.1, still applicable)

### 8.1 Concurrency Safety
Now applies to the **approval endpoint** as well as the three payment actions, since approval now writes to `vendor.outstandingBalance`. The read-check-write must happen under row-level locking inside the transaction -- same requirement as v1.1, just with an additional call site.

### 8.2 Reconciliation Safety Net
Unchanged from v1.1 -- the statement endpoint should flag if computed totals (advance given minus advance applied, invoices/bills approved minus payments made) ever diverge from the stored balances.

### 8.3 Vendor Deactivation With Non-Zero Balance
Unchanged from v1.1 -- block or warn on deactivation if either balance is non-zero.

---

## 9. Open Questions (Confirm Before Implementation)

1. **Reversing an approval's balance credit** -- if an `INVOICE_APPROVED`/`BILL_APPROVED` transaction is reversed, should the invoice/bill's status also revert to `pending` (allowing re-review), or does it stay `approved` with only the ledger entry reversed (meaning the amount is financially undone but the document remains marked approved)?
2. **Payment reference note validation** -- since `invoiceReferenceNote` is free text with no real link, should there be any lightweight validation (e.g. must mention a valid invoice number format) to reduce typos, or fully unrestricted free text?
3. **Rejected-after-approved** -- is there any existing or planned flow where an already-approved invoice/bill can later be rejected/voided? If so, this needs the same balance-reversal treatment as Question 1.

---

## 10. Suggested Build Order

1. Prisma schema migration: remove `SettlementMethod` + `Invoice/Bill.settlementMethod`, add new `VendorTxnType` values, add `PaymentMethod` enum, update `VendorTransaction` model
2. Extend `InvoicesService.approve` / `BillsService.approve` with balance-credit logic (shared helper, row-level locked)
3. New endpoints: `apply-advance`, `pay` (replacing `pay-balance`), keep `advance` and `reverse` from v1.1
4. Remove `pay` endpoints and Pay modal from invoice/bill flow entirely
5. Frontend: vendor detail (three action buttons) -> Pay Vendor modal (payment method fields) -> vendor ledger page updates
6. Reports: replace "Settlement Method" column (no longer exists) with a link/reference to the vendor's ledger instead