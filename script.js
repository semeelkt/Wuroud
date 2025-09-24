// =====================
//   Persistence Utils
// =====================
function saveProducts() {
  localStorage.setItem('products', JSON.stringify(products));
}
function loadProducts() {
  const saved = localStorage.getItem('products');
  return saved ? JSON.parse(saved) : [];
}

// =====================
//   DOM Elements
// =====================
const productNameInput = document.getElementById('productName');
const productPriceInput = document.getElementById('productPrice');
const addBtn          = document.getElementById('addBtn');
const productList     = document.getElementById('productList');
const cartList        = document.getElementById('cartList');
const cartTotalEl     = document.getElementById('cartTotal');
const generateBillBtn = document.getElementById('generateBillBtn');

// =====================
//   Data
// =====================
let products = loadProducts();
let cart = [];

// =====================
//   Rendering
// =====================
function renderProducts() {
  productList.innerHTML = '';
  products.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      ${p.name} – ₹${p.price}
      <button data-i="${i}" class="addToCart">Add to Cart</button>
      <button data-i="${i}" class="deleteProduct">Delete</button>
    `;
    productList.appendChild(li);
  });
}

function renderCart() {
  cartList.innerHTML = '';
  let total = 0;
  cart.forEach((item, i) => {
    total += item.price;
    const li = document.createElement('li');
    li.innerHTML = `
      ${item.name} – ₹${item.price}
      <button data-i="${i}" class="removeCart">Remove</button>
    `;
    cartList.appendChild(li);
  });
  cartTotalEl.textContent = total;
}

// =====================
//   Events
// =====================
addBtn.addEventListener('click', () => {
  const name = productNameInput.value.trim();
  const price = parseFloat(productPriceInput.value);
  if (!name || isNaN(price)) return alert('Enter valid name & price');

  products.push({ name, price });
  saveProducts();
  renderProducts();
  productNameInput.value = '';
  productPriceInput.value = '';
});

productList.addEventListener('click', e => {
  if (e.target.classList.contains('addToCart')) {
    const p = products[e.target.dataset.i];
    cart.push(p);
    renderCart();
  }
  if (e.target.classList.contains('deleteProduct')) {
    products.splice(e.target.dataset.i, 1);
    saveProducts();
    renderProducts();
  }
});

cartList.addEventListener('click', e => {
  if (e.target.classList.contains('removeCart')) {
    cart.splice(e.target.dataset.i, 1);
    renderCart();
  }
});

// =====================
//   Bill as PDF
// =====================
function buildBillHTML() {
  const date = new Date().toLocaleString();
  const rows = cart.map(c =>
    `<tr><td>${c.name}</td><td>₹${c.price}</td></tr>`
  ).join('');
  const total = cart.reduce((t, c) => t + c.price, 0);
  return `
    <div style="font-family:Arial;padding:20px;max-width:500px">
      <h2 style="text-align:center;">KT Product Bill</h2>
      <p>Date: ${date}</p>
      <table border="1" cellspacing="0" cellpadding="6" width="100%">
        <thead>
          <tr><th>Item</th><th>Price</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td><strong>Total</strong></td><td><strong>₹${total}</strong></td></tr>
        </tfoot>
      </table>
    </div>
  `;
}

generateBillBtn.addEventListener('click', () => {
  if (!cart.length) return alert('No items in cart');
  const container = document.createElement('div');
  container.innerHTML = buildBillHTML();
  document.body.appendChild(container);

  const opts = {
    margin: 0.5,
    filename: `KT_Bill_${Date.now()}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opts).from(container).save().then(() => container.remove());
});

// =====================
//   Initial Render
// =====================
renderProducts();
renderCart();
