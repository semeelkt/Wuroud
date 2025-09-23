// --------- Product Data (replace with your real items) ----------
const products = [
    { name: "Red Sneakers",   price: 799, category: "footwear",   img: "image.png" },
    { name: "Sparkle Hair Clip", price: 120, category: "fancy",      img: "image copy.png" },
    { name: "RC Car",         price: 999, category: "toys",       img: "img/rc-car.jpg" },
    { name: "Notebook Pack",  price: 60,  category: "stationery", img: "img/notebook.jpg" },
    { name: "Blue Sandals",   price: 450, category: "footwear",   img: "img/sandals.jpg" },
  ];
  
  // --------- DOM Elements ----------
  const grid = document.getElementById("productGrid");
  const categoryFilter = document.getElementById("categoryFilter");
  const minPrice = document.getElementById("minPrice");
  const maxPrice = document.getElementById("maxPrice");
  const applyFilters = document.getElementById("applyFilters");
  const cartList = document.getElementById("cartList");
  const cartTotal = document.getElementById("cartTotal");
  
  // --------- Cart ----------
  let cart = [];
  
  // Render products
  function displayProducts(items) {
    grid.innerHTML = "";
    items.forEach((p, index) => {
      grid.innerHTML += `
        <div class="product">
          <img src="${p.img}" alt="${p.name}">
          <h3>${p.name}</h3>
          <p>₹${p.price}</p>
          <button onclick="addToCart(${index})">Add to Cart</button>
        </div>
      `;
    });
  }
  
  // Filter logic
  function filterProducts() {
    const cat = categoryFilter.value;
    const min = parseInt(minPrice.value) || 0;
    const max = parseInt(maxPrice.value) || Infinity;
  
    const filtered = products.filter(p =>
      (cat === "all" || p.category === cat) &&
      p.price >= min &&
      p.price <= max
    );
  
    displayProducts(filtered);
  }
  
  // Add to Cart
  function addToCart(index) {
    cart.push(products[index]);
    updateCart();
  }
  
  // Update Cart Display
  function updateCart() {
    cartList.innerHTML = "";
    let total = 0;
    cart.forEach(item => {
      cartList.innerHTML += `<li>${item.name} - ₹${item.price}</li>`;
      total += item.price;
    });
    cartTotal.textContent = cart.length
      ? `Total: ₹${total}`
      : "No items selected.";
  }
  
  // Event listeners
  applyFilters.addEventListener("click", filterProducts);
  
  // Initial load
  displayProducts(products);