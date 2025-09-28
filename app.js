// app.js
// Requires firebase-config.js to set window.FIREBASE_CONFIG
console.log("app.js is loaded!");

// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, deleteDoc, query, orderBy, enableIndexedDbPersistence, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
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
const transactionsCol = collection(db, "transactions");

// UI Elements
const productGrid = document.getElementById("productGrid");
const addBtn = document.getElementById("addProductBtn");
const pName = document.getElementById("pName");
const pPrice = document.getElementById("pPrice");
const pCategoryInput = document.getElementById("pCategoryInput");
const pImage = document.getElementById("pImage");
const pKeywords = document.getElementById("pKeywords");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
// Packet option elements
const isPacketCheckbox = document.getElementById("isPacketCheckbox");
const packetSizeWrap = document.getElementById("packetSizeWrap");
const packetSizeInput = document.getElementById("packetSizeInput");

// Filter/search listeners
searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
minPrice.addEventListener("input", renderProducts);
maxPrice.addEventListener("input", renderProducts);

// Show/hide packet size input
if (isPacketCheckbox && packetSizeWrap) {
  isPacketCheckbox.addEventListener("change", function() {
    packetSizeWrap.style.display = this.checked ? "block" : "none";
    if (!this.checked && packetSizeInput) packetSizeInput.value = "";
  });
}
const loginForm = document.getElementById("loginForm");
const authContainer = document.getElementById("authContainer");
const logoutBtn = document.getElementById("logoutBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// Local state
let cart = []; // Cart items
let products = []; // Snapshot cache
let transactions = []; // Today's transactions
let dailyTotals = {}; // Store daily totals by date
let performanceChart = null; // Chart.js instance
const DAILY_TARGET = 2000; // Daily target in rupees

// Stock threshold for alerts
const LOW_STOCK_THRESHOLD = 5; // Alert when stock <= 5

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
    // onAuthStateChanged will handle UI updates and loading
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
  // onAuthStateChanged will handle UI cleanup
});

// Notification Bell Functionality
let notificationState = {
  lowStockItems: [],
  isOpen: false,
  hasBeenViewed: false
};

// Initialize notification bell
function initializeNotificationBell() {
  const bellButton = document.getElementById('notificationBell');
  const bellBadge = document.getElementById('notificationBadge');
  const notificationPanel = document.getElementById('notificationPanel');
  const notificationOverlay = document.getElementById('notificationOverlay');
  const closeBtn = document.getElementById('closeNotificationPanel');
  const notificationContent = document.getElementById('notificationContent');

  if (!bellButton) return;

  // Bell click handler
  bellButton.addEventListener('click', () => {
    toggleNotificationPanel();
  });

  // Close button handler
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeNotificationPanel();
    });
  }

  // Overlay click handler
  if (notificationOverlay) {
    notificationOverlay.addEventListener('click', () => {
      closeNotificationPanel();
    });
  }

  // Update notifications periodically
  setInterval(updateNotifications, 10000); // Check every 10 seconds
}

function toggleNotificationPanel() {
  const notificationPanel = document.getElementById('notificationPanel');
  const notificationOverlay = document.getElementById('notificationOverlay');
  
  if (notificationState.isOpen) {
    closeNotificationPanel();
  } else {
    openNotificationPanel();
  }
}

function openNotificationPanel() {
  const notificationPanel = document.getElementById('notificationPanel');
  const notificationOverlay = document.getElementById('notificationOverlay');
  
  notificationState.isOpen = true;
  notificationState.hasBeenViewed = true;
  
  if (notificationPanel) {
    notificationPanel.classList.add('show');
  }
  if (notificationOverlay) {
    notificationOverlay.classList.add('show');
  }
  
  updateNotificationContent();
  updateBellBadge();
}

function closeNotificationPanel() {
  const notificationPanel = document.getElementById('notificationPanel');
  const notificationOverlay = document.getElementById('notificationOverlay');
  
  notificationState.isOpen = false;
  
  if (notificationPanel) {
    notificationPanel.classList.remove('show');
  }
  if (notificationOverlay) {
    notificationOverlay.classList.remove('show');
  }
}

function updateNotifications() {
  const lowStockProducts = [];
  const outOfStockProducts = [];
  
  products.forEach(product => {
    const stock = getProductStock(product.id);
    if (stock === 0) {
      outOfStockProducts.push({...product, stock: 0});
    } else if (stock <= LOW_STOCK_THRESHOLD && stock > 0) {
      lowStockProducts.push({...product, stock});
    }
  });
  
  // Combine low stock and out of stock items
  notificationState.lowStockItems = [...lowStockProducts, ...outOfStockProducts];
  
  updateBellBadge();
  
  if (notificationState.isOpen) {
    updateNotificationContent();
  }
}

function updateBellBadge() {
  const bellBadge = document.getElementById('notificationBadge');
  
  if (!bellBadge) return;
  
  const count = notificationState.lowStockItems.length;
  
  if (count > 0 && !notificationState.hasBeenViewed) {
    bellBadge.textContent = count > 99 ? '99+' : count.toString();
    bellBadge.classList.remove('hidden');
  } else {
    bellBadge.classList.add('hidden');
  }
}

function updateNotificationContent() {
  const notificationContent = document.getElementById('notificationContent');
  
  if (!notificationContent) return;
  
  if (notificationState.lowStockItems.length === 0) {
    notificationContent.innerHTML = `
      <div class="no-alerts">No low stock alerts at the moment</div>
    `;
    return;
  }
  
  const notificationHTML = notificationState.lowStockItems.map(item => {
    const isOutOfStock = item.stock === 0;
    const stockLevel = isOutOfStock ? 'Out of Stock' : `${item.stock} items left`;
    const stockClass = isOutOfStock ? 'stock-level out-of-stock' : 'stock-level';
    
    return `
      <div class="notification-item">
        <h4>${escapeHtml(item.name)}</h4>
        <p class="${stockClass}">${stockLevel}</p>
        <p>Category: ${escapeHtml(item.category || 'Uncategorized')}</p>
      </div>
    `;
  }).join('');
  
  notificationContent.innerHTML = notificationHTML;
}

