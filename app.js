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

// Clear Cart button functionality
document.getElementById("clearBill").addEventListener("click", () => {
  cart = [];
  renderCart();
});

function generatePDF() {
  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header (black and white, like sample)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0,0,0);
  doc.text('WUROUD', pageWidth/2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 18;
  doc.text('Puthirikal', pageWidth/2, y, { align: 'center' });
  y += 13;
  doc.text('PHONE : +91 9061706318', pageWidth/2, y, { align: 'center' });
  y += 13;
  doc.text('GSTIN : 33AAAGP0685F1ZH', pageWidth/2, y, { align: 'center' });
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Retail Invoice', pageWidth/2, y, { align: 'center' });

  // Bill meta
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  doc.text(`Date : ${dateStr}, ${timeStr}`, 40, y);
  y += 14;
  // Bill meta (no David Stores)
  doc.setFont('helvetica', 'normal');
  const billNo = getAndIncrementBillNo();
  doc.text(`Bill No: ${billNo}`, 40, y);
  doc.text(`Payment Mode: Cash`, 180, y);
  y += 13;
  doc.text('DR Ref : 2', 40, y);

  // Table header
  y += 18;
  doc.setLineWidth(0.7);
  doc.line(40, y, pageWidth-40, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 45, y);
  doc.text('Qty', 220, y);
  doc.text('Amt', 320, y);
  y += 8;
  doc.setLineWidth(0.5);
  doc.line(40, y, pageWidth-40, y);

  // Table body
  doc.setFont('helvetica', 'normal');
  let subTotal = 0;
  let itemY = y + 14;
  cart.forEach(i => {
    doc.text(i.name, 45, itemY);
    doc.text(String(i.qty), 220, itemY, { align: 'left' });
    doc.text(i.price.toFixed(2), 320, itemY, { align: 'left' });
    subTotal += i.price * i.qty;
    itemY += 14;
  });
  // Subtotal
  doc.setFont('helvetica', 'bold');
  doc.text('Sub Total', 45, itemY);
  doc.text(cart.reduce((s, i) => s + i.qty, 0).toString(), 220, itemY, { align: 'left' });
  doc.text(subTotal.toFixed(2), 320, itemY, { align: 'left' });
  // Add medium space before total
  y = itemY + 30;

  // Total (no discount/tax)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL', 45, y);
  doc.text(`Rs ${subTotal.toFixed(2)}`, 320, y, { align: 'left' });
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Cash :', 45, y); doc.text(`Rs ${subTotal.toFixed(2)}`, 320, y, { align: 'left' });
  y += 13;
  doc.text('Cash tendered:', 45, y); doc.text(`Rs ${subTotal.toFixed(2)}`, 320, y, { align: 'left' });

  // Footer
  y += 20;
  doc.setFontSize(8);
  doc.text('E & O E', pageWidth-80, y);

  doc.save(`Wuroud-bill-${Date.now()}.pdf`);
  const finalY = doc.lastAutoTable.finalY;

  // Total summary box
  doc.setFillColor(248,246,255);
  doc.roundedRect(pageWidth-210, finalY+20, 160, 38, 8, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40,40,40);
  // Draw 'Total' and amount in one line, same color, spaced apart
  const totalLabel = 'Total';
  const totalAmount = safeRupee(total);
  const totalBoxX = pageWidth-210+16;
  const totalBoxY = finalY+44;
  doc.text(totalLabel, totalBoxX, totalBoxY);
  doc.text(totalAmount, pageWidth-60, totalBoxY, { align: 'right' });

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
  // Black and white, match sample image
  const rows = cart.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">${i.price.toFixed(2)}</td>
    </tr>
  `).join("");
  const subTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const billNo = getAndIncrementBillNo();
  return `
    <html><head><title>Wuroud Bill</title>
      <style>
        body { font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; }
        .bill-wrap { max-width: 340px; margin: 0 auto; border: 1px solid #000; padding: 18px 12px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1.5px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 2px 2px; }
        th { border-bottom: 1px solid #000; }
        td { border-bottom: 1px solid #eee; }
        .right { text-align: right; }
        .small { font-size: 11px; }
        .spacer { height: 24px; }
      </style>
    </head><body>
      <div class="bill-wrap">
        <div class="center bold" style="font-size:16px;">WUROUD</div>
        <div class="center small">Puthirikal</div>
        <div class="center small">PHONE : +91 9061706318</div>
        <div class="center small">GSTIN : 33AAAGP0685F1ZH</div>
        <div class="center bold" style="margin:8px 0 4px 0;">Retail Invoice</div>
        <div class="small">Date : ${new Date().toLocaleDateString()}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="small">Bill No: ${billNo} &nbsp; Payment Mode: Cash</div>
        <div class="small">DR Ref : 2</div>
        <div class="divider"></div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th class="right">Amt</th></tr></thead>
          <tbody>${rows}</tbody>
          <tr class="bold"><td>Sub Total</td><td style="text-align:center">${totalQty}</td><td class="right">${subTotal.toFixed(2)}</td></tr>
        </table>
        <div class="spacer"></div>
        <table style="font-size:13px;">
          <tr class="bold"><td>TOTAL</td><td class="right">Rs ${subTotal.toFixed(2)}</td></tr>
          <tr><td>Cash :</td><td class="right">Rs ${subTotal.toFixed(2)}</td></tr>
          <tr><td>Cash tendered:</td><td class="right">Rs ${subTotal.toFixed(2)}</td></tr>
        </table>
        <div class="divider"></div>
        <div class="right small">E & O E</div>
      </div>
    </body></html>
  `;
// Bill number generator: AA1, AA2, ..., ZZZZ9, then continues infinitely
function getAndIncrementBillNo() {
  let billNo = localStorage.getItem('wuroud_bill_no') || 'AA1';
  const next = nextBillNo(billNo);
  localStorage.setItem('wuroud_bill_no', next);
  return billNo;
}

function nextBillNo(current) {
  // Find the numeric part at the end
  const match = current.match(/([A-Z]+)(\d+)$/);
  if (!match) return 'AA1';
  let [_, letters, num] = match;
  num = parseInt(num, 10) + 1;
  if (num > 9) {
    // increment letters
    letters = incrementLetters(letters);
    num = 1;
  }
  return letters + num;
}

function incrementLetters(letters) {
  // Like base-26 increment, but with A-Z
  let arr = letters.split('');
  let i = arr.length - 1;
  while (i >= 0) {
    if (arr[i] === 'Z') {
      arr[i] = 'A';
      i--;
    } else {
      arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1);
      return arr.join('');
    }
  }
  // If all Z, add another letter
  return 'A' + arr.join('');
}
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
