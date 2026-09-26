# Charge Matcher

A single-page tool that checks your bank or card charges against the orders
in your order tracker (for example, an orders export from Penguinship).

Open `index.html` in any browser. No install needed. Files are read locally
in the browser and are never uploaded.

1. **Bank or card statement**: download your transactions as CSV from your
   bank's website and load it (or drag it onto the panel).
2. **Orders**: export your orders as CSV from your tracker, or select the
   orders table on its website, copy it, and use **Paste instead**.
3. Check the column dropdowns. They're guessed from the headers, so fix any
   that are wrong.

Results are split into four groups:

- **Matched**: same amount to the cent, inside the date window, and the store
  name shows up in the bank description. Split shipments (one order charged
  in 2 or 3 parts) and combined charges (2 or 3 orders in one charge) count.
- **Needs a look**: the amount is close but not exact (shipping, tax), or the
  store name doesn't appear on the statement.
- **Charges with no order**: purchases on the statement that aren't in the
  tracker. Use **Ignore** to hide everyday merchants like groceries or gas.
- **Orders with no charge**: orders with no charge found. Orders placed after
  the statement ends are labelled so you don't chase them.

**Copy all results for a spreadsheet** copies everything as tab-separated
rows that paste straight into Excel, Numbers, or Google Sheets.
