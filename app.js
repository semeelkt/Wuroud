// Render a product card for the grid
function productCardHtml(p) {
  return `
    <div class="product-card">
      <div class="prod-img-wrap">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />` : `<div class="no-img">No Image</div>`}
      </div>
      <div class="prod-info">
        <div class="prod-title">${escapeHtml(p.name)}</div>
        <div class="prod-meta">₹${p.price} | ${escapeHtml(p.category)}</div>
        <button class="btn add-to-bill" data-id="${p.id}">Add to Bill</button>
        <button class="btn remove-prod" data-id="${p.id}">Remove</button>
      </div>
    </div>
  `;
}
// app.js
// Requires firebase-config.js to set window.FIREBASE_CONFIG
console.log("app.js is loaded!");

// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, deleteDoc, query, orderBy, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.log("Persistence failed. Multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.log("Persistence is not supported by this browser.");
  }
});

// Firestore reference
const productsCol = collection(db, "products");
const userProductsCol = (userId) => collection(db, "users", userId, "products");

// UI Elements
const productGrid = document.getElementById("productGrid");
const addBtn = document.getElementById("addProductBtn");
const pName = document.getElementById("pName");
const pPrice = document.getElementById("pPrice");
const pCategoryInput = document.getElementById("pCategoryInput");
const pImage = document.getElementById("pImage");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const applyFilter = document.getElementById("applyFilter");

// Filter/search listeners
searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
minPrice.addEventListener("input", renderProducts);
maxPrice.addEventListener("input", renderProducts);
applyFilter.addEventListener("click", renderProducts);
const loginForm = document.getElementById("loginForm");
const authContainer = document.getElementById("authContainer");
const logoutBtn = document.getElementById("logoutBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// Local state
let cart = []; // Cart items
let products = []; // Snapshot cache

// Authentication functions
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showAuthUI(false);
    loadProducts();
  } catch (error) {
    console.error("Error signing in: ", error.message);
    alert("Error signing in: " + error.message);
  }
});

document.getElementById("signUpBtn").addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created successfully");
  } catch (error) {
    console.error("Error signing up: ", error.message);
    alert("Error signing up: " + error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showAuthUI(true);
  productGrid.innerHTML = '';
});

// Display login/signup form or products
function showAuthUI(isLoggedOut) {
  loginForm.style.display = isLoggedOut ? "block" : "none";
  logoutBtn.style.display = isLoggedOut ? "none" : "block";
  authContainer.style.display = isLoggedOut ? "none" : "block";
}

// Add product to Firestore under logged-in user's collection
addBtn.addEventListener("click", async () => {
  const name = pName.value.trim();
  const price = Number(pPrice.value);
  const category = pCategoryInput.value;
  const image = pImage.value.trim();
  const user = auth.currentUser;

  if (!name || !price) return alert("Please enter product name and price.");

  if (user) {
    await addDoc(productsCol, {
      name,
      price,
      category,
      image: image || "",
      createdAt: Date.now(),
      userId: user.uid
    });

  pName.value = "";
  pPrice.value = "";
  pImage.value = "";
  loadProducts();
  } else {
    alert("Please log in to add products.");
  }
});

// Listen to product changes for the logged-in user
function loadProducts() {
  // Show all products in the global collection, ordered by createdAt
  const q = query(productsCol, orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    products = [];
    snap.forEach(docSnap => {
      products.push({ id: docSnap.id, ...docSnap.data() });
    });
  renderProducts();
  populateCategoryFilter();
// Populate the category filter dropdown with unique categories from products
function populateCategoryFilter() {
  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
  categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
    categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
}
  });
}

// Render products based on filters
function renderProducts() {
  const qName = searchInput.value.trim().toLowerCase();
  const qCat = categoryFilter.value;
  const min = minPrice.value ? Number(minPrice.value) : -Infinity;
  const max = maxPrice.value ? Number(maxPrice.value) : Infinity;

  const filtered = products.filter(p => {
    const nameMatch = p.name.toLowerCase().includes(qName);
    const catMatch = qCat === "all" ? true : p.category === qCat;
    const priceMatch = p.price >= min && p.price <= max;
    return nameMatch && catMatch && priceMatch;
  });

  console.log("Rendering products:", filtered);
  productGrid.innerHTML = filtered.map(p => productCardHtml(p)).join("");
  attachProductCardListeners();
}

// Attach event listeners to product cards
function attachProductCardListeners() {
  document.querySelectorAll(".add-to-bill").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const product = products.find(p => p.id === id);
      if (!product) return;
      addToCart(product);
    };
  });

  document.querySelectorAll(".remove-prod").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!confirm("Delete this product?")) return;
      const user = auth.currentUser;
      if (user) {
        await deleteDoc(doc(db, "products", id));
        // Remove from UI immediately
        loadProducts();
      } else {
        alert("You must be logged in to remove products.");
      }
    };
  });
// Render a product card for the grid
function productCardHtml(p) {
  return `
    <div class="product-card">
      <div class="prod-img-wrap">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />` : `<div class="no-img">No Image</div>`}
      </div>
      <div class="prod-info">
        <div class="prod-title">${escapeHtml(p.name)}</div>
        <div class="prod-meta">₹${p.price} | ${escapeHtml(p.category)}</div>
        <button class="btn add-to-bill" data-id="${p.id}">Add to Bill</button>
        <button class="btn remove-prod" data-id="${p.id}">Remove</button>
      </div>
    </div>
  `;
}
}

