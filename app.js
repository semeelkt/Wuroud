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
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header with colored background
  doc.setFillColor(123, 31, 162); // purple
  doc.roundedRect(30, y, pageWidth - 60, 50, 10, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255,255,255);
  doc.setFontSize(22);
  doc.text('Wuroud Bill', pageWidth/2, y + 32, { align: 'center' });

  y += 70;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(120,120,120);
  doc.text(`Mobile: ${document.getElementById("custMobile").value || '-'}`, 40, y);

  y += 18;
  // Table
  const head = [['Item', 'Qty', 'Price', 'Subtotal']];
  const body = cart.map(i => [
    i.name,
    String(i.qty),
    '\u20B9' + i.price.toLocaleString(),
    '\u20B9' + (i.price * i.qty).toLocaleString()
  ]);
  doc.autoTable({
    head: head,
    body: body,
    startY: y + 10,
    theme: 'grid',
    headStyles: { fillColor: [245, 245, 250], textColor: [123,31,162], fontStyle: 'bold' },
    styles: { font: 'helvetica', fontSize: 11, cellPadding: 6 },
    bodyStyles: { textColor: [40,40,40] },
    tableLineColor: [240,240,240],
    tableLineWidth: 0.8,
    margin: { left: 40, right: 40 },
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const finalY = doc.lastAutoTable.finalY;

  // Total summary box
  doc.setFillColor(248,246,255);
  doc.roundedRect(pageWidth-200, finalY+20, 140, 38, 8, 8, 'F');
  doc.setFontSize(13);
  doc.setTextColor(123,31,162);
  doc.text('Total', pageWidth-190, finalY+42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40,40,40);
  doc.text('\u20B9' + total.toLocaleString(), pageWidth-120, finalY+44, { align: 'right' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(170,170,170);
  doc.text('Thank you for shopping with Wuroud!', pageWidth/2, finalY+80, { align: 'center' });

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
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', Arial, sans-serif;
          background: #f7f8fa;
          color: #222;
          padding: 32px 0;
        }
        .bill-container {
          max-width: 480px;
          margin: 0 auto;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          padding: 32px 28px 28px 28px;
        }
        .bill-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .bill-logo {
          width: 38px; height: 38px; border-radius: 8px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; color: #7b1fa2; letter-spacing: 1px;
        }
        .bill-title {
          font-size: 1.5rem;
          font-weight: 600;
          letter-spacing: 1px;
        }
        .bill-meta {
          color: #888;
          font-size: 0.98rem;
          margin-bottom: 18px;
        }
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 18px;
        }
        th, td {
          padding: 10px 8px;
          text-align: left;
        }
        thead th {
          background: #f5f5fa;
          color: #7b1fa2;
          font-weight: 600;
          border-bottom: 2px solid #ececec;
        }
        tbody td {
          border-bottom: 1px solid #f0f0f0;
        }
        tfoot td {
          font-size: 1.1rem;
          font-weight: 600;
          color: #222;
          background: #f8f6ff;
          border-top: 2px solid #ececec;
        }
        .bill-footer {
          text-align: center;
          color: #aaa;
          font-size: 0.95rem;
          margin-top: 18px;
        }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <div class="bill-header">
          <div class="bill-logo">W</div>
          <div class="bill-title">Wuroud Bill</div>
        </div>
        <div class="bill-meta">Mobile: ${document.getElementById("custMobile").value || '-'}</div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Sub</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td>₹${total}</td></tr></tfoot>
        </table>
        <div class="bill-footer">Thank you for shopping with Wuroud!</div>
      </div>
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
