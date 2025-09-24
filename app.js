// app.js
// Requires firebase-config.js to set window.FIREBASE_CONFIG
console.log("app.js is loaded!");
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, deleteDoc, query, orderBy, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log("Persistence failed. Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      console.log("Persistence is not supported by this browser.");
    }
  });

// Firestore collection reference
const productsCol = collection(db, "products");

// UI elements
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

const billTableBody = document.querySelector("#billTable tbody");
const grandTotalEl = document.getElementById("grandTotal");
const generatePdfBtn = document.getElementById("generatePdf");
const printBtn = document.getElementById("printBtn");
const whatsappBtn = document.getElementById("whatsappBtn");
const clearBillBtn = document.getElementById("clearBill");
const custMobile = document.getElementById("custMobile");

// local cart
let cart = []; // {id, name, price, qty}
let products = []; // snapshot cache

// Add product to Firestore
addBtn.addEventListener("click", async () => {
  const name = pName.value.trim();
  const price = Number(pPrice.value);
  const category = pCategoryInput.value;
  const image = pImage.value.trim();

  if (!name || !price) return alert("Enter product name and price.");

  await addDoc(productsCol, {
    name, price, category, image: image || "", createdAt: Date.now()
  });

  // Clear form fields after submitting
  pName.value = ""; pPrice.value = ""; pImage.value = "";
});

// Listen to changes in Firestore and render products
const q = query(productsCol, orderBy("createdAt", "desc"));
onSnapshot(q, snap => {
  products = [];
  snap.forEach(docSnap => {
    products.push({ id: docSnap.id, ...docSnap.data() });
  });
  renderProducts();
  populateCategoryFilter();
});

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

  productGrid.innerHTML = filtered.map(p => productCardHtml(p)).join("");
  attachProductCardListeners();
}

// Apply filters
applyFilter.addEventListener("click", () => renderProducts());
searchInput.addEventListener("input", () => renderProducts());

// Populate category filter dropdown
function populateCategoryFilter() {
  const cats = new Set(products.map(p => p.category));
  categoryFilter.innerHTML = `<option value="all">All Categories</option>` + [...cats].map(c => `<option value="${c}">${c}</option>`).join("");
}

// Generate HTML for product cards
function productCardHtml(p) {
  const img = p.image || "";
  return `
    <div class="prod-card" data-id="${p.id}">
      <div class="prod-image">${img ? `<img src="${img}" alt="${escapeHtml(p.name)}" style="max-width:100%;max-height:140px;object-fit:cover;">` : ''}</div>
      <div class="prod-body">
        <div class="prod-title">${escapeHtml(p.name)}</div>
        <div class="prod-price">₹${Number(p.price).toLocaleString()}</div>
      </div>
      <div class="prod-actions">
        <button class="btn add-to-bill" data-id="${p.id}">Add to Bill</button>
        <button class="btn ghost remove-prod" data-id="${p.id}">Remove</button>
      </div>
    </div>
  `;
}

// Attach event listeners to dynamic product card buttons
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
      await deleteDoc(doc(productsCol.firestore, `products/${id}`));
    };
  });
}

// Add product to the cart
function addToCart(product) {
  const found = cart.find(c => c.id === product.id);
  if (found) found.qty += 1;
  else cart.push({ id: product.id, name: product.name, price: Number(product.price), qty: 1 });
  renderCart();
}

// Change quantity of product in cart
function changeQty(id, qty) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty = qty;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  renderCart();
}

// Remove product from cart
function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

// Render the cart
function renderCart() {
  billTableBody.innerHTML = cart.map(item => {
    const sub = item.price * item.qty;
    return `<tr data-id="${item.id}">
      <td>${escapeHtml(item.name)}</td>
      <td>
        <input type="number" class="qty-input" value="${item.qty}" min="1" style="width:60px;padding:4px;border-radius:6px;border:1px solid #eee" />
      </td>
      <td>₹${Number(item.price).toLocaleString()}</td>
      <td>₹${sub.toLocaleString()}</td>
      <td><button class="btn ghost small-remove">Remove</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" style="color:var(--muted)">No items yet</td></tr>`;
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

// UI Elements
const loginForm = document.getElementById("loginForm");
const authContainer = document.getElementById("authContainer");
const productGrid = document.getElementById("productGrid");
const addProductBtn = document.getElementById("addProductBtn");
const pName = document.getElementById("pName");
const pPrice = document.getElementById("pPrice");
const pCategoryInput = document.getElementById("pCategoryInput");
const pImage = document.getElementById("pImage");
const logoutBtn = document.getElementById("logoutBtn");

// Firebase Firestore Collection
const productsCol = collection(db, "products");

// Event listeners for Authentication
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showAuthUI(false);  // Hide login form
    loadProducts();     // Load user-specific products
  } catch (error) {
    console.error("Error signing in: ", error.message);
  }
});