// Display login/signup form or products
function showAuthUI(isLoggedOut) {
  // Toggle visibility using CSS classes
  if (isLoggedOut) {
    loginForm.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  } else {
    loginForm.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
  }
  
  // Show/hide main content based on auth state
  const mainContent = document.querySelector('main');
  if (mainContent) {
    if (isLoggedOut) {
      mainContent.classList.add('hidden');
    } else {
      mainContent.classList.remove('hidden');
    }
  }
  
  // Position auth container appropriately
  if (isLoggedOut) {
    authContainer.style.position = "fixed";
    authContainer.style.top = "50%";
    authContainer.style.left = "50%";
    authContainer.style.transform = "translate(-50%, -50%)";
    authContainer.style.zIndex = "1000";
  } else {
    authContainer.style.position = "static";
    authContainer.style.transform = "none";
    authContainer.style.zIndex = "auto";
  }
}

// Add product to Firestore under logged-in user's collection
addBtn.addEventListener("click", async () => {
  const name = pName.value.trim();
  const price = Number(pPrice.value);
  const stock = Number(document.getElementById("pStock").value) || 0;
  const category = pCategoryInput.value;
  const image = pImage.value.trim();
  const keywords = pKeywords ? pKeywords.value.trim() : "";
  const user = auth.currentUser;
  const isPacket = isPacketCheckbox && isPacketCheckbox.checked;
  const packetSize = isPacket && packetSizeInput ? Number(packetSizeInput.value) : null;

  if (!name || !price) return alert("Please enter product name and price.");
  if (stock < 0) return alert("Stock quantity cannot be negative.");
  if (isPacket && (!packetSize || packetSize < 1)) return alert("Please enter a valid packet size.");

  if (user) {
    await addDoc(productsCol, {
      name,
      price,
      category,
      image: image || "",
      stock: stock,
      isPacket: !!isPacket,
      packetSize: isPacket ? packetSize : null,
      keywords,
      createdAt: Date.now(),
      userId: user.uid
    });

  pName.value = "";
  pPrice.value = "";
  document.getElementById("pStock").value = "";
  pImage.value = "";
  if (pKeywords) pKeywords.value = "";
  if (isPacketCheckbox) isPacketCheckbox.checked = false;
  if (packetSizeInput) packetSizeInput.value = "";
  if (packetSizeWrap) packetSizeWrap.style.display = "none";
  loadProducts();
  } else {
    alert("Please log in to add products.");
  }
});

// Populate the category filter dropdown with unique categories from products
function populateCategoryFilter() {
  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
  categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
    categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
}

// Listen to product changes for the logged-in user
function loadProducts() {
  console.log("🔥 Loading products from Firebase...");
  // Show all products in the global collection, ordered by createdAt
  const q = query(productsCol, orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    console.log("📡 Firebase snapshot received, documents count:", snap.size);
    products = [];
    snap.forEach(docSnap => {
      const productData = docSnap.data();
      console.log("📦 Product loaded:", docSnap.id, productData);
      products.push({ id: docSnap.id, ...productData });
      
      // Always use stock from Firebase database
      if (productData.stock !== undefined) {
        productStocks[docSnap.id] = productData.stock;
        console.log(`📊 Stock loaded from Firebase for ${productData.name}: ${productData.stock}`);
      } else {
        productStocks[docSnap.id] = 0; // Default to 0 if no stock specified
        console.log(`⚠️  No stock data in Firebase for ${productData.name}, defaulting to 0`);
      }
    });
    console.log("💾 Final products array:", products.length, "items");
    console.log("📊 Final productStocks:", productStocks);
    renderProducts();
    populateCategoryFilter();
    populateStockFilters();
    updateStockDisplay();
  }, error => {
    console.error("❌ Firebase connection error:", error);
  });
}

