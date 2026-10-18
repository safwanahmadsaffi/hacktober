# DukaanVoice PK — One Day, End to End (worked example)

> Follow **Safwan** through one full day at his shop. Every number below is
> verifiable: the Munshi AI answers in Step 8 are **real output** from the running
> app fed with exactly this snapshot.

The shop starts from the seeded catalogue, customers and expenses.

---

## 0. The shop at 9:00 AM (starting state)

**Till / drawer:** Rs. 2,000 float (the value in the Cash Closing "opening cash" box).

**A few products**

| Item | Stock | Buy | Sell | Low-stock at |
|---|---|---|---|---|
| Sunridge Atta 5kg | 25 | 580 | **650** | 5 |
| Guard Basmati Rice 1kg | 20 | 320 | **380** | 5 |
| Olper's Milk 1L | 15 | 260 | **290** | 6 |
| Tapal Danedar Tea 430g | 16 | 590 | **680** | 4 |
| Pure White Sugar 1kg | **4** | 135 | **155** | 8 ← already low |

**Udhaar khata (customer credit)**

| Customer | Owes |
|---|---|
| Muhammad Ali | Rs. 2,450 |
| Tariq Mehmood | Rs. 850 |
| Fatima Bibi | Rs. 0 *(paid Rs. 1,200 in cash today)* |
| Usman Khan | Rs. 1,200 |
| **Total outstanding** | **Rs. 4,500** |

**Expenses already paid in cash today:** chai/parathas Rs. 350 + shopping bags Rs. 750 = **Rs. 1,100**.

---

## 1. Quick Sale (`/`) — three customers, three payment methods

Safwan rings up three bills:

| # | Items | Total | Paid by |
|---|---|---|---|
| A | 1× Atta 650 + 1× Rice 380 | **Rs. 1,030** | **cash** |
| B | 2× Milk (290×2) + 1× Sugar 155 | **Rs. 735** | **udhaar** → Muhammad Ali |
| C | 1× Tapal Tea | **Rs. 680** | **wallet** (JazzCash) |

What the app does the moment Safwan presses **Confirm**:
1. Saves a `sale` **receipt** for each bill.
2. **Reduces stock** for every item.
3. For bill B only, adds **Rs. 735 to Ali's balance** and writes a `credit_sale` entry on his khata.

---

## 2. Products (`/products`) — stock moved itself

| Item | Before | After | Note |
|---|---|---|---|
| Atta | 25 | 24 | |
| Rice | 20 | 19 | |
| Milk | 15 | 13 | sold 2 |
| Tapal Tea | 16 | 15 | |
| Sugar | 4 | **3** | ⚠ below threshold 8 |

The page now shows **1 low-stock item** — Safwan never had to update it by hand.

---

## 3. Transactions (`/transactions`) — the receipt book

Three confirmed sale receipts today:

**Total sold: Rs. 1,030 + 735 + 680 = Rs. 2,445**
Payment mix: cash Rs. 1,030 · wallet Rs. 680 · udhaar Rs. 735.

*(Note: a receipt is not profit — the cost of those goods is subtracted later, in Reports.)*

---

## 4. Udhaar Khata (`/udhaar`) — the credit book updated itself

| Customer | Before | After |
|---|---|---|
| Muhammad Ali | 2,450 | **3,185** ← +735 from bill B |
| Tariq Mehmood | 850 | 850 |
| Fatima Bibi | 0 | 0 |
| Usman Khan | 1,200 | 1,200 |
| **Total** | 4,500 | **Rs. 5,235** |

Now suppose Ali walks in and pays back **Rs. 1,000 in cash**. Safwan records it here → Ali's balance drops and a `repayment` entry is stamped on his khata. *(The full repayment flow — and the accounting bug it used to trigger — is walked through in Step 9.)*

---

## 5. Expenses (`/expenses`) — a shop cost

Safwan also pays **Rs. 400 cash** for a repair.

Cash expenses today = 350 + 750 + 400 = **Rs. 1,500**.

---

## 6. Cash Closing / Roznamcha (`/cash-closing`) — count the drawer

The page computes the **expected** drawer from every confirmed cash movement:

```
Opening float            Rs. 2,000
+ cash sales (bill A)    Rs. 1,030
+ cash repayments       Rs. 1,200   ← Fatima's repayment today
- cash expenses         Rs. 1,500
────────────────────────────────────
= Expected in drawer     Rs. 2,730
```

Safwan counts the physical till: **Rs. 2,700**
→ Difference **−Rs. 30 (short)**. He adds a note and **Finalizes** the day, locking it.

*(JazzCash/EasyPaisa/bank money is deliberately excluded — that money is not in the drawer.)*

---

## 7. Reports (`/reports`) — the day's verdict

