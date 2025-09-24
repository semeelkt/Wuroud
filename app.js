// app.js
// Requires firebase-config.js to set window.FIREBASE_CONFIG
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
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

// add product to firestore
addBtn.addEventListener("click", async () => {
  const name = pName.value.trim();
  const price = Number(pPrice.value);
  const category = pCategoryInput.value;
  const image = pImage.value.trim();

  if(!name || !price) return alert("Enter product name and price.");

  await addDoc(productsCol, {
    name, price, category, image: image || "", createdAt: Date.now()
  });

  pName.value = ""; pPrice.value = ""; pImage.value = "";
});

// listen to products collection
const q = query(productsCol, orderBy("createdAt","desc"));
onSnapshot(q, snap => {
  products = [];
  snap.forEach(docSnap=>{
    products.push({ id: docSnap.id, ...docSnap.data() });
  });
  renderProducts();
  populateCategoryFilter();
});

// render product cards with filtering
function renderProducts(){
  const qName = searchInput.value.trim().toLowerCase();
  const qCat = categoryFilter.value;
  const min = minPrice.value ? Number(minPrice.value) : -Infinity;
  const max = maxPrice.value ? Number(maxPrice.value) : Infinity;

  const filtered = products.filter(p=>{
    const nameMatch = p.name.toLowerCase().includes(qName);
    const catMatch = qCat === "all" ? true : p.category === qCat;
    const priceMatch = p.price >= min && p.price <= max;
    return nameMatch && catMatch && priceMatch;
  });

  productGrid.innerHTML = filtered.map(p => productCardHtml(p)).join("");
  attachProductCardListeners();
}

applyFilter.addEventListener("click", ()=> renderProducts());
searchInput.addEventListener("input", ()=> renderProducts());

// populate category filter dropdown
function populateCategoryFilter(){
  const cats = new Set(products.map(p=>p.category));
  categoryFilter.innerHTML = `<option value="all">All Categories</option>` + [...cats].map(c=>`<option value="${c}">${c}</option>`).join("");
}


// product card HTML
function productCardHtml(p){
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

// attach listeners to dynamic card buttons
function attachProductCardListeners(){
  document.querySelectorAll(".add-to-bill").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.dataset.id;
      const product = products.find(p=>p.id===id);
      if(!product) return;
      addToCart(product);
    }
  });

  document.querySelectorAll(".remove-prod").forEach(btn=>{
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if(!confirm("Delete this product?")) return;
      await deleteDoc(doc(productsCol.firestore, `products/${id}`));
    }
  });
}

// cart functions
function addToCart(product){
  const found = cart.find(c=>c.id===product.id);
  if(found) found.qty += 1;
  else cart.push({ id:product.id, name:product.name, price:Number(product.price), qty:1 });
  renderCart();
}
function changeQty(id, qty){
  const item = cart.find(c=>c.id===id);
  if(!item) return;
  item.qty = qty;
  if(item.qty <= 0) cart = cart.filter(c=>c.id!==id);
  renderCart();
}
function removeFromCart(id){
  cart = cart.filter(c=>c.id!==id);
  renderCart();
}

function renderCart(){
  billTableBody.innerHTML = cart.map(item=>{
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

  // attach events
  document.querySelectorAll("#billTable .qty-input").forEach(input=>{
    input.onchange = (e) => {
      const tr = e.target.closest("tr");
      const id = tr.dataset.id;
      const val = Number(e.target.value) || 1;
      changeQty(id, val);
    }
  });
  document.querySelectorAll(".small-remove").forEach(btn=>{
    btn.onclick = (e) => {
      const id = e.target.closest("tr").dataset.id;
      removeFromCart(id);
    }
  });

  updateTotal();
}

function updateTotal(){
  const total = cart.reduce((s,i)=> s + i.price * i.qty, 0);
  grandTotalEl.textContent = `₹${total.toLocaleString()}`;
}

/* PDF, print, whatsapp */
// generate PDF using jsPDF + autotable
generatePdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const head = [['Item','Qty','Price','Subtotal']];
  const body = cart.map(i=>[i.name, String(i.qty), `₹${i.price.toLocaleString()}`, `₹${(i.price*i.qty).toLocaleString()}`]);
  doc.setFontSize(14);
  doc.text("Wuroud Bill", 40, 40);
  doc.setFontSize(10);
  doc.text(`Mobile: ${custMobile.value || '-'}`, 40, 60);
  doc.autoTable({
    head: head,
    body: body,
    startY: 90,
    theme:'grid',
    headStyles: { fillColor: [240,240,240] },
  });
  const total = cart.reduce((s,i)=> s + i.price * i.qty, 0);
  doc.text(`Total: ₹${total.toLocaleString()}`, 40, doc.lastAutoTable.finalY + 30);
  doc.save(`Wuroud-bill-${Date.now()}.pdf`);
});

// print (simple)
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

// share via WhatsApp
whatsappBtn.addEventListener("click", () => {
  if(cart.length === 0) return alert("Cart empty");
  const phone = custMobile.value.trim();
  let message = `*Wuroud Bill*%0A`;
  cart.forEach(i=>{
    message += `${i.name} x${i.qty} = ₹${(i.price*i.qty).toLocaleString()}%0A`;
  });
  const total = cart.reduce((s,i)=> s + i.price * i.qty, 0);
  message += `%0ATotal: ₹${total.toLocaleString()}`;
  const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
  window.open(url, '_blank');
});

clearBillBtn.addEventListener("click", ()=> {
  if(confirm("Clear cart?")) { cart = []; renderCart(); }
});

function printableHtml(){
  const rows = cart.map(i=>`<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center">${i.qty}</td><td>₹${(i.price).toLocaleString()}</td><td>₹${(i.price*i.qty).toLocaleString()}</td></tr>`).join("");
  const total = cart.reduce((s,i)=> s + i.price * i.qty, 0).toLocaleString();
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

/* small helpers */
function escapeHtml(str){
  return String(str || "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
