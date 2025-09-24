/* ---------- AUTH (password gate) ---------- */

// Keys
const AUTH_KEY   = 'kt_admin_pw';    
const LOGGED_KEY = 'kt_logged_in';   

// DOM elements
const overlay       = document.getElementById('authOverlay');
const setPassDiv    = document.getElementById('setPassDiv');
const loginDiv      = document.getElementById('loginDiv');
const authTitle     = document.getElementById('authTitle');
const authMsg       = document.getElementById('authMsg');
const newPassword   = document.getElementById('newPassword');
const newPassConf   = document.getElementById('newPasswordConfirm');
const setPasswordBtn= document.getElementById('setPasswordBtn');
const passwordInput = document.getElementById('passwordInput');
const loginBtn      = document.getElementById('loginBtn');
const app           = document.getElementById('app');
const logoutBtn     = document.getElementById('logoutBtn');

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
  loadProductsFromDB();
  updateCart();
}

/* ---------- FIREBASE CONFIG ---------- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

/* ---------- PRODUCTS ---------- */
let products = [];
const grid           = document.getElementById('productGrid');
const categoryFilter = document.getElementById('categoryFilter');
const minPrice       = document.getElementById('minPrice');
const maxPrice       = document.getElementById('maxPrice');
document.getElementById('applyFilters').addEventListener('click', filterProducts);

// Load products from Firestore
async function loadProductsFromDB() {
  const snapshot = await getDocs(collection(db, "products"));
  products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  displayProducts(products);
}

// Display products
function displayProducts(items) {
  grid.innerHTML = items.map((p, i) => `
    <div class="product">
      <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCart(${i})">Add to Bill</button>
      <button onclick="removeProduct('${p.id}')" class="remove-btn">Remove</button>
    </div>`).join('');
}

// Filter products
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

// Add product
document.getElementById('addProductBtn').addEventListener('click', async () => {
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  if (!name || isNaN(price)) return alert('Enter valid name & price');

  const newProd = {
    name,
    price,
    category: pCategory.value,
    img: pImg.value.trim()
  };
  await addDoc(collection(db, "products"), newProd);
  pName.value = pPrice.value = pImg.value = '';
  loadProductsFromDB();
});

// Remove product
async function removeProduct(id) {
  if (!confirm('Remove this product?')) return;
  await deleteDoc(doc(db, "products", id));
  loadProductsFromDB();
}

/* ---------- CART / BILL ---------- */
const cartList        = document.getElementById('cartList');
const cartTotal       = document.getElementById('cartTotal');
const customerNumber  = document.getElementById('customerNumber');
const generateBillBtn = document.getElementById('generateBillBtn');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const clearCartBtn    = document.getElementById('clearCartBtn');
const downloadPdfBtn  = document.getElementById('downloadPdfBtn');

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

// Print-friendly bill
generateBillBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const w = window.open('', '_blank');
  w.document.write(buildBillHTML());
  w.document.close();
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
/* ---------- AUTH (password gate) ---------- */

// Keys
const AUTH_KEY   = 'kt_admin_pw';    
const LOGGED_KEY = 'kt_logged_in';   

// DOM elements
const overlay       = document.getElementById('authOverlay');
const setPassDiv    = document.getElementById('setPassDiv');
const loginDiv      = document.getElementById('loginDiv');
const authTitle     = document.getElementById('authTitle');
const authMsg       = document.getElementById('authMsg');
const newPassword   = document.getElementById('newPassword');
const newPassConf   = document.getElementById('newPasswordConfirm');
const setPasswordBtn= document.getElementById('setPasswordBtn');
const passwordInput = document.getElementById('passwordInput');
const loginBtn      = document.getElementById('loginBtn');
const app           = document.getElementById('app');
const logoutBtn     = document.getElementById('logoutBtn');

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
  loadProductsFromDB();
  updateCart();
}

/* ---------- FIREBASE CONFIG ---------- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

/* ---------- PRODUCTS ---------- */
let products = [];
const grid           = document.getElementById('productGrid');
const categoryFilter = document.getElementById('categoryFilter');
const minPrice       = document.getElementById('minPrice');
const maxPrice       = document.getElementById('maxPrice');
document.getElementById('applyFilters').addEventListener('click', filterProducts);

// Load products from Firestore
async function loadProductsFromDB() {
  const snapshot = await getDocs(collection(db, "products"));
  products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  displayProducts(products);
}

// Display products
function displayProducts(items) {
  grid.innerHTML = items.map((p, i) => `
    <div class="product">
      <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCart(${i})">Add to Bill</button>
      <button onclick="removeProduct('${p.id}')" class="remove-btn">Remove</button>
    </div>`).join('');
}

// Filter products
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

// Add product
document.getElementById('addProductBtn').addEventListener('click', async () => {
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  if (!name || isNaN(price)) return alert('Enter valid name & price');

  const newProd = {
    name,
    price,
    category: pCategory.value,
    img: pImg.value.trim()
  };
  await addDoc(collection(db, "products"), newProd);
  pName.value = pPrice.value = pImg.value = '';
  loadProductsFromDB();
});

// Remove product
async function removeProduct(id) {
  if (!confirm('Remove this product?')) return;
  await deleteDoc(doc(db, "products", id));
  loadProductsFromDB();
}

/* ---------- CART / BILL ---------- */
const cartList        = document.getElementById('cartList');
const cartTotal       = document.getElementById('cartTotal');
const customerNumber  = document.getElementById('customerNumber');
const generateBillBtn = document.getElementById('generateBillBtn');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const clearCartBtn    = document.getElementById('clearCartBtn');
const downloadPdfBtn  = document.getElementById('downloadPdfBtn');

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

// Print-friendly bill
generateBillBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const w = window.open('', '_blank');
  w.document.write(buildBillHTML());
  w.document.close();
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
