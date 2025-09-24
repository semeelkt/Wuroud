/* ---------- FIRESTORE SETUP ---------- */
const db = window.db;
const { addDoc, getDocs, deleteDoc, doc, collection } = window.firebaseFuncs;
const productsCollection = collection(db, 'products');

/* ---------- PRODUCTS ---------- */
let products = [];

const grid           = document.getElementById('productGrid');
const pName          = document.getElementById('pName');
const pPrice         = document.getElementById('pPrice');
const pCategory      = document.getElementById('pCategory');
const pImg           = document.getElementById('pImg');
const categoryFilter = document.getElementById('categoryFilter');
const minPrice       = document.getElementById('minPrice');
const maxPrice       = document.getElementById('maxPrice');
document.getElementById('applyFilters').addEventListener('click', filterProducts);

/* ---------- LOAD PRODUCTS ---------- */
async function loadProducts() {
  try {
    const snapshot = await getDocs(productsCollection);
    if (snapshot.empty) {
      const defaultProducts = [
        { name: "Red Sneakers",      price: 799, category: "footwear",  img: "img/red-shoes.jpg" },
        { name: "Sparkle Hair Clip", price: 120, category: "fancy",     img: "img/hair-clip.jpg" },
        { name: "RC Car",            price: 999, category: "toys",      img: "img/rc-car.jpg" },
        { name: "Notebook Pack",     price: 60,  category: "stationery",img: "img/notebook.jpg" },
        { name: "Blue Sandals",      price: 450, category: "footwear",  img: "img/sandals.jpg" }
      ];
      for (const p of defaultProducts) await addDoc(productsCollection, p);
      products = defaultProducts;
    } else {
      products = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    }
    displayProducts(products);
  } catch (err) {
    console.error("Error loading products:", err);
    alert("Failed to load products. Check console.");
  }
}

/* ---------- DISPLAY PRODUCTS ---------- */
function displayProducts(items) {
  grid.innerHTML = items.map(p => `
    <div class="product">
      <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCartObj(${JSON.stringify(p).replace(/"/g,'&quot;')})">Add to Bill</button>
      <button onclick="removeProductByName('${p.name}')" class="remove-btn">Remove</button>
    </div>
  `).join('');
}

/* ---------- FILTER PRODUCTS ---------- */
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

/* ---------- ADD PRODUCT ---------- */
document.getElementById('addProductBtn').addEventListener('click', async () => {
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  if (!name || isNaN(price)) return alert('Enter valid name & price');

  const newProduct = { name, price, category: pCategory.value, img: pImg.value.trim() };
  const docRef = await addDoc(productsCollection, newProduct);
  products.push({ id: docRef.id, ...newProduct });

  pName.value = pPrice.value = pImg.value = '';
  displayProducts(products);
});

/* ---------- REMOVE PRODUCT ---------- */
async function removeProductByName(name) {
  const product = products.find(p => p.name === name);
  if (!product || !confirm('Remove this product?')) return;
  if (product.id) await deleteDoc(doc(productsCollection, product.id));
  products = products.filter(p => p.name !== name);
  displayProducts(products);
}

/* ---------- CART ---------- */
let cart = [];
const cartList       = document.getElementById('cartList');
const cartTotal      = document.getElementById('cartTotal');
const customerNumber = document.getElementById('customerNumber');
const generateBillBtn = document.getElementById('generateBillBtn');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const clearCartBtn    = document.getElementById('clearCartBtn');
const downloadPdfBtn  = document.getElementById('downloadPdfBtn');

function addToCartObj(product) { cart.push(product); updateCart(); }
function removeFromCart(i) { cart.splice(i, 1); updateCart(); }

function updateCart() {
  let total = 0;
  cartList.innerHTML = cart.map((it, idx) => {
    total += it.price;
    return `<li>${it.name} - ₹${it.price} <button class="remove-btn" onclick="removeFromCart(${idx})">❌</button></li>`;
  }).join('');
  cartTotal.textContent = cart.length ? `Total: ₹${total}` : 'No items selected.';
}

clearCartBtn.addEventListener('click', () => { if(cart.length && confirm('Clear current selection?')) { cart=[]; updateCart(); } });
generateBillBtn.addEventListener('click', () => { if(!cart.length) return alert('No items in bill'); const w=window.open('','_blank'); w.document.write(buildBillHTML()); w.document.close(); });

sendWhatsAppBtn.addEventListener('click', () => {
  if(!cart.length) return alert('No items in bill');
  const num = customerNumber.value.trim();
  if(!num) return alert('Enter customer mobile (e.g. 91XXXXXXXXXX)');
  let total=0;
  const lines = cart.map((it,i)=>{ total+=it.price; return `${i+1}. ${it.name} - ₹${it.price}`; });
  lines.unshift('KT Family Store - Bill','----------------------');
  lines.push('----------------------', `Total: ₹${total}`);
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
});

downloadPdfBtn.addEventListener('click', () => {
  if(!cart.length) return alert('No items in bill');
  const tempDiv = document.createElement('div');
  let total=0;
  const rows = cart.map((it,i)=>{ total+=it.price; return `<tr><td>${i+1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`; }).join('');
  tempDiv.innerHTML = `<table><thead><tr><th>#</th><th>Item</th><th>Price</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2"><strong>Total</strong></td><td><strong>₹${total}</strong></td></tr></tfoot></table>`;
  const style=document.createElement('style'); style.textContent=`table{width:100%;border-collapse:collapse;margin-top:10px;} td,th{border:1px solid #000;padding:8px;text-align:left;}`; tempDiv.prepend(style);
  document.body.appendChild(tempDiv);
  html2pdf().set({margin:10, filename:'KT-Family-Store-Bill.pdf', html2canvas:{scale:2}, jsPDF:{unit:'mm', format:'a4', orientation:'portrait'}}).from(tempDiv).save().finally(()=>tempDiv.remove());
});

function buildBillHTML() {
  let total=0;
  const rows = cart.map((it,i)=>{ total+=it.price; return `<tr><td>${i+1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`; }).join('');
  return `<html><head><title>Bill</title><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;margin-top:10px;} td,th{border:1px solid #ddd;padding:8px;}</style></head><body><h1>KT Family Store</h1><p>Bill generated: ${new Date().toLocaleString()}</p><table><thead><tr><th>#</th><th>Item</th><th>Price</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2"><strong>Total</strong></td><td><strong>₹${total}</strong></td></tr></tfoot></table></body></html>`;
}

/* ---------- INIT ---------- */
loadProducts();

/* ---------- Expose globals for inline onclicks ---------- */
window.addToCartObj = addToCartObj;
window.removeFromCart = removeFromCart;
window.filterProducts = filterProducts;
window.removeProductByName = removeProductByName;
