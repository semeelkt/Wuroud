/* ======= AUTH (no-backend) ======= */
/* Uses Web Crypto API to hash password and stores hash in localStorage
   Key names:
   - 'kt_admin_pw' : stores hex SHA-256 hash of admin password
   - 'kt_logged_in' : session flag (sessionStorage)
*/

const AUTH_KEY = 'kt_admin_pw';
const LOGGED_KEY = 'kt_logged_in';

const overlay = document.getElementById('authOverlay');
const setPassDiv = document.getElementById('setPassDiv');
const loginDiv = document.getElementById('loginDiv');
const authTitle = document.getElementById('authTitle');
const authMsg = document.getElementById('authMsg');

const newPassword = document.getElementById('newPassword');
const newPasswordConfirm = document.getElementById('newPasswordConfirm');
const setPasswordBtn = document.getElementById('setPasswordBtn');

const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');

const app = document.getElementById('app');
const logoutBtn = document.getElementById('logoutBtn');

// helper: convert ArrayBuffer -> hex
function buf2hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// hash string -> hex using SHA-256
async function hashString(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return buf2hex(hash);
}

// show auth UI depending on whether a password exists
function prepareAuthUI() {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) {
    // no password set -> show set password screen
    authTitle.textContent = 'Set Admin Password';
    setPassDiv.classList.remove('hidden');
    loginDiv.classList.add('hidden');
  } else {
    authTitle.textContent = 'Admin Login';
    setPassDiv.classList.add('hidden');
    loginDiv.classList.remove('hidden');
  }
}

// set a new admin password (stores hash)
setPasswordBtn.addEventListener('click', async () => {
  const p = newPassword.value.trim();
  const p2 = newPasswordConfirm.value.trim();
  authMsg.textContent = '';
  if (!p || !p2) { authMsg.textContent = 'Please fill both fields.'; return; }
  if (p !== p2) { authMsg.textContent = 'Passwords do not match.'; return; }
  const h = await hashString(p);
  localStorage.setItem(AUTH_KEY, h);
  newPassword.value = '';
  newPasswordConfirm.value = '';
  authMsg.textContent = 'Password saved. Please login.';
  prepareAuthUI();
});

// login
loginBtn.addEventListener('click', async () => {
  const p = passwordInput.value.trim();
  authMsg.textContent = '';
  if (!p) { authMsg.textContent = 'Enter password.'; return; }
  const h = await hashString(p);
  const stored = localStorage.getItem(AUTH_KEY);
  if (h === stored) {
    // success
    sessionStorage.setItem(LOGGED_KEY, '1');
    openApp();
  } else {
    authMsg.textContent = 'Wrong password.';
  }
});

// logout
logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(LOGGED_KEY);
  location.reload();
});

// open app if logged in
function openApp() {
  overlay.classList.add('hidden');
  app.classList.remove('hidden');
  loadProductsFromStorage();
  displayProducts(products);
  updateCart();
}

// on load
prepareAuthUI();
if (sessionStorage.getItem(LOGGED_KEY) === '1') {
  openApp();
}

/* ======= PRODUCTS + CART (localStorage-based) ======= */

const PRODUCTS_KEY = 'kt_products_v1'; // can change if schema changes
let products = [
  // sample starter items (will be overwritten if localStorage has saved products)
  { name: "Red Sneakers", price: 799, category: "footwear", img: "img/red-shoes.jpg" },
  { name: "Sparkle Hair Clip", price: 120, category: "fancy", img: "img/hair-clip.jpg" },
  { name: "RC Car", price: 999, category: "toys", img: "img/rc-car.jpg" },
  { name: "Notebook Pack", price: 60, category: "stationery", img: "img/notebook.jpg" },
  { name: "Blue Sandals", price: 450, category: "footwear", img: "img/sandals.jpg" }
];

const grid = document.getElementById("productGrid");
const categoryFilter = document.getElementById("categoryFilter");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const applyFilters = document.getElementById("applyFilters");

const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const customerNumber = document.getElementById("customerNumber");
const generateBillBtn = document.getElementById("generateBillBtn");
const sendWhatsAppBtn = document.getElementById("sendWhatsAppBtn");
const clearCartBtn = document.getElementById("clearCartBtn");

const addProductBtn = document.getElementById("addProductBtn");
const pName = document.getElementById("pName");
const pPrice = document.getElementById("pPrice");
const pCategory = document.getElementById("pCategory");
const pImg = document.getElementById("pImg");

let cart = [];

