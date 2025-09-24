/* ================== FIREBASE INIT ================== */
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ================== AUTH (Admin Password) ================== */
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
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
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
  if (!p1 || !p2) return (authMsg.textContent = 'Fill both fields');
  if (p1 !== p2) return (authMsg.textContent = 'Passwords do not match');
  const hash = await hashString(p1);
  localStorage.setItem(AUTH_KEY, hash);
  newPassword.value = newPassConf.value = '';
  authMsg.textContent = 'Password saved. Please login.';
  prepareAuthUI();
});

loginBtn.addEventListener('click', async () => {
  const p = passwordInput.value.trim();
  if (!p) return (authMsg.textContent='Enter password');
  const hash = await hashString(p);
  if(hash === localStorage.getItem(AUTH_KEY)){
    sessionStorage.setItem(LOGGED_KEY,'1');
    openApp();
  } else authMsg.textContent='Wrong password';
});

logoutBtn.addEventListener('click',()=>{
  sessionStorage.removeItem(LOGGED_KEY);
  location.reload();
});

function openApp(){
  overlay.classList.add('hidden');
  app.classList.remove('hidden');
  loadProductsFromFirestore();
  updateCart();
}

/* ================== PRODUCTS ================== */
let products = [];
const PRODUCTS_KEY = 'kt_products_v1';
const grid = document.getElementById('productGrid');
const pName = document.getElementById('pName');
const pPrice = document.getElementById('pPrice');
const pCategory = document.getElementById('pCategory');
const pImg = document.getElementById('pImg');

async function loadProductsFromFirestore(){
  const snapshot = await db.collection('products').get();
  products = snapshot.docs.map(doc=>({id: doc.id, ...doc.data()}));
  displayProducts(products);
}

function displayProducts(items){
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  grid.innerHTML = items.filter(p=>p.name.toLowerCase().includes(search)).map((p,i)=>`
    <div class="product">
      <img src="${p.img || 'img/placeholder.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCart('${p.id}')">Add to Bill</button>
      <button onclick="removeProduct('${p.id}')" class="remove-btn">Remove</button>
    </div>`).join('');
}

document.getElementById('applyFilters').addEventListener('click', ()=>{
  const cat = document.getElementById('categoryFilter').value;
  const min = parseInt(document.getElementById('minPrice').value)||0;
  const max = parseInt(document.getElementById('maxPrice').value)||Infinity;
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = products.filter(p=>
    (cat==='all'||p.category===cat)&&
    p.price>=min && p.price<=max &&
    p.name.toLowerCase().includes(search)
  );
  displayProducts(filtered);
});

document.getElementById('addProductBtn').addEventListener('click', async ()=>{
  const name = pName.value.trim();
  const price = parseInt(pPrice.value);
  const category = pCategory.value;
  const img = pImg.value.trim();
  if(!name || isNaN(price)) return alert("Fill name & price");
  const docRef = await db.collection('products').add({name,price,category,img});
  pName.value=pPrice.value=pImg.value='';
  loadProductsFromFirestore();
});

// Remove product
async function removeProduct(id){
  if(confirm('Remove this product?')){
    await db.collection('products').doc(id).delete();
    loadProductsFromFirestore();
  }
}

/* ================== CART / BILL ================== */
const cartList = document.getElementById('cartList');
const cartTotal = document.getElementById('cartTotal');
const customerNumber = document.getElementById('customerNumber');
const generateBillBtn = document.getElementById('generateBillBtn');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const clearCartBtn = document.getElementById('clearCartBtn');

let cart = [];

function addToCart(id){
  const prod = products.find(p=>p.id===id);
  if(prod){ cart.push(prod); updateCart(); }
}

function removeFromCart(idx){
  cart.splice(idx,1);
  updateCart();
}

function updateCart(){
  let total=0;
  cartList.innerHTML = cart.map((it,idx)=>{
    total+=it.price;
    return `<li>${it.name} - ₹${it.price} 
      <button class="remove-btn" onclick="removeFromCart(${idx})">❌</button></li>`;
  }).join('');
  cartTotal.textContent = cart.length?`Total: ₹${total}`:'No items selected';
}

clearCartBtn.addEventListener('click',()=>{
  if(cart.length && confirm('Clear current selection?')){ cart=[]; updateCart();}
});

generateBillBtn.addEventListener('click',()=>{
  if(!cart.length) return alert('No items in bill');
  const w = window.open('','_blank');
  w.document.write(buildBillHTML());
  w.document.close();
  w.print();
});

sendWhatsAppBtn.addEventListener('click',()=>{
  if(!cart.length) return alert('No items in bill');
  const num = customerNumber.value.trim();
  if(!num) return alert('Enter customer number');
  let total=0;
  const lines = cart.map((it,i)=>{
    total+=it.price;
    return `${i+1}. ${it.name} - ₹${it.price}`;
  });
  lines.unshift('KT Family Store - Bill','----------------');
  lines.push('----------------',`Total: ₹${total}`);
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`,'_blank');
});

downloadPdfBtn.addEventListener('click',()=>{
  if(!cart.length) return alert('No items in bill');
  const tempDiv = document.createElement('div');
  let total=0;
  const rows = cart.map((it,i)=>{
    total+=it.price;
    return `<tr><td>${i+1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`;
  }).join('');
  tempDiv.innerHTML = `<table>
    <thead><tr><th>#</th><th>Item</th><th>Price</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2"><strong>Total</strong></td><td>₹${total}</td></tr></tfoot>
  </table>`;
  const style=document.createElement('style');
  style.textContent=`table{width:100%;border-collapse:collapse;margin-top:10px;} td,th{border:1px solid #000;padding:8px;}`;
  tempDiv.prepend(style);
  document.body.appendChild(tempDiv);
  html2pdf().set({margin:10,filename:'KT-Family-Store-Bill.pdf',html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4'}}).from(tempDiv).save().finally(()=>tempDiv.remove());
});

function buildBillHTML(){
  let total=0;
  const rows = cart.map((it,i)=>{ total+=it.price; return `<tr><td>${i+1}</td><td>${it.name}</td><td>₹${it.price}</td></tr>`; });
  return `<html><head><title>Bill</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;margin-top:10px;} td,th{border:1px solid #ddd;padding:8px;}</style>
    </head><body>
    <h1>KT Family Store</h1>
    <p>Bill generated: ${new Date().toLocaleString()}</p>
    <table><thead><tr><th>#</th><th>Item</th><th>Price</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2"><strong>Total</strong></td><td>₹${total}</td></tr></tfoot></table>
    </body></html>`;
}

/* ================== INIT ================== */
prepareAuthUI();
if(sessionStorage.getItem(LOGGED_KEY)==='1') openApp();

/* Expose for inline onclick */
window.addToCart=addToCart;
window.removeFromCart=removeFromCart;
window.removeProduct=removeProduct;
