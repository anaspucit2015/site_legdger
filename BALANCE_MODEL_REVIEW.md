# Balance Model — Current State vs. What You're Asking For

*Written to get aligned before any more code changes. Not implemented yet.*

---

## 1. What exists right now (as of this session's changes)

For both **Site** and **Vendor**, balance is tracked as a **stored, incrementally-updated field** (`currentBalance`), not a computed value:

```
Vendor / Site {
  openingBalance   -- fixed once at creation, never touched again
  currentBalance   -- starts equal to openingBalance, then mutated in-place
                      by every approve/void/delete code path
}
```

Every time an invoice or bill is approved, the code does (roughly):

```
vendor.currentBalance += amount     // if a vendor is linked
site.currentBalance   += amount     // always, since every invoice/bill has a siteId
```

...and logs a row in a parallel ledger table (`VendorTransaction` / `SiteTransaction`) recording that change. Voiding or deleting an approved invoice/bill does the reverse (`-= amount`), in four separate places per entity type: `create()` (create-as-approved), `approve()`, `void()`, `adminDelete()` — across **both** `invoices.service.ts` and `bills.service.ts`. That's 8 call sites total that all have to correctly, symmetrically maintain this running number.

**Why this has caused repeated bugs this session:** this field is a cache of a sum, maintained by hand across 8+ code paths. Every bug we chased today (reports double-counting, the on-screen "Approved" card double-counting, Site never being wired in at all) was some version of "the cached number and the real underlying data disagree," because one of those paths didn't maintain it correctly or something read it wrong.

**Vendor also has**, beyond invoices/bills: `advanceBalance`, and two vendor-only actions (`Give Advance`, `Pay Vendor`, `Apply Advance to Balance`) that also mutate `currentBalance`/`advanceBalance` directly.

---

## 2. What I believe you're asking for now

> "balance is actually amount we have spent to site and done a business with a vendor... it should be opening balance + all invoices + all bills... we should show all the amount up till now, not 'current balance'"

My read: instead of trusting a **stored running counter** that has to be perfectly maintained by every code path that ever touches an invoice/bill, the balance shown anywhere (screen, reports) should be **computed fresh, on read**, directly from source data:

```
Outstanding = openingBalance
            + SUM(amount)      WHERE invoice.status = 'approved' AND siteId/vendorId = X
            + SUM(totalAmount) WHERE bill.status    = 'approved' AND siteId/vendorId = X
            [Vendor only: − payments made − advance applied, from the ledger]
```

This is a **different architecture**, not just a relabeling:
- No `currentBalance` field to keep in sync. No 8 call sites that must all remember to update it correctly.
- The number is *always* provably correct, because it's derived straight from the Invoice/Bill tables every time it's read — there's nothing to desync.
- The ledger tables (`VendorTransaction` / `SiteTransaction`) become pure **audit history** (who approved what, when, reversals) rather than also being load-bearing for maintaining a running total.

This would mean **removing** the `currentBalance += / -= amount` lines I added today in `invoices.service.ts` / `bills.service.ts` (8 call sites), and instead computing the total live wherever it's needed (the `getBalance()` endpoint, the Excel reports, the "Pay Vendor" cap check, etc.) via a query against Invoice/Bill statuses.

---

## 3. Open question before I touch anything

**For Vendor specifically** — payments and advance-applied amounts aren't rows in Invoice/Bill, they only exist in `VendorTransaction`. So a vendor's true outstanding is:

```
openingBalance + approved invoices + approved bills − vendor payments made − advance applied
```

Do you want:
- **(A)** Vendor keeps today's model (stored `currentBalance`, incrementally maintained) since it already has a working ledger-backed reconciliation check (`getStatement()`), and **only Site** switches to compute-on-read (since Site has no payments/advances — it's purely "opening + approved invoices + approved bills", a simpler case)?
- **(B)** Both Vendor and Site switch to fully compute-on-read, including re-deriving the vendor formula above from the ledger every time, and `currentBalance`/`advanceBalance` stop being written at all (purely informational/cached, or removed)?

I'd lean toward **(A)** — Site is exactly the simple case you described (opening + approved invoices + approved bills, nothing else), and switching just that one to compute-on-read removes the exact class of bug we kept hitting, without touching Vendor's more complex, already-working payment/advance logic. But this is your call since it changes how "Pay Vendor" amount-capping and the reconciliation check work underneath.

Let me know which way to go (or correct anything above I've misunderstood), and I'll implement from there.
