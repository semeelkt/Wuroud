/* ========  Wuroud Admin – LocalStorage Upgrade  ======== */

const AUTH_KEY = "kt_admin_pw";
const LOGGED_KEY = "kt_logged_in";
const PRODUCTS_KEY = "kt_products";   // <-- NEW
const CART_KEY = "kt_cart";           // optional if you want to persist cart too

// Elements
const overlay = document.getElementById("authOverlay");
const setPassDiv = document.getElementById("setPassDiv");
const loginDiv = document.getElementById("loginDiv");
const authTitle = document.getElementById("authTitle");
const authMsg = document.getElementById("authMsg");

const app = document.getElementById("app");
const addProductBtn = document.getElementById("addProductBtn");
const productGrid = document.getElementById("productGrid");

const categoryFilter = document.getElementById("categoryFilter");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const applyFilters = document.getElementById("applyFilters");

const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const clearCartBtn = document.getElementById("clearCartBtn");
const logoutBtn = document.getElementById("logoutBtn");

// ================== AUTH ==================
if (!localStorage.getItem(AUTH_KEY)) {
  // no password yet
  setPassDiv.classList.remove("hidden");
} else {
  loginDiv.classList.remove("hidden");
}

// SHA-256 hash util
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Set password
document.getElementById("setPasswordBtn").onclick = async () => {
  const p1 = document.getElementById("newPassword").value.trim();
  const p2 = document.getElementById("newPasswordConfirm").value.trim();
  if (!p1 || p1 !== p2) return (authMsg.textContent = "Passwords don't match");
  const hash = await sha256(p1);
  localStorage.setItem(AUTH_KEY, hash);
  authMsg.textContent = "Password set! Please log in.";
  setPassDiv.classList.add("hidden");
  loginDiv.classList.remove("hidden");
};

// Login
document.getElementById("loginBtn").onclick = async () => {
  const pw = document.getElementById("passwordInput").value.trim();
  const hash = await sha256(pw);
  if (hash === localStorage.getItem(AUTH_KEY)) {
    sessionStorage.setItem(LOGGED_KEY, "true");
    overlay.classList.add("hidden");
    app.classList.remove("hidden");
    initApp();
  } else authMsg.textContent = "Incorrect password.";
};

// Auto-login if session active
if (sessionStorage.getItem(LOGGED_KEY)) {
  overlay.classList.add("hidden");
  app.classList.remove("hidden");
  initApp();
}

// Logout
logoutBtn.onclick = () => {
  sessionStorage.removeItem(LOGGED_KEY);
  location.reload();
};

// ================== DATA ==================
let products = [];
let cart = [];

function loadProducts() {
  products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "[]");
}

function saveProducts() {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

// ================== UI RENDER ==================
function renderProducts(list = products) {
  productGrid.innerHTML = "";
  list.forEach((p, idx) => {
    const card = document.createElement("div");
    card.className = "product";
    card.innerHTML = `
      <img src="${p.img || 'https://via.placeholder.com/240x160?text=No+Image'}" alt="">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button data-i="${idx}" class="add-cart">Add to Cart</button>
      <button data-i="${idx}" class="remove-btn">Remove</button>
    `;
    productGrid.appendChild(card);
  });
}

// ================== CART ==================
function renderCart() {
  cartList.innerHTML = "";
  let total = 0;
  cart.forEach((item, i) => {
    const li = document.createElement("li");
    li.textContent = `${item.name} - ₹${item.price}`;
    cartList.appendChild(li);
    total += item.price;
  });
  cartTotal.textContent = `Total: ₹${total}`;
}

// ================== EVENT HANDLERS ==================
addProductBtn.onclick = () => {
  const name = document.getElementById("pName").value.trim();
  const price = parseFloat(document.getElementById("pPrice").value);
  const category = document.getElementById("pCategory").value;
  const img = document.getElementById("pImg").value.trim();
  if (!name || isNaN(price)) return alert("Enter valid name and price");
  products.push({ name, price, category, img });
  saveProducts();
  renderProducts();
  document.getElementById("addProductForm").reset();
};

// Delegate Add/Remove inside product grid
productGrid.onclick = e => {
  if (e.target.classList.contains("add-cart")) {
    const i = e.target.dataset.i;
    cart.push(products[i]);
    renderCart();
  }
  if (e.target.classList.contains("remove-btn")) {
    const i = e.target.dataset.i;
    products.splice(i, 1);
    saveProducts();
    renderProducts();
  }
};

// Filters
applyFilters.onclick = e => {
  e.preventDefault();
  const cat = categoryFilter.value;
  const min = parseFloat(minPrice.value) || 0;
  const max = parseFloat(maxPrice.value) || Infinity;
  const filtered = products.filter(
    p =>
      (cat === "all" || p.category === cat) &&
      p.price >= min &&
      p.price <= max
  );
  renderProducts(filtered);
};

// Cart controls
clearCartBtn.onclick = () => {
  cart = [];
  renderCart();
};

document.getElementById("generateBillBtn").onclick = () => {
  alert("Bill PDF generation goes here!");
};
document.getElementById("sendWhatsAppBtn").onclick = () => {
  const num = document.getElementById("customerNumber").value.trim();
  if (!num) return alert("Enter customer number");
  const text = encodeURIComponent(
    `Thanks for shopping! Your total is ${cartTotal.textContent}`
  );
  window.open(`https://wa.me/${num}?text=${text}`, "_blank");
};

// ================== INIT ==================
function initApp() {
  loadProducts();
  renderProducts();
  renderCart();
}