// Render products based on filters
function renderProducts() {
  const qName = searchInput.value.trim().toLowerCase();
  const qCat = categoryFilter.value;
  const min = minPrice.value ? Number(minPrice.value) : -Infinity;
  const max = maxPrice.value ? Number(maxPrice.value) : Infinity;

  const filtered = products.filter(p => {
    // Search by name or keywords
    let keywords = [];
    if (Array.isArray(p.keywords)) {
      keywords = p.keywords.map(k => String(k).toLowerCase());
    } else if (typeof p.keywords === 'string') {
      keywords = p.keywords.split(',').map(k => k.trim().toLowerCase());
    }
    const nameMatch = p.name.toLowerCase().includes(qName);
    const keywordMatch = keywords.some(k => k.includes(qName));
    const catMatch = qCat === "all" ? true : p.category === qCat;
    const priceMatch = p.price >= min && p.price <= max;
    return (nameMatch || keywordMatch) && catMatch && priceMatch;
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

  // Sell Packet button logic: add packet to cart
  document.querySelectorAll(".sell-packet").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const packetProduct = products.find(p => p.id === id);
      if (!packetProduct || !packetProduct.isPacket || !packetProduct.packetSize) return;
      // Add to cart as a packet item
      const found = cart.find(c => c.id === packetProduct.id && c.isPacket);
      if (found) {
        found.qty += 1;
      } else {
        cart.push({
          id: packetProduct.id,
          name: packetProduct.name + ' (Packet)',
          price: packetProduct.price,
          qty: 1,
          isPacket: true,
          packetSize: packetProduct.packetSize
        });
      }
      renderCart();
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
}

// Render a product card for the grid
function productCardHtml(p) {
  const stock = getProductStock(p.id);
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;
  
  let stockClass = 'stock-normal';
  let stockText = `Stock: ${stock}`;
  
  if (isOutOfStock) {
    stockClass = 'stock-out';
    stockText = 'Out of Stock';
  } else if (isLowStock) {
    stockClass = 'stock-low';
    stockText = `Low Stock: ${stock}`;
  }
  
  return `
    <div class="product-card">
      <div class="prod-img-wrap">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />` : `<div class="no-img">No Image</div>`}
      </div>
      <div class="prod-info">
        <div class="prod-title">${escapeHtml(p.name)}</div>
        <div class="prod-meta">₹${p.price} | ${escapeHtml(p.category)}</div>
        <div class="prod-stock ${stockClass}">${stockText}</div>
        ${p.isPacket && p.packetSize ? `<div class="prod-packet-info">Packet of ${p.packetSize}</div>` : ''}
        <button class="btn add-to-bill" data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>
          ${isOutOfStock ? 'Out of Stock' : 'Add to Bill'}
        </button>
        ${p.isPacket && p.packetSize ? `<button class="btn sell-packet" data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>Sell Packet</button>` : ''}
        <button class="btn remove-prod" data-id="${p.id}">Remove</button>
      </div>
    </div>
  `;
}

// Add product to cart (don't decrease stock until bill is completed)
function addToCart(product) {
  // Check if we can add this item (considering what's already in cart)
  const currentStock = getProductStock(product.id);
  const cartItem = cart.find(c => c.id === product.id);
  const cartQuantity = cartItem ? cartItem.qty : 0;
  
  if (currentStock <= cartQuantity) {
    alert(`Sorry, only ${currentStock} ${product.name} available in stock!`);
    return;
  }
  
  const found = cart.find(c => c.id === product.id);
  if (found) {
    found.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  }
  
  renderCart();
}

// Add transaction to Firestore
async function addTransaction(product) {
  const now = new Date();
  const transaction = {
    productId: product.id,
    productName: product.name,
    price: product.price,
    timestamp: now.toISOString(),
    date: getDateString(now),
    user: auth.currentUser ? auth.currentUser.email : null
  };
  try {
    await addDoc(transactionsCol, transaction);
  } catch (e) {
    console.error('Error adding transaction to Firestore:', e);
  }
}

// Render the cart
function renderCart() {
  const billTableBody = document.querySelector("#billTable tbody");
  billTableBody.innerHTML = cart.map(item => {
    const sub = item.price * item.qty;
    // Style for packet label
    const isPacket = item.isPacket;
    const nameHtml = isPacket
      ? `<span>${escapeHtml(item.name.replace(/ \(Packet\)$/,''))}<span class="packet-label-cart"> (Packet)</span></span>`
      : escapeHtml(item.name);
    return `
      <tr data-id="${item.id}">
        <td>${nameHtml}</td>
        <td>
          <input type="number" class="qty-input" value="${item.qty}" min="1" data-item-id="${item.id}" />
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
  
  // Attach quantity change listeners
  document.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', function() {
      const itemId = this.getAttribute('data-item-id');
      const newQty = Number(this.value) || 1;
      const cartItem = cart.find(item => item.id === itemId);
      
      if (cartItem) {
        const currentStock = getProductStock(itemId);
        
        // Check if we have enough stock for the new quantity
        if (newQty > currentStock) {
          alert(`Only ${currentStock} items available in stock!`);
          this.value = cartItem.qty;
          return;
        }
        
        cartItem.qty = newQty;
        updateTotal();
      }
    });
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

// Complete the sale and decrease stock
function completeSale() {
  if (cart.length === 0) {
    alert('Cart is empty!');
    return false;
  }
  
  // Check stock availability for all items
  for (let item of cart) {
    if (item.isPacket) {
      // For packet, check both packet and base product stock
      const packetProduct = products.find(p => p.id === item.id);
      const baseProduct = products.find(p => p.name === packetProduct.name && !p.isPacket);
      const packetStock = getProductStock(packetProduct.id);
      const baseStock = baseProduct ? getProductStock(baseProduct.id) : 0;
      if (packetStock < item.qty) {
        alert(`Insufficient packet stock for ${item.name}. Available: ${packetStock}, Required: ${item.qty}`);
        return false;
      }
      if (!baseProduct || baseStock < item.packetSize * item.qty) {
        alert(`Insufficient base product stock for ${item.name}. Need ${item.packetSize * item.qty}, available: ${baseStock}`);
        return false;
      }
    } else {
      const currentStock = getProductStock(item.id);
      if (currentStock < item.qty) {
        alert(`Insufficient stock for ${item.name}. Available: ${currentStock}, Required: ${item.qty}`);
        return false;
      }
    }
  }

  // Decrease stock for all items
  cart.forEach(item => {
    if (item.isPacket) {
      // Decrease packet product stock
      decreaseStock(item.id, item.qty);
      // Decrease base product stock
      const packetProduct = products.find(p => p.id === item.id);
      const baseProduct = products.find(p => p.name === packetProduct.name && !p.isPacket);
      if (baseProduct) {
        decreaseStock(baseProduct.id, item.packetSize * item.qty);
      }
      // Track each sold packet as a separate transaction
      for (let i = 0; i < item.qty; i++) {
        addTransaction({
          id: item.id,
          name: item.name,
          price: item.price
        });
      }
    } else {
      decreaseStock(item.id, item.qty);
      // Track each sold item as a separate transaction
      for (let i = 0; i < item.qty; i++) {
        addTransaction({
          id: item.id,
          name: item.name,
          price: item.price
        });
      }
    }
  });
  
  // Log sale completion
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  console.log(`Sale completed! ${itemCount} items sold for ₹${totalAmount.toLocaleString()}`);
  
  updateTransactionDisplay();
  return true;
}

