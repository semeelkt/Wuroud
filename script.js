/* ---------- AUTH (password gate) ---------- */
const AUTH_KEY   = 'kt_admin_pw';
const LOGGED_KEY = 'kt_logged_in';

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

loginBtn.addEventListener('click', async () => {
  const p = passwordInput.value.trim();
  if (!p) return (authMsg.textContent = 'Enter password.');
  const hash = await hashString(p);
  if (hash === localStorage.getItem(AUTH_KEY)) {
    sessionStorage.setItem(LOGGED_KEY, '1');
    openApp();
  } else authMsg.textContent = 'Wrong password.';
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(LOGGED_KEY);
  location.reload();
});

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

function saveProductsToStorage() { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); }
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

document.getElementById('addProductBtn').addEventListener('click', () => {
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  if (!name || isNaN(price)) return alert('Enter valid name & price');
  products.push({ name, price, category: pCategory.value, img: pImg.value.trim() });
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

function addToCart(i) { if (!products[i]) return; cart.push(products[i]); updateCart(); }
function removeFromCart(i) { cart.splice(i, 1); updateCart(); }
function updateCart() {
  let total = 0;
  cartList.innerHTML = cart.map((it, idx) => {
    total += it.price;
    return `<li>${it.name} - ₹${it.price} <button class="remove-btn" onclick="removeFromCart(${idx})">❌</button></li>`;
  }).join('');
  cartTotal.textContent = cart.length ? `Total: ₹${total}` : 'No items selected.';
}

clearCartBtn.addEventListener('click', () => {
  if (cart.length && confirm('Clear current selection?')) { cart = []; updateCart(); }
});

function removeProduct(index) {
  if (confirm('Remove this product?')) {
    products.splice(index, 1);
    saveProductsToStorage();
    displayProducts(products);
  }
}

/* ---------- PDF BILL WITH html2pdf.js ---------- */
generateBillBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const billEl = document.createElement('div');
  billEl.innerHTML = buildBillHTML(true); // true = return inner content
  html2pdf().from(billEl).set({ margin:0.5, filename:'KT_Family_Bill.pdf', html2canvas:{scale:2} }).save();
});

sendWhatsAppBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in bill');
  const num = customerNumber.value.trim();
  if (!num) return alert('Enter customer mobile (e.g. 91XXXXXXXXXX)');
  let total = 0;
  const lines = cart.map((it, i) => { total += it.price; return `${i+1}. ${it.name} - ₹${it.price}`; });
  lines.unshift('KT Family Store - Bill','----------------------');
  lines.push('----------------------',`Total: ₹${total}`);
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
});

function buildBillHTML(inner=false) {
  let total=0;
  const rows = cart.map((it,i)=>{ total+=it.price; return `<tr><td>${i+1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`; }).join('');
  const content = `
    <h1>KT Family Store</h1>
    <p>Bill generated: ${new Date().toLocaleString()}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead><tr><th>#</th><th>Item</th><th>Price</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total</strong></td><td><strong>₹${total}</strong></td></tr></tfoot>
    </table>`;
  if(inner) return content;
  return `<html><head><title>Bill</title></head><body>${content}</body></html>`;
}

/* ---------- Init ---------- */
prepareAuthUI();
if(sessionStorage.getItem(LOGGED_KEY)==='1') openApp();

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.filterProducts = filterProducts;
window.removeProduct = removeProduct;
