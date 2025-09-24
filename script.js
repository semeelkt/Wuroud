<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>KT Product Billing</title>
  <link rel="stylesheet" href="style.css"/>
</head>
<body>
  <header>
    <h1>KT Product Billing</h1>
  </header>

  <main>
    <!-- Add Product -->
    <section class="add-product">
      <input id="productName" type="text" placeholder="Product name" />
      <input id="productPrice" type="number" placeholder="Price" />
      <button id="addBtn">Add Product</button>
    </section>

    <!-- Product List -->
    <section>
      <h2>Products</h2>
      <ul id="productList"></ul>
    </section>

    <!-- Cart / Bill -->
    <section>
      <h2>Cart</h2>
      <ul id="cartList"></ul>
      <p class="total">Total: ₹<span id="cartTotal">0</span></p>
      <button id="generateBillBtn">Generate PDF Bill</button>
    </section>
  </main>

  <!-- ✅ html2pdf for instant PDF download -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script src="script.js"></script>
</body>
</html>