// Persist products in localStorage so admin can add items and they remain
function saveProductsToStorage() {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}
function loadProductsFromStorage() {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  if (raw) {
    try {
      products = JSON.parse(raw);
    } catch (e) {
      console.error('products parse error', e);
    }
  } else {
    saveProductsToStorage();
  }
}

// display products array
function displayProducts(items) {
  grid.innerHTML = "";
  items.forEach((p, index) => {
    grid.innerHTML += `
      <div class="product">
        <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>₹${p.price}</p>
        <button onclick="addToCart(${index})">Add to Bill</button>
      </div>
    `;
  });
}

// filter logic
function filterProducts() {
  const cat = categoryFilter.value;
  const min = parseInt(minPrice.value) || 0;
  const max = parseInt(maxPrice.value) || Infinity;

  const filtered = products.filter(p =>
    (cat === "all" || p.category === cat) &&
    p.price >= min &&
    p.price <= max
  );

  displayProducts(filtered);
}

// add product form (admin)
addProductBtn.addEventListener('click', () => {
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  const cat = pCategory.value;
  const img = pImg.value.trim();
  if (!name || !price || isNaN(price)) {
    alert('Enter valid name and price.');
    return;
  }
  products.push({ name, price, category: cat, img });
  saveProductsToStorage();
  pName.value = ''; pPrice.value = ''; pImg.value = '';
  displayProducts(products);
});

// cart functions
function addToCart(index) {
  const item = products[index];
  if (!item) return;
  cart.push(item);
  updateCart();
}

function updateCart() {
  cartList.innerHTML = "";
  let total = 0;
  cart.forEach((it, idx) => {
    cartList.innerHTML += `<li>${it.name} - ₹${it.price} <button onclick="removeFromCart(${idx})" style="float:right">✖</button></li>`;
    total += it.price;
  });
  cartTotal.textContent = cart.length ? `Total: ₹${total}` : 'No items selected.';
}

function removeFromCart(i) {
  cart.splice(i,1);
  updateCart();
}

clearCartBtn.addEventListener('click', () => {
  if (!confirm('Clear current selection?')) return;
  cart = [];
  updateCart();
});

// generate printable bill (simple)
generateBillBtn.addEventListener('click', () => {
  if (cart.length === 0) { alert('No items in bill'); return; }
  const billHtml = buildBillHTML();
  const w = window.open('', '_blank');
  w.document.write(billHtml);
  w.document.close();
  // Use print dialog, user can save as PDF
  w.print();
});

// WhatsApp send (opens wa.me with encoded message)
sendWhatsAppBtn.addEventListener('click', () => {
  const num = customerNumber.value.trim();
  if (!num) { alert('Enter customer mobile number (include country code, e.g., 91XXXXXXXXXX)'); return; }
  if (cart.length === 0) { alert('No items in bill'); return; }

  const lines = [];
  lines.push('KT Family Store - Bill');
  lines.push('----------------------');
  let total = 0;
  cart.forEach((it, i) => {
    lines.push(`${i+1}. ${it.name} - ₹${it.price}`);
    total += it.price;
  });
  lines.push('----------------------');
  lines.push(`Total: ₹${total}`);
  const msg = encodeURIComponent(lines.join('\n'));
  // open WhatsApp click-to-chat (this opens WhatsApp Web/Phone)
  const wa = `https://wa.me/${num}?text=${msg}`;
  window.open(wa, '_blank');
});

function buildBillHTML() {
  let total = 0;
  const itemsHtml = cart.map((it, i) => {
    total += it.price;
    return `<tr><td>${i+1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`;
  }).join('');
  const html = `
    <html><head><title>Bill - KT Family Store</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;}
        table{width:100%;border-collapse:collapse;margin-top:10px;}
        td,th{border:1px solid #ddd;padding:8px;text-align:left;}
        h1{margin:0;}
      </style>
    </head>
    <body>
      <h1>KT Family Store</h1>
      <p>Bill generated: ${new Date().toLocaleString()}</p>
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Price</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot><tr><td colspan="2"><strong>Total</strong></td><td><strong>₹${total}</strong></td></tr></tfoot>
      </table>
    </body></html>
  `;
  return html;
}

/* ======= Expose some functions to global for inline onclicks ======= */
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.filterProducts = filterProducts;
document.getElementById('applyFilters').addEventListener('click', filterProducts);

/* On first load (after login) show stored products */
if (sessionStorage.getItem(LOGGED_KEY) === '1') {
  loadProductsFromStorage();
  displayProducts(products);
}
