// zakat.js
// Exports: calculateStockValue(products, productStocks?) and calculateZakat(zakatableAmount, rate=0.025)
// Provides a real-time Zakāth UI component that updates whenever product data or inputs change.

// Helper: format currency (Indian rupee)
function formatRupee(n) {
  if (isNaN(n)) return '₹0';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Calculate total stock value from products
// Supports two product shapes:
// 1) { sellingPrice, quantity }
// 2) Firestore style: { price } with quantities provided in productStocks map keyed by product.id
export function calculateStockValue(products = [], productStocks = {}) {
  let total = 0;
  if (!Array.isArray(products)) return 0;

  for (const p of products) {
    if (p == null) continue;
    // If explicit sellingPrice and quantity provided, use them
    if (typeof p.sellingPrice === 'number' && typeof p.quantity === 'number') {
      total += p.sellingPrice * p.quantity;
      continue;
    }

    // Firestore style: price + external stock map
    const price = typeof p.price === 'number' ? p.price : (typeof p.sellingPrice === 'number' ? p.sellingPrice : 0);
    const qtyFromObj = typeof p.quantity === 'number' ? p.quantity : undefined;
    let qty = 0;
    if (typeof qtyFromObj === 'number') qty = qtyFromObj;
    else if (productStocks && typeof productStocks === 'object' && p.id && productStocks[p.id] !== undefined) qty = Number(productStocks[p.id]) || 0;
    else if (p.stock !== undefined) qty = Number(p.stock) || 0;
    total += price * qty;
  }
  return total;
}

// Calculate zakat due given zakatable amount and rate (default 2.5%)
export function calculateZakat(zakatableAmount, rate = 0.025) {
  if (isNaN(zakatableAmount) || zakatableAmount <= 0) return 0;
  return zakatableAmount * rate;
}

// Create UI component and wire real-time updates
function createZakatUI() {
  // Avoid creating multiple times
  if (document.getElementById('zakat-card')) return;

  const card = document.createElement('div');
  card.id = 'zakat-card';
  card.className = 'card zakat-card';
  card.innerHTML = `
    <h3>Zakāth (Zakat-ul-Tijarah)</h3>
    <div class="z-row"><label>Total Stock Value</label><div id="z-totalStock">₹0</div></div>
    <div class="z-row"><label>Cash In Hand</label><input id="z-cashInHand" type="number" min="0" step="0.01" value="0" /></div>
    <div class="z-row"><label>Receivable Debts</label><input id="z-receivables" type="number" min="0" step="0.01" value="0" /></div>
    <div class="z-row"><label>Short-Term Debts</label><input id="z-shortTermDebts" type="number" min="0" step="0.01" value="0" /></div>
    <hr />
    <div class="z-row"><label>Zakatable Amount</label><div id="z-zakatable">₹0</div></div>
    <div class="z-row"><label>Zakāth Due (2.5%)</label><div id="z-zakatDue">₹0</div></div>
    <div style="margin-top:10px; font-size:12px; color:#666">Auto-updates when stock/products change</div>
  `;

  // Insert into right column if exists, otherwise append to body
  const rightCol = document.querySelector('.right-col');
  if (rightCol) {
    // Put at top of right-col
    rightCol.insertBefore(card, rightCol.firstChild);
  } else {
    document.body.appendChild(card);
  }

  // Element refs
  const totalStockEl = document.getElementById('z-totalStock');
  const cashInput = document.getElementById('z-cashInHand');
  const receivablesInput = document.getElementById('z-receivables');
  const shortDebtsInput = document.getElementById('z-shortTermDebts');
  const zakatableEl = document.getElementById('z-zakatable');
  const zakatDueEl = document.getElementById('z-zakatDue');

  // Recalculate and update UI
  function recalcAndRender() {
    // Read products from global window (app.js uses `products` and `productStocks` globals)
    const products = window.products || window._products || [];
    const productStocks = window.productStocks || {};

    const totalStockValue = calculateStockValue(products, productStocks);
    const cash = Number(cashInput.value) || 0;
    const receivables = Number(receivablesInput.value) || 0;
    const shortDebts = Number(shortDebtsInput.value) || 0;

    const zakatableAmount = totalStockValue + cash + receivables - shortDebts;
    const zakatDue = calculateZakat(zakatableAmount, 0.025);

    totalStockEl.textContent = formatRupee(totalStockValue);
    zakatableEl.textContent = formatRupee(zakatableAmount);
    zakatDueEl.textContent = formatRupee(zakatDue);
  }

  // Input listeners
  [cashInput, receivablesInput, shortDebtsInput].forEach(inp => {
    inp.addEventListener('input', recalcAndRender);
    inp.addEventListener('change', recalcAndRender);
  });

  // Periodic poll to reflect product/stock changes in real-time
  let lastSnapshot = { productsCount: 0, stockHash: '' };
  setInterval(() => {
    try {
      const products = window.products || [];
      const productStocks = window.productStocks || {};
      const productsCount = products.length;
      // Simple hash of stocks
      const stockHash = JSON.stringify(productStocks);
      if (productsCount !== lastSnapshot.productsCount || stockHash !== lastSnapshot.stockHash) {
        lastSnapshot.productsCount = productsCount;
        lastSnapshot.stockHash = stockHash;
        recalcAndRender();
      }
    } catch (e) {
      // ignore
    }
  }, 700);

  // Initial render
  setTimeout(recalcAndRender, 200);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createZakatUI);
} else {
  createZakatUI();
}

// Also expose functions to window for convenience
window.calculateStockValue = calculateStockValue;
window.calculateZakat = calculateZakat;

export default {
  calculateStockValue,
  calculateZakat
};
