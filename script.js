/* ---------- AUTH (password gate) ---------- */
// Keys
const AUTH_KEY   = 'kt_admin_pw';    // localStorage: SHA-256 hash of admin password
const LOGGED_KEY = 'kt_logged_in';   // sessionStorage flag

// DOM elements
const overlay      = document.getElementById('authOverlay');
const setPassDiv   = document.getElementById('setPassDiv');
const loginDiv     = document.getElementById('loginDiv');
const authTitle    = document.getElementById('authTitle');
const authMsg      = document.getElementById('authMsg');
const newPassword  = document.getElementById('newPassword');
const newPassConf  = document.getElementById('newPasswordConfirm');
const setPasswordBtn = document.getElementById('setPasswordBtn');
const passwordInput  = document.getElementById('passwordInput');
const loginBtn       = document.getElementById('loginBtn');
const app            = document.getElementById('app');
const logoutBtn      = document.getElementById('logoutBtn');

// Helpers
function buf2hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
async function hashString(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return buf2hex(hash);
}

// Prepare login or set-password UI
function prepareAuthUI() {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) {
    authTitle.textContent = 'Set Admin Password';
    setPassDiv.classList.remove('hidden');
    loginDiv.classList.add('hidden');
  } else {
    authTitle.textContent = 'Admin Login';
    setPassDiv.classList.add('hidden');
    loginDiv.classList.remove('hidden');
  }
}

// Set password
setPasswordBtn.addEventListener('click', async () => {
  const p1 = newPassword.value.trim();
  const p2 = newPassConf.value.trim();
  authMsg.textContent = '';
  if (!p1 || !p2) return (authMsg.textContent = 'Please fill both fields.');
  if (p1 !== p2) return (authMsg.textContent = 'Passwords do not match.');
  const hash = await hashString(p1);
  localStorage.setItem(AUTH_KEY, hash);
  newPassword.value = newPassConf.value = '';
  authMsg.textContent = 'Password saved. Please login.';
  prepareAuthUI();
});

// Login
loginBtn.addEventListener('click', async () => {
  const p = passwordInput.value.trim();
  if (!p) return (authMsg.textContent = 'Enter password.');
  const hash = await hashString(p);
  if (hash === localStorage.getItem(AUTH_KEY)) {
    sessionStorage.setItem(LOGGED_KEY, '1');
    openApp();
  } else authMsg.textContent = 'Wrong password.';
});

// Logout
logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(LOGGED_KEY);
  location.reload();
});

// Open the actual app
function openApp() {
  overlay.classList.add('hidden');
  app.classList.remove('hidden');
  loadProductsFromStorage();
  displayProducts(products);
  updateCart();
}

/* ---------- PRODUCTS ---------- */
const PRODUCTS_KEY = 'kt_products_v1';
let products = [
  { name: "Red Sneakers",    price: 799, category: "footwear",  img: "img/red-shoes.jpg" },
  { name: "Sparkle Hair Clip", price: 120, category: "fancy",   img: "img/hair-clip.jpg" },
  { name: "RC Car",           price: 999, category: "toys",     img: "img/rc-car.jpg" },
  { name: "Notebook Pack",    price: 60,  category: "stationery",img: "img/notebook.jpg" },
  { name: "Blue Sandals",     price: 450, category: "footwear",  img: "img/sandals.jpg" }
];

function saveProductsToStorage() {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}
function loadProductsFromStorage() {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  if (!raw) return saveProductsToStorage();
  try { products = JSON.parse(raw); }
  catch { saveProductsToStorage(); }
}

const grid           = document.getElementById('productGrid');
const categoryFilter = document.getElementById('categoryFilter');
const minPrice       = document.getElementById('minPrice');
const maxPrice       = document.getElementById('maxPrice');
document.getElementById('applyFilters').addEventListener('click', filterProducts);

function displayProducts(items) {
  grid.innerHTML = items.map((p, i) => `
    <div class="product">
      <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCart(${i})">Add to Bill</button>
      <button onclick="removeProduct(${i})" class="remove-btn">Remove</button>
    </div>`).join('');
}

function filterProducts() {
  const cat = categoryFilter.value;
  const min = parseInt(minPrice.value) || 0;
  const max = parseInt(maxPrice.value) || Infinity;
  const filtered = products.filter(p =>
    (cat === 'all' || p.category === cat) &&
    p.price >= min && p.price <= max
  );
  displayProducts(filtered);
}

// Admin add product
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

/* ---------- CART / BILL ---------- */
const cartList      = document.getElementById('cartList');
const cartTotal     = document.getElementById('cartTotal');
const customerNumber= document.getElementById('customerNumber');
const generateBillBtn = document.getElementById('generateBillBtn');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const clearCartBtn    = document.getElementById('clearCartBtn');

let cart = [];

function addToCart(i) {
  if (!products[i]) return;
  cart.push(products[i]);
  updateCart();
}
function removeFromCart(i) {
  cart.splice(i, 1);
  updateCart();
}
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

// Remove product from products list
function removeProduct(index) {
  if (confirm('Remove this product?')) {
    products.splice(index, 1); // Remove product from array
    saveProductsToStorage();   // Update localStorage
    displayProducts(products); // Refresh display
  }
}

// Print-friendly bill
generateBillBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const w = window.open('', '_blank');
  w.document.write(buildBillHTML());
  w.document.close();
  w.print();
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
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

downloadPdfBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');

  // Create temporary div
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = buildBillHTML();

  // Optional: add basic styles directly so PDF shows table properly
  const style = document.createElement('style');
  style.textContent = `
    body{font-family:Arial,sans-serif;padding:20px;}
    table{width:100%;border-collapse:collapse;margin-top:10px;}
    td,th{border:1px solid #ddd;padding:8px;text-align:left;}
    h1{margin-bottom:0.5rem;}
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

/* ---------- Init ---------- */
prepareAuthUI();
if (sessionStorage.getItem(LOGGED_KEY) === '1') openApp();

/* Expose global funcs for inline onclicks */
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.filterProducts = filterProducts;
window.removeProduct = removeProduct;