| Metric | Value | How |
|---|---|---|
| Gross sales | Rs. 2,445 | the 3 receipts |
| Cost of goods sold | Rs. 2,145 | Atta 580 + Rice 320 + Milk 520 + Sugar 135 + Tea 590 |
| **Gross profit** | **Rs. 300** | 2,445 − 2,145 |
| Expenses | Rs. 1,500 | chai 350 + bags 750 + repair 400 |
| **Net earnings** | **−Rs. 1,200** | 300 − 1,500 (a loss today — the repair + bags cost more than the margin) |
| Stock valuation | — | remaining stock at cost, and at retail |

This is the honest picture: selling a lot ≠ making money.

---

## 8. Munshi AI (`/munshi`) — ask in Urdu or English

Real, verified answers from the running agent fed with this exact day:

| Ask | Answer |
|---|---|
| **"kam stock batao"** | `1 item(s) are low: Pure White Refined Sugar 1kg (3 kg)` |
| **"aaj ki sale kitni hui"** | `Today's confirmed sales: Rs. 2,445.00 across 3 bill(s).` |
| **"kitna udhaar baqi hai"** | `Total outstanding Udhaar: Rs. 5,235.00 across 3 customer(s). Top: Muhammad Ali Rs. 3,185.00, Usman Khan Rs. 1,200.00, Tariq Mehmood Rs. 850.00` |
| **"2 kg atta add karo"** | Drafts a bill: `Sunridge Fortified Chakki Atta 5kg ×1 — total Rs. 650.00` — **proposes, never posts**; Safwan confirms. |

The agent reads the **same state** you just saw on the pages, and its tool trace shows
`inventory_query`, `sales_summary`, `udhaar_query`, `draft_bill`.

---

## How one number travels the whole app

```
Quick Sale ──▶ Transaction (receipt) ──▶ Reports (revenue, COGS, profit)
    │                                        ▲
    ├──▶ Products (stock −) ─────────────────┘ (stock valuation, low stock)
    │
    └──▶ Udhaar Khata (customer balance +) ──▶ Cash Closing (cash repayments +)

Expenses ──▶ Cash Closing (cash out) ──▶ Reports (net earnings)
Cash Closing ──▶ Reports (reconciled days)
```

* `Rs. 1,030` cash sale → Transactions **and** the Cash Closing "cash sales" line.
* `Rs. 735` udhaar sale → Udhaar Khata balance **and** Transactions (as a credit receipt), never in the drawer.
* `Rs. 1,200` repayment → Cash Closing "cash repayments" line, and part of the "money on the street" reduction.
* `Rs. 1,500` expenses → Cash Closing "expenses" line **and** Reports net earnings.

---

## 9. A repayment, done right (the bug live testing caught)

Later that evening Ali returns and pays **Rs. 1,000 in cash**. Safwan records it on
`/udhaar`.

The app writes two things:

1. Ali's khata gets a `repayment` entry → balance **Rs. 3,185 → Rs. 2,185**
   (total outstanding **Rs. 5,235 → Rs. 4,235**). This part was always correct.
2. A receipt-shaped transaction so the repayment appears in `/transactions`, tagged
   with the pseudo-product `udhaar-repay`.

That second write is what used to poison the money numbers, because every screen that
filtered `type === 'sale'` counted it as a sale:

| Screen | Before the fix | After the fix |
|---|---|---|
| Reports — gross sales | Rs. **3,445** ❌ (2,445 + 1,000) | Rs. **2,445** ✅ |
| Reports — COGS | Rs. **2,895** ❌ (2,145 + a phantom 75% of the repayment) | Rs. **2,145** ✅ |
| Reports — gross profit | Rs. **550** ❌ | Rs. **300** ✅ |
| Reports — repayments appeared as | revenue | **“+ Rs. 1,000 udhaar recovered (not revenue)”** |
| Cash Closing — expected drawer | Rs. **4,730** ❌ (repayment counted twice) | Rs. **3,730** ✅ (`2,000 + 1,030 cash sales + 2,200 repayments − 1,500 expenses`) |
| Agent: “aaj ki sale kitni hui” | Rs. **3,445** ❌ | Rs. **2,445** ✅ |
| TabPFN sales history | gained a phantom `udhaar-repay` row | only real products ✅ |

The fix is one shared predicate — `isRealSale()` / `isUdhaarRepayment()` in
`src/lib/financial.ts` — applied at every revenue, COGS and forecast site: Reports,
Cash Closing, Transactions, Dashboard, the assistant bar, the agent's sales summary,
and the TabPFN history. Cash Closing already receives repayments from the khata ledger,
so excluding the receipt removes the double count.

**The rule the app now follows:** a repayment reduces what the customer owes and raises
cash — it is **never** revenue, and it has **no** cost of goods.

> **Related fix:** Step 1's udhaar bill used to be written to the database *twice* —
> once on confirm, then again after appending the khata log line. It is now written
> exactly once, with the khata entry folded into the receipt log beforehand.

---