document.getElementById("signUpBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created successfully");
  } catch (error) {
    console.error("Error signing up: ", error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showAuthUI(true);  // Show login form
  productGrid.innerHTML = ''; // Clear products
});

// Display auth UI based on login status
function showAuthUI(isLoggedOut) {
  loginForm.style.display = isLoggedOut ? "block" : "none";
  logoutBtn.style.display = isLoggedOut ? "none" : "block";
  authContainer.style.display = isLoggedOut ? "block" : "none";
}

// Add product to Firestore
addProductBtn.addEventListener("click", async () => {
  const name = pName.value.trim();
  const price = Number(pPrice.value);
  const category = pCategoryInput.value;
  const image = pImage.value.trim();
  const user = auth.currentUser;

  if (!name || !price) return alert("Please enter product name and price.");
  
  if (user) {
    await add

  // Attach events
  document.querySelectorAll("#billTable .qty-input").forEach(input => {
    input.onchange = (e) => {
      const tr = e.target.closest("tr");
      const id = tr.dataset.id;
      const val = Number(e.target.value) || 1;
      changeQty(id, val);
    };
  });
  document.querySelectorAll(".small-remove").forEach(btn => {
    btn.onclick = (e) => {
      const id = e.target.closest("tr").dataset.id;
      removeFromCart(id);
    };
  }); 

  updateTotal();
}

// Update the total amount
function updateTotal() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  grandTotalEl.textContent = `₹${total.toLocaleString()}`;
}

/* Bill Download (PDF) */
generatePdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;  // Using jsPDF from the window object
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const head = [['Item', 'Qty', 'Price', 'Subtotal']];
  const body = cart.map(i => [
    i.name, String(i.qty), `₹${i.price.toLocaleString()}`, `₹${(i.price * i.qty).toLocaleString()}`
  ]);
  
  doc.setFontSize(14);
  doc.text("Wuroud Bill", 40, 40);
  doc.setFontSize(10);
  doc.text(`Mobile: ${custMobile.value || '-'}`, 40, 60);
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
});

/* Print Bill */
printBtn.addEventListener("click", () => {
  // open new window with printable table
  const w = window.open("", "_blank");
  const html = printableHtml();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  // optional: w.close();
});

// Share via WhatsApp
whatsappBtn.addEventListener("click", () => {
  if (cart.length === 0) return alert("Cart empty");
  const phone = custMobile.value.trim();
  let message = `*Wuroud Bill*%0A`;
  
  cart.forEach(i => {
    message += `${i.name} x${i.qty} = ₹${(i.price * i.qty).toLocaleString()}%0A`;
  });
  
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  message += `%0ATotal: ₹${total.toLocaleString()}`;
  const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
  
  window.open(url, '_blank');
});

/* Clear Bill */
clearBillBtn.addEventListener("click", () => {
  if (confirm("Clear cart?")) {
    cart = [];
    renderCart();
  }
});

/* HTML for printing */
function printableHtml() {
  const rows = cart.map(i => `
    <tr>
      <td>${escapeHtml(i.name)}</td>
      <td style="text-align:center">${i.qty}</td>
      <td>₹${(i.price).toLocaleString()}</td>
      <td>₹${(i.price * i.qty).toLocaleString()}</td>
    </tr>`).join("");
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
      <div>Mobile: ${escapeHtml(custMobile.value || '-')}</div>
      <br/>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Sub</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3"><b>Total</b></td><td>₹${total}</td></tr></tfoot>
      </table>
    </body></html>
  `;
}

/* Helper function to escape HTML */
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
}
