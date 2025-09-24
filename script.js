/* ---------- PRODUCTS (localStorage) ---------- */
const PRODUCTS_KEY = 'kt_products_v1';
let products = [];

// DOM elements
const grid           = document.getElementById('productGrid');
const pName          = document.getElementById('pName');
const pPrice         = document.getElementById('pPrice');
const pCategory      = document.getElementById('pCategory');
const pImg           = document.getElementById('pImg');
const categoryFilter = document.getElementById('categoryFilter');
const minPrice       = document.getElementById('minPrice');
const maxPrice       = document.getElementById('maxPrice');
const searchInput    = document.getElementById('searchInput');

document.getElementById('applyFilters').addEventListener('click', filterProducts);

async function loadProductsFromFirestore() {
  const { db, firebaseFuncs } = window;
  const colRef = firebaseFuncs.collection(db, 'products');
  const snapshot = await firebaseFuncs.getDocs(colRef);

  products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  displayProducts(products);
}

document.getElementById('addProductBtn').addEventListener('click', async () => {
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  if (!name || isNaN(price)) return alert('Enter valid name & price');

  const newProduct = {
    name,
    price,
    category: pCategory.value,
    img: pImg.value.trim()
  };

  const { db, firebaseFuncs } = window;
  const colRef = firebaseFuncs.collection(db, 'products');
  await firebaseFuncs.addDoc(colRef, newProduct);

  pName.value = pPrice.value = pImg.value = '';
  await loadProductsFromFirestore(); // reload products
});



// Display products
function displayProducts(items) {
  grid.innerHTML = items.map((p) => `
    <div class="product">
      <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCartObj(${JSON.stringify(p).replace(/"/g, '&quot;')})">Add to Bill</button>
      <button onclick="removeProductByName('${p.name}')" class="remove-btn">Remove</button>
    </div>`).join('');
}

// Filter products (category + price + search)
function filterProducts() {
  const cat = categoryFilter.value;
  const min = parseInt(minPrice.value) || 0;
  const max = parseInt(maxPrice.value) || Infinity;
  const search = searchInput.value.trim().toLowerCase();

  const filtered = products.filter(p =>
    (cat === 'all' || p.category === cat) &&
    p.price >= min && p.price <= max &&
    p.name.toLowerCase().includes(search)
  );

  displayProducts(filtered);
}

// Add product
document.getElementById('addProductBtn').addEventListener('click', () => {
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  if (!name || isNaN(price)) return alert('Enter valid name & price');

  products.push({
    name,
    price,
    category: pCategory.value,
    img: pImg.value.trim()
  });
  saveProductsToStorage();
  pName.value = pPrice.value = pImg.value = '';
  displayProducts(products);
});

async function removeProductByName(id) {
  if (!confirm('Remove this product?')) return;

  const { db, firebaseFuncs } = window;
  const docRef = firebaseFuncs.doc(db, 'products', id);
  await firebaseFuncs.deleteDoc(docRef);

  await loadProductsFromFirestore();
}
function displayProducts(items) {
  grid.innerHTML = items.map(p => `
    <div class="product">
      <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCartObj(${JSON.stringify(p).replace(/"/g,'&quot;')})">Add to Bill</button>
      <button onclick="removeProductByName('${p.id}')" class="remove-btn">Remove</button>
    </div>
  `).join('');
}


/* ---------- CART ---------- */
let cart = [];
const cartList       = document.getElementById('cartList');
const cartTotal      = document.getElementById('cartTotal');
const customerNumber = document.getElementById('customerNumber');
const generateBillBtn = document.getElementById('generateBillBtn');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const clearCartBtn    = document.getElementById('clearCartBtn');
const downloadPdfBtn  = document.getElementById('downloadPdfBtn');

function addToCartObj(product) { cart.push(product); updateCart(); }
function removeFromCart(i) { cart.splice(i, 1); updateCart(); }

function updateCart() {
  let total = 0;
  cartList.innerHTML = cart.map((it, idx) => {
    total += it.price;
    return `<li>${it.name} - ₹${it.price}
      <button class="remove-btn" onclick="removeFromCart(${idx})">❌</button>
    </li>`;
  }).join('');
  cartTotal.textContent = cart.length ? `Total: ₹${total}` : 'No items selected.';
}

clearCartBtn.addEventListener('click', () => {
  if (cart.length && confirm('Clear current selection?')) {
    cart = [];
    updateCart();
  }
});

// Print-friendly bill
generateBillBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const w = window.open('', '_blank');
  w.document.write(buildBillHTML());
  w.document.close();
  w.focus();
  w.print(); // trigger print
});

// WhatsApp send
sendWhatsAppBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const num = customerNumber.value.trim();
  if (!num) return alert('Enter customer mobile (e.g. 91XXXXXXXXXX)');
  let total = 0;
  const lines = cart.map((it, i) => {
    total += it.price;
    return `${i + 1}. ${it.name} - ₹${it.price}`;
  });
  lines.unshift('KT Family Store - Bill', '----------------------');
  lines.push('----------------------', `Total: ₹${total}`);
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
});

// Download as PDF
downloadPdfBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const tempDiv = document.createElement('div');
  let total = 0;
  const rows = cart.map((it, i) => {
    total += it.price;
    return `<tr><td>${i + 1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`;
  }).join('');

  tempDiv.innerHTML = `
    <table>
      <thead>
        <tr><th>#</th><th>Item</th><th>Price</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2"><strong>Total</strong></td><td><strong>₹${total}</strong></td></tr>
      </tfoot>
    </table>
  `;

  const style = document.createElement('style');
  style.textContent = `
    table{width:100%;border-collapse:collapse;margin-top:10px;}
    td, th{border:1px solid #000;padding:8px;text-align:left;}
  `;
  tempDiv.prepend(style);

  document.body.appendChild(tempDiv);

  html2pdf()
    .set({
      margin: 10,
      filename: 'KT-Family-Store-Bill.pdf',
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .from(tempDiv)
    .save()
    .finally(() => tempDiv.remove());
});

// Build bill HTML for print
function buildBillHTML() {
  let total = 0;
  const rows = cart.map((it, i) => {
    total += it.price;
    return `<tr><td>${i + 1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`;
  }).join('');
  return `
    <html><head><title>Bill</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;}
      table{width:100%;border-collapse:collapse;margin-top:10px;}
      td,th{border:1px solid #ddd;padding:8px;}
    </style></head>
    <body>
      <h1>KT Family Store</h1>
      <p>Bill generated: ${new Date().toLocaleString()}</p>
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Price</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2"><strong>Total</strong></td>
        <td><strong>₹${total}</strong></td></tr></tfoot>
      </table>
    </body></html>`;
}

/* ---------- INIT ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  await loadProductsFromFirestore(); // load products from Firebase on page load
});


/* ---------- Expose globals ---------- */
window.addToCartObj = addToCartObj;
window.removeFromCart = removeFromCart;
window.filterProducts = filterProducts;
window.removeProductByName = removeProductByName;