// Add product to cart
function addToCart(product) {
  const found = cart.find(c => c.id === product.id);
  if (found) found.qty += 1;
  else cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  renderCart();
}

// Render the cart
function renderCart() {
  const billTableBody = document.querySelector("#billTable tbody");
  billTableBody.innerHTML = cart.map(item => {
    const sub = item.price * item.qty;
    return `
      <tr data-id="${item.id}">
        <td>${item.name}</td>
        <td>
          <input type="number" class="qty-input" value="${item.qty}" min="1" />
        </td>
        <td>₹${item.price}</td>
        <td>₹${sub}</td>
        <td><button class="btn ghost small-remove">Remove</button></td>
      </tr>
    `;
  }).join("");

  // Attach remove event listeners for cart items
  document.querySelectorAll('.small-remove').forEach(btn => {
    btn.onclick = function() {
      const tr = btn.closest('tr');
      const id = tr && tr.getAttribute('data-id');
      if (id) {
        cart = cart.filter(item => item.id !== id);
        renderCart();
      }
    };
  });
  // Update total
  updateTotal();
}

// Update total amount
function updateTotal() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById("grandTotal").textContent = `₹${total.toLocaleString()}`;
}

// Bill actions (PDF generation, print, WhatsApp)
document.getElementById("generatePdf").addEventListener("click", generatePDF);
document.getElementById("printBtn").addEventListener("click", printBill);
document.getElementById("whatsappBtn").addEventListener("click", shareOnWhatsApp);

function generatePDF() {
  const { jsPDF } = window.jspdf;  // Using jsPDF from the window object
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const head = [['Item', 'Qty', 'Price', 'Subtotal']];
  const body = cart.map(i => [
    i.name, String(i.qty), `₹${i.price.toLocaleString()}`, `₹${(i.price * i.qty).toLocaleString()}`
  ]);

  doc.setFontSize(14);
  doc.text("Wuroud Bill", 40, 40);
  doc.setFontSize(10);
  doc.text(`Mobile: ${document.getElementById("custMobile").value || '-'}`, 40, 60);
  doc.autoTable({
    head: head,
    body: body,
    startY: 90,
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240] },
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  doc.text(`Total: ₹${total.toLocaleString()}`, 40, doc.lastAutoTable.finalY + 30);
  doc.save(`Wuroud-bill-${Date.now()}.pdf`);
}

function printBill() {
  const w = window.open("", "_blank");
  const html = printableHtml();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

function printableHtml() {
  const rows = cart.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td>₹${i.price}</td>
      <td>₹${i.price * i.qty}</td>
    </tr>
  `).join("");
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString();

  return `
    <html><head><title>Wuroud Bill</title>
      <style>
        body{font-family:Inter, Arial; padding:20px; color:#111}
        table{width:100%;border-collapse:collapse}
        td,th{padding:8px;border:1px solid #eee}
        h2{margin:0 0 10px 0}
      </style>
    </head>
    <body>
      <h2>Wuroud Bill</h2>
      <div>Mobile: ${document.getElementById("custMobile").value || '-'}</div>
      <br/>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Sub</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3"><b>Total</b></td><td>₹${total}</td></tr></tfoot>
      </table>
    </body></html>
  `;
}

function shareOnWhatsApp() {
  if (cart.length === 0) return alert("Cart empty");
  const phone = document.getElementById("custMobile").value.trim();
  let message = `*Wuroud Bill*%0A`;

  cart.forEach(i => {
    message += `${i.name} x${i.qty} = ₹${(i.price * i.qty).toLocaleString()}%0A`;
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  message += `%0ATotal: ₹${total.toLocaleString()}`;
  const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;

  window.open(url, '_blank');
}

// Helper function to escape HTML characters
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
}