function generatePDF() {
  // Complete the sale first
  if (!completeSale()) return;
  
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
  // Use Rs. as fallback if ₹ is not supported by the PDF font
  function safeRupee(amount) {
    return 'Rs. ' + amount.toLocaleString();
  }
  const body = cart.map(i => [
    i.name,
    String(i.qty),
    safeRupee(i.price),
    safeRupee(i.price * i.qty)
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
  
  // Clear cart after successful PDF generation
  cart = [];
  renderCart();
}

function printBill() {
  // Complete the sale first
  if (!completeSale()) return;
  
  const w = window.open("", "_blank");
  const html = printableHtml();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  
  // Clear cart after successful print
  cart = [];
  renderCart();
}

function printableHtml() {
  const rows = cart.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td>${i.price}</td>
      <td>${i.price * i.qty}</td>
    </tr>
  `).join("");
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return `
    <html><head><title>WUROUD BILL</title>
      <style>
        body {
          width: 80mm;
          margin: 0 auto;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #000;
          background: #fff;
        }
        .receipt {
          width: 100%;
          margin: 0;
          padding: 0;
        }
        .shop-header {
          text-align: center;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 4px;
          margin-top: 0;
          line-height: 1.3;
        }
        .shop-header .shop-name {
          font-size: 15px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .shop-header .shop-address,
        .shop-header .shop-phone {
          font-size: 12px;
          font-weight: normal;
        }
        .meta {
          font-size: 12px;
          margin-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-bottom: 6px;
        }
        th, td {
          padding: 2px 0;
          text-align: left;
          border: none;
        }
        th {
          border-bottom: 1px dashed #000;
          font-weight: bold;
        }
        tfoot td {
          font-weight: bold;
          font-size: 13px;
          border-top: 1px solid #000;
        }
        .footer {
          text-align: center;
          font-size: 12px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="shop-header">
          <div class="shop-name">WUROUD</div>
          <div class="shop-address">PUTHIRIKKAL, PARAPPANGADI ROAD</div>
          <div class="shop-phone">Phone: +91 9061706318</div>
        </div>
        <div class="meta">Date: ${new Date().toLocaleString()}</div>
        <div class="meta">Mobile: ${document.getElementById("custMobile").value || '-'}</div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amt</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="3">TOTAL</td><td>${total}</td></tr></tfoot>
        </table>
        <div class="footer">Thank you for shopping with WUROUD!</div>
      </div>
    </body></html>
  `;
}

function shareOnWhatsApp() {
  if (cart.length === 0) return alert("Cart empty");
  
  // Complete the sale first
  if (!completeSale()) return;
  const phone = document.getElementById("custMobile").value.trim();
  let message = `*Wuroud Bill*%0A`;

  cart.forEach(i => {
    message += `${i.name} x${i.qty} = ₹${(i.price * i.qty).toLocaleString()}%0A`;
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  message += `%0ATotal: ₹${total.toLocaleString()}`;
  const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;

  window.open(url, '_blank');
  
  // Clear cart after successful WhatsApp share
  cart = [];
  renderCart();
}

// Helper function to escape HTML characters
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
}

// Enhanced stock checking function for notification bell
function checkLowStockAlerts() {
  const lowStockProducts = [];
  const outOfStockProducts = [];
  
  products.forEach(product => {
    const stock = getProductStock(product.id);
    if (stock === 0) {
      outOfStockProducts.push(product);
    } else if (stock <= LOW_STOCK_THRESHOLD && stock > 0) {
      lowStockProducts.push({...product, stock});
    }
  });
  
  // Log alerts to console for debugging
  lowStockProducts.forEach(product => {
    console.log(`Low Stock Alert: ${product.name} has only ${product.stock} items left!`);
  });
  
  outOfStockProducts.forEach(product => {
    console.log(`Out of Stock: ${product.name} is completely out of stock!`);
  });
  
  // Update notification system if new alerts are found
  const totalAlerts = lowStockProducts.length + outOfStockProducts.length;
  const previousAlerts = notificationState.lowStockItems.length;
  
  if (totalAlerts > previousAlerts) {
    // New alerts found, reset viewed state
    notificationState.hasBeenViewed = false;
  }
  
  // Update notifications
  updateNotifications();
  
  return { lowStock: lowStockProducts.length, outOfStock: outOfStockProducts.length };
}

// Global functions
window.checkLowStockAlerts = checkLowStockAlerts;

// Transaction Management Functions
function getDateString(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

function getTodayString() {
  return getDateString(new Date());
}

function saveTransactionsToStorage() {
  localStorage.setItem('wuroud_transactions', JSON.stringify(transactions));
  localStorage.setItem('wuroud_daily_totals', JSON.stringify(dailyTotals));
}

function loadTransactionsFromStorage() {
  const savedTransactions = localStorage.getItem('wuroud_transactions');
  const savedTotals = localStorage.getItem('wuroud_daily_totals');
  
  if (savedTransactions) {
    transactions = JSON.parse(savedTransactions);
  }
  if (savedTotals) {
    dailyTotals = JSON.parse(savedTotals);
  }
  
  // Clean up old transactions (remove items older than today but keep totals)
  cleanupOldTransactions();
}

function cleanupOldTransactions() {
  const today = getTodayString();
  const todayTransactions = transactions.filter(t => t.date === today);
  
  // Calculate total for completed days and save to dailyTotals
  const groupedByDate = {};
  transactions.forEach(t => {
    if (t.date !== today) {
      if (!groupedByDate[t.date]) groupedByDate[t.date] = 0;
      groupedByDate[t.date] += t.price;
    }
  });
  
  // Update dailyTotals
  Object.keys(groupedByDate).forEach(date => {
    dailyTotals[date] = groupedByDate[date];
  });
  
  // Keep only today's transactions
  transactions = todayTransactions;
  
  // Keep only last 30 days of daily totals
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = getDateString(thirtyDaysAgo);
  
  Object.keys(dailyTotals).forEach(date => {
    if (date < cutoffDate) {
      delete dailyTotals[date];
    }
  });
  
  saveTransactionsToStorage();
}

// Remove transaction from Firestore
async function removeTransaction(transactionId, productId) {
  try {
    await deleteDoc(doc(db, "transactions", transactionId));
    if (productId) {
      // Find the product in the products array
      const product = products.find(p => p.id === productId);
      if (product && product.isPacket && product.packetSize) {
        // Restock the packet product
        increaseStock(productId, 1);
        // Find the base (single) product by name and not packet
        const baseProduct = products.find(p => p.name === product.name && !p.isPacket);
        if (baseProduct) {
          increaseStock(baseProduct.id, product.packetSize);
        }
      } else {
        // Not a packet, just restock the product
        increaseStock(productId, 1);
      }
    }
  } catch (e) {
    console.error('Error removing transaction from Firestore:', e);
  }
}

function getTodayTotal() {
  return transactions.reduce((total, t) => {
    if (t.date === getTodayString()) {
      return total + t.price;
    }
    return total;
  }, 0);
}

function getMonthTotal() {
  const todayTotal = getTodayTotal();
  const dailyTotal = Object.values(dailyTotals).reduce((sum, total) => sum + total, 0);
  return todayTotal + dailyTotal;
}

function updateTransactionDisplay() {
  updateTodayTransactions();
  updateMonthTransactions();
  updatePerformanceStats();
  updatePerformanceChart();
}

function updateTodayTransactions() {
  const todayTransactionsList = document.getElementById('todayTransactionsList');
  const todayTotal = document.getElementById('todayTotal');
  const todaysTransactions = transactions.filter(t => t.date === getTodayString());
  if (todaysTransactions.length === 0) {
    todayTransactionsList.innerHTML = '<p class="no-transactions">No transactions today</p>';
  } else {
    todayTransactionsList.innerHTML = todaysTransactions.map(t => `
      <div class="transaction-item">
        <div class="transaction-info">
          <span class="transaction-product">${escapeHtml(t.productName)}</span>
          <span class="transaction-time">${new Date(t.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="transaction-amount">₹${t.price}</div>
        <button class="transaction-remove" data-transaction-id="${t.id}" data-product-id="${t.productId}">×</button>
      </div>
    `).join('');
    // Add event listeners to remove buttons
    document.querySelectorAll('.transaction-remove').forEach(btn => {
      btn.addEventListener('click', function() {
        const transactionId = this.getAttribute('data-transaction-id');
        const productId = this.getAttribute('data-product-id');
        removeTransaction(transactionId, productId);
      });
    });
  }
  todayTotal.textContent = `₹${getTodayTotal().toLocaleString()}`;
}

function updateMonthTransactions() {
  const monthTransactionsList = document.getElementById('monthTransactionsList');
  const monthTotal = document.getElementById('monthTotal');
  
  // Get last 30 days
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last30Days.push(getDateString(date));
  }
  
  const monthHtml = last30Days.map(date => {
    const isToday = date === getTodayString();
    const total = isToday ? getTodayTotal() : (dailyTotals[date] || 0);
    
    if (total === 0) return '';
    
    return `
      <div class="daily-summary">
        <div class="daily-date">
          ${isToday ? 'Today' : new Date(date).toLocaleDateString()}
          ${isToday ? ` (${transactions.filter(t => t.date === date).length} items)` : ''}
        </div>
        <div class="daily-amount">₹${total.toLocaleString()}</div>
      </div>
    `;
  }).filter(html => html !== '').join('');
  
  monthTransactionsList.innerHTML = monthHtml || '<p class="no-transactions">No transactions this month</p>';
  monthTotal.textContent = `₹${getMonthTotal().toLocaleString()}`;
}

// Authentication State Management
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    console.log("User is logged in:", user.email);
    showAuthUI(false);
    initializeStockData(); // Initialize stock data
    loadProducts();
    listenToTransactions();
    // Force re-render after stock initialization
    setTimeout(() => {
      renderProducts();
      updateStockDisplay();
    }, 100);
  } else {
    // User is signed out
    console.log("User is logged out");
    showAuthUI(true);
    productGrid.innerHTML = '';
    cart = [];
    transactions = [];
    // productStocks will be reloaded from Firebase on next login
    renderCart();
    updateTransactionDisplay();
  }
});

// Listen to Firestore for transactions
function listenToTransactions() {
  const q = query(transactionsCol, orderBy("timestamp", "desc"));
  onSnapshot(q, snap => {
    transactions = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      transactions.push({
        id: docSnap.id,
        ...data
      });
    });
      // Update dailyTotals for previous days after loading transactions
      cleanupOldTransactions();
    updateTransactionDisplay();
    updateLeaderboards();
  }, error => {
    console.error("Error loading transactions from Firestore:", error);
  });
}

// Leaderboard logic
function updateLeaderboards() {
  // Weekly leaderboard: last 7 days
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 6); // 7 days including today
  const weekStart = weekAgo.toISOString().split('T')[0];

  // Monthly leaderboard: last 30 days
  const monthAgo = new Date();
  monthAgo.setDate(now.getDate() - 29); // 30 days including today
  const monthStart = monthAgo.toISOString().split('T')[0];

  // Aggregate sales for last 7 and 30 days
  function getTopSoldPeriod(startDate) {
    const sales = {};
    transactions.forEach(t => {
      if (t.date >= startDate) {
        if (!sales[t.productId]) {
          sales[t.productId] = { name: t.productName, count: 0 };
        }
        sales[t.productId].count += 1;
      }
    });
    // Convert to array and sort by count desc
    return Object.entries(sales)
      .map(([id, info]) => ({ id, name: info.name, count: info.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  }

  const weeklyTop = getTopSoldPeriod(weekStart);
  const monthlyTop = getTopSoldPeriod(monthStart);

  // Render leaderboards
  const weeklyEl = document.getElementById('weeklyLeaderboard');
  const monthlyEl = document.getElementById('monthlyLeaderboard');

  function renderLeaderboard(list, el) {
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = '<p class="no-data">No sales in this period</p>';
      return;
    }
    el.innerHTML = list.map((item) => `
      <div class="leaderboard-item" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
        <span class="product-name" style="flex: 1; font-weight: 500; color: #444; font-size: 16px; letter-spacing: 0.1px;">${escapeHtml(item.name)}</span>
        <span class="sold-count" style="font-size: 14px; color: #28a745; font-weight: 600;">${item.count} sold</span>
      </div>
    `).join('');
  }

  renderLeaderboard(weeklyTop, weeklyEl);
  renderLeaderboard(monthlyTop, monthlyEl);
}

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize notification bell
  initializeNotificationBell();
  
  // Initialize performance chart
  setTimeout(() => {
    initializePerformanceChart();
  }, 100); // Small delay to ensure DOM is fully rendered
  
  // Main navigation tabs
  const billingTab = document.getElementById('billingTab');
  const transactionsTab = document.getElementById('transactionsTab');
  const stockTab = document.getElementById('stockTab');
  
  if (billingTab) billingTab.addEventListener('click', () => showMainSection('billing'));
  if (transactionsTab) transactionsTab.addEventListener('click', () => showMainSection('transactions'));
  if (stockTab) stockTab.addEventListener('click', () => showMainSection('stock'));
  
  // Transaction sub-tabs
  const todayTransactionTab = document.getElementById('todayTransactionTab');
  const monthTransactionTab = document.getElementById('monthTransactionTab');
  
  if (todayTransactionTab) {
    todayTransactionTab.addEventListener('click', function() {
      showTransactionSubTab('today');
    });
  }
  
  if (monthTransactionTab) {
    monthTransactionTab.addEventListener('click', function() {
      showTransactionSubTab('month');
    });
  }
  
  // Legacy transaction tabs (for billing section)
  const todayTab = document.getElementById('todayTab');
  const monthTab = document.getElementById('monthTab');
  
  if (todayTab) {
    todayTab.addEventListener('click', function() {
      showTransactionTab('today');
    });
  }
  
  if (monthTab) {
    monthTab.addEventListener('click', function() {
      showTransactionTab('month');
    });
  }
  
  // Stock filters and search (input only, always visible)
  const stockCategoryFilter = document.getElementById('stockCategoryFilter');
  const stockStatusFilter = document.getElementById('stockStatusFilter');
  const stockSearchInput = document.getElementById('stockSearchInput');

  if (stockCategoryFilter) stockCategoryFilter.addEventListener('change', updateStockDisplay);
  if (stockStatusFilter) stockStatusFilter.addEventListener('change', updateStockDisplay);

  if (stockSearchInput) {
    stockSearchInput.addEventListener('input', updateStockDisplay);
    stockSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        updateStockDisplay();
      }
    });
  }
});

// Main section switching function
function showMainSection(section) {
  // Hide all sections
  document.querySelectorAll('.main-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  // Remove active class from all nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected section
  const sectionElement = document.getElementById(section + 'Section');
  const tabElement = document.getElementById(section + 'Tab');
  
  if (sectionElement) sectionElement.classList.add('active');
  if (tabElement) tabElement.classList.add('active');
  
  // Update content based on section
  if (section === 'stock') {
    updateStockDisplay();
    populateStockFilters();
    // Check for low stock alerts when viewing stock section
    setTimeout(() => {
      const alerts = checkLowStockAlerts();
      if (alerts.lowStock === 0 && alerts.outOfStock === 0) {
        showNotification('✅ All products have adequate stock levels!', 'success', 3000);
      }
    }, 500);
  } else if (section === 'transactions') {
    updateTransactionSectionDisplay();
  }
}

// Transaction section sub-tab switching
function showTransactionSubTab(tab) {
  const todayTab = document.getElementById('todayTransactionTab');
  const monthTab = document.getElementById('monthTransactionTab');
  const todayView = document.getElementById('todayTransactionView');
  const monthView = document.getElementById('monthTransactionView');
  
  if (tab === 'today') {
    if (todayTab) todayTab.classList.add('active');
    if (monthTab) monthTab.classList.remove('active');
    if (todayView) todayView.classList.remove('hidden');
    if (monthView) monthView.classList.add('hidden');
  } else {
    if (monthTab) monthTab.classList.add('active');
    if (todayTab) todayTab.classList.remove('active');
    if (monthView) monthView.classList.remove('hidden');
    if (todayView) todayView.classList.add('hidden');
  }
}

// Update transaction section display
function updateTransactionSectionDisplay() {
  // Update today's data
  const todayRevenue = document.getElementById('todayRevenue');
  const todayItemCount = document.getElementById('todayItemCount');
  const todayDetails = document.getElementById('todayTransactionDetails');
  
  if (todayRevenue) todayRevenue.textContent = `₹${getTodayTotal().toLocaleString()}`;
  if (todayItemCount) todayItemCount.textContent = transactions.filter(t => t.date === getTodayString()).length.toString();
  
  const todaysTransactions = transactions.filter(t => t.date === getTodayString());
  if (todayDetails) {
    if (todaysTransactions.length === 0) {
      todayDetails.innerHTML = '<p class="no-data">No transactions today</p>';
    } else {
      todayDetails.innerHTML = todaysTransactions.map(t => `
        <div class="transaction-item">
          <div class="transaction-info">
            <span class="transaction-product">${escapeHtml(t.productName)}</span>
            <span class="transaction-time">${new Date(t.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="transaction-amount">₹${t.price.toLocaleString()}</div>
        </div>
      `).join('');
    }
  }
  
  // Update month's data
  const monthRevenue = document.getElementById('monthRevenue');
  const monthItemCount = document.getElementById('monthItemCount');
  const monthDetails = document.getElementById('monthTransactionDetails');
  
  const totalRevenue = getMonthTotal();
  const totalItems = transactions.length + Object.keys(dailyTotals).length;
  
  if (monthRevenue) monthRevenue.textContent = `₹${totalRevenue.toLocaleString()}`;
  if (monthItemCount) monthItemCount.textContent = totalItems.toString();
  
  if (monthDetails) {
    // Show daily summaries for the month
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last30Days.push(getDateString(date));
    }
    
    const monthHtml = last30Days.map(date => {
      const isToday = date === getTodayString();
      // Get all transactions for this day
      const dayTransactions = transactions.filter(t => t.date === date);
      const total = isToday ? getTodayTotal() : (dailyTotals[date] || 0);
      if (total === 0) return '';
      // Group items by product name and count
      const itemCounts = {};
      dayTransactions.forEach(t => {
        if (!itemCounts[t.productName]) itemCounts[t.productName] = 0;
        itemCounts[t.productName] += 1;
      });
      return `
        <div class="daily-summary-item">
          <div class="daily-date">
            ${isToday ? 'Today' : new Date(date).toLocaleDateString()}
          </div>
          <div class="daily-amount">₹${total.toLocaleString()}</div>
        </div>
      `;
    }).filter(html => html !== '').join('');
    monthDetails.innerHTML = monthHtml || '<p class="no-data">No transactions this month</p>';
  }
}

// Stock management functions
let productStocks = {}; // Track product stock levels

function initializeStockData() {
  console.log("🔍 Initializing stock data from Firebase...");
  productStocks = {}; // Reset stock data, will be loaded from Firebase
  
  // Check for low stock alerts after initializing stock data
  setTimeout(() => {
    if (products.length > 0) {
      console.log("📊 Current products count:", products.length);
      console.log("📊 Current productStocks:", productStocks);
      checkLowStockAlerts();
    }
  }, 3000); // Delay to ensure products are loaded
}

// Function to set initial stock for products that don't have stock values
async function setInitialStockForAllProducts() {
  console.log("🔄 Setting initial stock for products without stock values...");
  
  for (const product of products) {
    if (product.stock === undefined || product.stock === 0) {
      try {
        const productRef = doc(db, "products", product.id);
        await updateDoc(productRef, {
          stock: 10 // Set initial stock to 10 items
        });
        console.log(`✅ Set initial stock for ${product.name}: 10 items`);
      } catch (error) {
        console.error(`❌ Error setting stock for ${product.name}:`, error);
      }
    }
  }
  
  console.log("🎉 Initial stock setup completed!");
}

function getProductStock(productId) {
  return productStocks[productId] || 0;
}

async function updateProductStock(productId, newStock) {
  const oldStock = productStocks[productId] || 0;
  const updatedStock = Math.max(0, newStock);
  productStocks[productId] = updatedStock;
  
  // Save to Firebase
  try {
    const productRef = doc(db, "products", productId);
    await updateDoc(productRef, {
      stock: updatedStock
    });
    console.log(`💾 Stock updated in Firebase for product ${productId}: ${updatedStock}`);
  } catch (error) {
    console.error("❌ Error updating stock in Firebase:", error);
  }
  
  // Check for stock level changes and show notifications
  const product = products.find(p => p.id === productId);
  if (product) {
    // Stock decreased and now low/out
    if (oldStock > updatedStock) {
      if (updatedStock === 0) {
        console.log(`❌ ${product.name} is now out of stock!`);
      } else if (updatedStock <= LOW_STOCK_THRESHOLD) {
        console.log(`⚠️ ${product.name} is now low stock: ${updatedStock} items`);
      }
    }
    // Stock increased from low/out to good levels
    else if (oldStock <= LOW_STOCK_THRESHOLD && updatedStock > LOW_STOCK_THRESHOLD) {
      console.log(`✅ ${product.name} stock replenished successfully! (${updatedStock} items)`);
    }
  }
  updateStockDisplay();
  // Also re-render product cards to show updated stock
  renderProducts();
}

function decreaseStock(productId, quantity = 1) {
  const currentStock = getProductStock(productId);
  updateProductStock(productId, currentStock - quantity);
}

function increaseStock(productId, quantity = 1) {
  const currentStock = getProductStock(productId);
  updateProductStock(productId, currentStock + quantity);
}

function populateStockFilters() {
  const categoryFilter = document.getElementById('stockCategoryFilter');
  if (!categoryFilter) return;
  
  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
  categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
    categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
}

function updateStockDisplay() {
  const stockTableBody = document.querySelector('#stockTable tbody');
  const totalProductsEl = document.getElementById('totalProducts');
  const lowStockCountEl = document.getElementById('lowStockCount');
  const outOfStockCountEl = document.getElementById('outOfStockCount');
  const stockSearchInput = document.getElementById('stockSearchInput');
  if (!stockTableBody) return;

  // Get filter values
  const categoryFilter = document.getElementById('stockCategoryFilter')?.value || 'all';
  const statusFilter = document.getElementById('stockStatusFilter')?.value || 'all';
  const searchTerm = stockSearchInput ? stockSearchInput.value.trim().toLowerCase() : '';

  // Filter products
  let filteredProducts = products.filter(product => {
    const categoryMatch = categoryFilter === 'all' || product.category === categoryFilter;
    const stock = getProductStock(product.id);
    let statusMatch = true;
    if (statusFilter === 'low') {
      statusMatch = stock > 0 && stock <= 5;
    } else if (statusFilter === 'out') {
      statusMatch = stock === 0;
    }
    const nameMatch = !searchTerm || (product.name && product.name.toLowerCase().includes(searchTerm));
    return categoryMatch && statusMatch && nameMatch;
  });

  // Generate table rows
  stockTableBody.innerHTML = filteredProducts.map(product => {
    const stock = getProductStock(product.id);
    let statusClass = 'in-stock';
    let statusText = 'In Stock';
    if (stock === 0) {
      statusClass = 'out-of-stock';
      statusText = 'Out of Stock';
    } else if (stock <= 5) {
      statusClass = 'low-stock';
      statusText = 'Low Stock';
    }
    return `
      <tr>
        <td>
          <div class="stock-product-info">
            <div class="stock-product-image">
              ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />` : 'No Image'}
            </div>
            <div class="stock-product-details">
              <div class="stock-product-name">${escapeHtml(product.name)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(product.category)}</td>
        <td>₹${product.price.toLocaleString()}</td>
        <td>
          <span class="stock-quantity">${stock}</span>
        </td>
        <td>
          <span class="stock-status ${statusClass}">${statusText}</span>
        </td>
        <td>
          <div class="stock-actions">
            <button class="stock-btn restock" onclick="restockProduct('${product.id}')">
              Restock
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Update statistics
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => {
    const stock = getProductStock(p.id);
    return stock > 0 && stock <= 5;
  }).length;
  const outOfStockCount = products.filter(p => getProductStock(p.id) === 0).length;

  if (totalProductsEl) totalProductsEl.textContent = totalProducts;
  if (lowStockCountEl) lowStockCountEl.textContent = lowStockCount;
  if (outOfStockCountEl) outOfStockCountEl.textContent = outOfStockCount;
}

// Global function for restocking (called from HTML)
window.restockProduct = function(productId) {
  const quantity = prompt('Enter quantity to add to stock:', '10');
  if (quantity && !isNaN(quantity) && Number(quantity) > 0) {
    const currentStock = getProductStock(productId);
    updateProductStock(productId, currentStock + Number(quantity));
    alert('Stock updated successfully!');
  }
};

function showTransactionTab(tab) {
  const todayTab = document.getElementById('todayTab');
  const monthTab = document.getElementById('monthTab');
  const todayContent = document.getElementById('todayTransactions');
  const monthContent = document.getElementById('monthTransactions');
  
  if (tab === 'today') {
    todayTab.classList.add('active');
    monthTab.classList.remove('active');
    todayContent.classList.remove('hidden');
    monthContent.classList.add('hidden');
  } else {
    monthTab.classList.add('active');
    todayTab.classList.remove('active');
    monthContent.classList.remove('hidden');
    todayContent.classList.add('hidden');
  }
}

// Performance Chart Functions
function initializePerformanceChart() {
  const ctx = document.getElementById('performanceChart');
  if (!ctx) {
    console.log('Performance chart canvas not found');
    return;
  }

  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded');
    return;
  }

  // Get last 7 days data for the chart
  const chartData = getLast7DaysData();
  
  performanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: 'Daily Revenue',
        data: chartData.values,
        backgroundColor: chartData.colors,
        borderColor: chartData.borderColors,
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#ddd',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const value = context.parsed.y;
              const status = value >= DAILY_TARGET ? 'Profit' : 'Loss';
              const difference = Math.abs(value - DAILY_TARGET);
              return [
                `Revenue: ₹${value.toLocaleString()}`,
                `${status}: ₹${difference.toLocaleString()}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '₹' + value.toLocaleString();
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      animation: {
        duration: 800,
        easing: 'easeInOutQuart'
      }
    },
    plugins: [{
      id: 'targetLine',
      afterDraw: function(chart) {
        const ctx = chart.ctx;
        const yAxis = chart.scales.y;
        const targetY = yAxis.getPixelForValue(DAILY_TARGET);
        
        ctx.save();
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(chart.chartArea.left, targetY);
        ctx.lineTo(chart.chartArea.right, targetY);
        ctx.stroke();
        ctx.restore();
        
        // Add target label
        ctx.save();
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Target: ₹2,000', chart.chartArea.right - 100, targetY - 8);
        ctx.restore();
      }
    }]
  });
}

function getLast7DaysData() {
  const days = [];
  const values = [];
  const colors = [];
  const borderColors = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = getDateString(date);
    
    // Format day label
    const dayLabel = i === 0 ? 'Today' : 
                    i === 1 ? 'Yesterday' : 
                    date.toLocaleDateString('en-US', { weekday: 'short' });
    
    days.push(dayLabel);
    
    // Get revenue for this day
    const revenue = i === 0 ? getTodayTotal() : (dailyTotals[dateString] || 0);
    values.push(revenue);
    
    // Set colors based on profit/loss
    if (revenue >= DAILY_TARGET) {
      colors.push('rgba(46, 213, 115, 0.8)'); // Green for profit
      borderColors.push('rgba(46, 213, 115, 1)');
    } else {
      colors.push('rgba(255, 107, 107, 0.8)'); // Red for loss
      borderColors.push('rgba(255, 107, 107, 1)');
    }
  }
  
  return { labels: days, values, colors, borderColors };
}

function updatePerformanceChart() {
  if (!performanceChart) return;
  
  const chartData = getLast7DaysData();
  performanceChart.data.labels = chartData.labels;
  performanceChart.data.datasets[0].data = chartData.values;
  performanceChart.data.datasets[0].backgroundColor = chartData.colors;
  performanceChart.data.datasets[0].borderColor = chartData.borderColors;
  performanceChart.update('none'); // No animation for updates
}

function updatePerformanceStats() {
  const todayTotal = getTodayTotal();
  const todayPerformanceEl = document.getElementById('todayPerformance');
  const performanceStatusEl = document.getElementById('performanceStatus');
  
  if (todayPerformanceEl) {
    todayPerformanceEl.textContent = `₹${todayTotal.toLocaleString()}`;
  }
  
  if (performanceStatusEl) {
    if (todayTotal >= DAILY_TARGET) {
      const profit = todayTotal - DAILY_TARGET;
      performanceStatusEl.textContent = `Profit +₹${profit.toLocaleString()}`;
      performanceStatusEl.className = 'stat-value status profit';
    } else {
      const loss = DAILY_TARGET - todayTotal;
      performanceStatusEl.textContent = `Need ₹${loss.toLocaleString()}`;
      performanceStatusEl.className = 'stat-value status loss';
    }
  }
}