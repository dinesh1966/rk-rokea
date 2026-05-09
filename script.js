// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBQcdDPRCNgF7yfAJpqdH2EFriGKTdvMKA",
  authDomain: "rokeya-3ccaa.firebaseapp.com",
  projectId: "rokeya-3ccaa",
  storageBucket: "rokeya-3ccaa.firebasestorage.app",
  messagingSenderId: "474801043436",
  appId: "1:474801043436:web:e12c0bf29704e4319072c9",
  measurementId: "G-H1GBK81D1Z"
};

let db = null;
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  if (typeof firebase.analytics === 'function') {
    firebase.analytics();
  }
  console.log("Firebase Connected to rokeya-3ccaa!");
}

// Initial Data
const JEWELLERY_CARE_INSTRUCTIONS = `CARE & SAFETY
✦	Cleaning: Wipe gently with a soft, dry cloth after each use. Avoid water, soap, or chemical cleaners.
✦	Storage: Store in a zip-lock pouch or airtight jewellery box to prevent tarnishing and dust accumulation.
✦	Avoid Moisture: Do not wear while bathing, swimming, or during heavy perspiration. Moisture accelerates tarnishing.
✦	Perfume & Chemicals: Apply perfume and hairspray before wearing. Keep the jewellery away from cosmetics and cleaning agents.
✦	Handling: Handle gently; avoid bending, dropping, or pulling on delicate motifs or stone settings.
✦	Stone Care: Do not scrub stone-set pieces. Wipe stone surfaces with a cotton swab to maintain shine.
✦	Longevity Tip: Occasional light polish with a soft cloth keeps the finish bright. Store separately to avoid scratches.`;

const defaultProducts = [
  ...Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `Kanjivaram Silk Saree ${i + 1}`,
    category: 'sarees',
    price: 18000 + (Math.floor(Math.random() * 15) * 1000),
    image: i % 2 === 0 ? 'luxury_red_saree.png' : 'emerald_green_saree.png',
    imageHover: i % 2 === 0 ? 'emerald_green_saree.png' : 'luxury_red_saree.png',
    description: "Authentic hand-woven silk with gold zari.",
    productCare: "Dry clean only. Store in a cool, dry place. Avoid direct contact with sunlight and moisture.",
    stock: i % 8 === 0 ? 'Out of Stock' : 'In Stock'
  })),
  ...Array.from({ length: 20 }, (_, i) => ({
    id: i + 21,
    name: `Imperial Jewel Set ${i + 1}`,
    category: 'imitation',
    price: 4500 + (Math.floor(Math.random() * 20) * 500),
    image: 'temple_jewellery_set.png',
    imageHover: 'saforio_instagram_jewel_1.png',
    description: "Premium kemp stone traditional set.",
    productCare: JEWELLERY_CARE_INSTRUCTIONS,
    stock: i % 10 === 0 ? 'Out of Stock' : 'In Stock'
  }))
];

let products = JSON.parse(localStorage.getItem('saforio_products')) || defaultProducts;

// Migration: Ensure all products have 'image', 'imageHover' and 'id'
products = products.map(p => {
  let care = p.productCare || p.care;
  // If it's a jewellery item and doesn't have the structured instructions, apply them
  if (p.category === 'imitation' && (!care || !care.includes('✦'))) {
    care = JEWELLERY_CARE_INSTRUCTIONS;
  }
  return {
    ...p,
    id: p.id || Date.now() + Math.random(),
    image: p.image || p.img,
    imageHover: p.imageHover || p.imgHover || p.image || p.img,
    productCare: care,
    // Prioritize price from description if found, otherwise keep existing
    price: Number(extractPriceFromDesc(p.description)) || Number(p.price) || 0
  };
});

function extractPriceFromDesc(desc) {
  if (!desc) return 0;
  // Look for currency symbols or labels
  const priceMatch = desc.match(/(?:₹|Rs\.?|Price|Rate|Cost)\D*([\d,]+)/i);
  if (priceMatch) {
    const val = parseInt(priceMatch[1].replace(/,/g, ''));
    return isNaN(val) ? 0 : val;
  }
  // Look for any 3-6 digit number that isn't part of another word
  const numbers = desc.match(/\b\d[\d,]{2,6}\b/g);
  if (numbers) {
    // Pick the largest number found as it's most likely the price
    const values = numbers.map(n => parseInt(n.replace(/,/g, ''))).filter(v => v > 100);
    if (values.length > 0) return Math.max(...values);
  }
  return 0;
}
localStorage.setItem('saforio_products', JSON.stringify(products));

let cart = JSON.parse(localStorage.getItem('saforio_cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('saforio_wishlist')) || [];
let users = JSON.parse(localStorage.getItem('saforio_users')) || [];
let currentCategory = 'sarees';
let currentSort = 'default';
let currentUser = JSON.parse(localStorage.getItem('saforio_currentUser')) || null;
let modalHistory = [];

function saveProducts() {
  localStorage.setItem('saforio_products', JSON.stringify(products));
  renderAll();
}

// --- FIRESTORE PRODUCT SYNC ---
async function loadProducts() {
  if (db) {
    try {
      const snapshot = await db.collection("products").get();
      if (!snapshot.empty) {
        const fsProducts = [];
        snapshot.forEach(doc => {
          let p = doc.data();
          // Migration for Firestore data
          let care = p.productCare || p.care;
          if (p.category === 'imitation' && (!care || !care.includes('✦'))) {
            care = JEWELLERY_CARE_INSTRUCTIONS;
            // Optionally sync back to firestore if it was missing
            db.collection("products").doc(p.id.toString()).update({ productCare: care });
          }
          fsProducts.push({ ...p, productCare: care });
        });
        products = fsProducts;
        localStorage.setItem('saforio_products', JSON.stringify(products));
        renderAll();
      } else if (products.length > 0) {
        // If Firestore is empty but we have local products/defaults, upload them to initialize Firestore
        console.log("Initializing Firestore with products...");
        products.forEach(p => {
          db.collection("products").doc(p.id.toString()).set(p);
        });
      }
    } catch (err) {
      console.error("Firestore product load error:", err);
    }
  }
}

async function loadUsers() {
  if (db) {
    try {
      const snapshot = await db.collection("users").get();
      if (!snapshot.empty) {
        const fsUsers = [];
        snapshot.forEach(doc => fsUsers.push(doc.data()));
        users = fsUsers;
        localStorage.setItem('saforio_users', JSON.stringify(users));
      }
    } catch (err) {
      console.error("Firestore users load error:", err);
    }
  }
}

loadProducts().then(() => {
  renderMarquee();
});
loadUsers();

function saveUsers() {
  localStorage.setItem('saforio_users', JSON.stringify(users));
}

// --- CART & PAYMENT ---

function toggleCart() {
  const modal = document.getElementById('cartModal');
  modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
  document.body.classList.toggle('modal-open', modal.style.display === 'flex');
  renderCart();
}

window.toggleMobileMenu = () => {
  const menu = document.getElementById('mobileMenu');
  if (menu) {
    menu.classList.toggle('active');
    document.body.classList.toggle('modal-open', menu.classList.contains('active'));
  }
}

function addToCart(productId) {
  const p = products.find(prod => prod.id == productId);
  if (!p || p.stock === "Out of Stock") return;
  cart.push(p);
  localStorage.setItem('saforio_cart', JSON.stringify(cart));
  updateCartIcon();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem('saforio_cart', JSON.stringify(cart));
  renderCart();
  updateCartIcon();
}

function updateCartIcon() {
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.innerText = cart.length;
}

// --- WISHLIST LOGIC ---

function toggleWishlist() {
  const modal = document.getElementById('wishlistModal');
  modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
  document.body.classList.toggle('modal-open', modal.style.display === 'flex');
  renderWishlist();
}

function addToWishlist(productId) {
  if (!currentUser) { openAuth(); return; }
  const index = wishlist.findIndex(p => p.id == productId);
  if (index > -1) {
    wishlist.splice(index, 1);
  } else {
    const p = products.find(prod => prod.id == productId);
    if (p) wishlist.push(p);
  }
  localStorage.setItem('saforio_wishlist', JSON.stringify(wishlist));
  updateWishlistIcon();
  renderGrid();
}

function removeFromWishlist(index) {
  wishlist.splice(index, 1);
  localStorage.setItem('saforio_wishlist', JSON.stringify(wishlist));
  updateWishlistIcon();
  renderWishlist();
  renderGrid();
}

function updateWishlistIcon() {
  const countEl = document.getElementById('wish-count');
  if (countEl) countEl.innerText = wishlist.length;
}

function renderWishlist() {
  const list = document.getElementById('wishlist-items');
  if (!list) return;
  list.innerHTML = '';
  if (wishlist.length === 0) {
    list.innerHTML = '<div style="text-align:center; margin-top: 40px; color: #888;">Your wishlist is empty. ✿</div>';
  }
  wishlist.forEach((item, index) => {
    list.innerHTML += `
      <div class="cart-item">
        <img src="${item.image || item.img}" style="width:50px">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${item.price}</div>
          <button class="btn-primary" style="margin-top:5px; font-size:9px; padding:6px 10px;" onclick="wishToCart(${index})">Move to Cart</button>
        </div>
        <button class="btn-remove" onclick="removeFromWishlist(${index})">&times;</button>
      </div>`;
  });
}

function wishToCart(index) {
  const p = wishlist[index];
  addToCart(p.id);
  wishlist.splice(index, 1);
  localStorage.setItem('saforio_wishlist', JSON.stringify(wishlist));
  updateWishlistIcon();
  renderWishlist();
  renderGrid();
}

function moveAllToCart() {
  if (wishlist.length === 0) return alert("Wishlist is empty!");
  wishlist.forEach(p => addToCart(p.id));
  wishlist = [];
  localStorage.setItem('saforio_wishlist', JSON.stringify(wishlist));
  updateWishlistIcon();
  renderWishlist();
  renderGrid();
  toggleWishlist();
  toggleCart();
}

function renderCart() {
  const list = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (!list) return;
  list.innerHTML = '';
  let total = 0;
  cart.forEach((item, index) => {
    total += parseInt(item.price);
    list.innerHTML += `
      <div class="cart-item">
        <img src="${item.image || item.img}" style="width:50px">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${item.price}</div>
        </div>
        <button class="btn-remove" onclick="removeFromCart(${index})">&times;</button>
      </div>`;
  });
  if (totalEl) totalEl.innerText = `₹${total}`;
}

function openCheckout() {
  if (cart.length === 0) { alert("Your cart is empty!"); return; }
  document.getElementById('cartModal').style.display = 'none';
  document.getElementById('checkoutModal').style.display = 'flex';
}

function closeCheckout() {
  document.getElementById('checkoutModal').style.display = 'none';
}

function handleOrder(e) {
  e.preventDefault();
  const name = document.getElementById('orderName').value;
  const phone = document.getElementById('orderPhone').value;
  const address = document.getElementById('orderAddress').value;
  let totalAmount = cart.reduce((sum, item) => sum + parseInt(item.price), 0);

  const options = {
    "key": "rzp_live_SEMSm8iPbUKAu9",
    "amount": totalAmount * 100,
    "currency": "INR",
    "name": "ROKEA by RK Boutique",
    "description": "Payment for " + name,
    "handler": function (response) {
      alert("Payment Successful! ID: " + response.razorpay_payment_id);

      const orderData = {
        items: cart,
        total: totalAmount,
        customer: { name, phone, address },
        paymentId: response.razorpay_payment_id,
        date: new Date().toISOString()
      };

      // Save to localStorage
      const orders = JSON.parse(localStorage.getItem('saforio_orders')) || [];
      orders.push({ id: Date.now(), ...orderData, date: new Date().toLocaleDateString() });
      localStorage.setItem('saforio_orders', JSON.stringify(orders));

      // Save to Firebase Firestore
      if (db) {
        db.collection("orders").add(orderData)
          .then(() => console.log("Order saved to Firestore!"))
          .catch((error) => console.error("Firestore order error:", error));
      }

      cart = [];
      localStorage.removeItem('saforio_cart');
      updateCartIcon();
      closeCheckout();
    },
    "prefill": { "name": name, "contact": phone },
    "theme": { "color": "#C9A84C" }
  };

  const rzp1 = new Razorpay(options);
  rzp1.on('payment.failed', function (response) {
    alert("Payment Failed! Reason: " + response.error.description);
  });
  rzp1.open();
}

// AUTH LOGIC
const authModal = document.getElementById('authModal');
const loginView = document.getElementById('loginView');
const regView = document.getElementById('registerView');

window.openAuth = () => {
  if (authModal) { authModal.style.display = 'flex'; document.body.classList.add('modal-open'); }
}
window.closeAuth = () => {
  if (authModal) { authModal.style.display = 'none'; document.body.classList.remove('modal-open'); }
}
window.toggleAuth = (showLogin) => {
  if (loginView) loginView.style.display = showLogin ? 'block' : 'none';
  if (regView) regView.style.display = showLogin ? 'none' : 'block';
}

window.handleRegister = () => {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const phone = document.getElementById('regPhone').value;
  const pass = document.getElementById('regPass').value;
  if (!name || !email || !pass) return alert('Fill all fields');

  const userData = { name, email, phone, pass, date: new Date().toISOString() };

  // Save to localStorage
  users.push({ ...userData, date: new Date().toLocaleDateString() });
  saveUsers();

  // Save to Firestore
  if (db) {
    db.collection("users").add(userData)
      .then(() => console.log("User saved to Firestore!"))
      .catch(err => console.error("Firestore user error:", err));
  }

  alert('Account created! Please login.');
  toggleAuth(true);
}

window.handleAuth = () => {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;

  if (email === 'admin' && pass === 'admin@123') {
    closeAuth();
    document.getElementById('adminModal').style.display = 'flex';
    renderAll();
    return;
  }

  const user = users.find(u => u.email === email && u.pass === pass);
  if (user) {
    currentUser = user;
    localStorage.setItem('saforio_currentUser', JSON.stringify(user));
    updateUserUI();
    closeAuth();
  } else {
    alert('Invalid credentials');
  }
}

function updateUserUI() {
  const link = document.getElementById('userLinkCont');
  if (currentUser && link) {
    link.innerHTML = `<span style="font-size:10px;color:var(--gold);margin-right:15px">HELLO, ${currentUser.name.split(' ')[0].toUpperCase()}</span><a href="javascript:void(0)" onclick="logoutUser()">Logout</a>`;
  }
}

window.logoutUser = () => {
  localStorage.removeItem('saforio_currentUser');
  location.reload();
}

window.toggleAdminMenu = (forceClose = false) => {
  if (window.innerWidth > 1024) return;
  const navLinks = document.querySelector('.admin-nav-links');
  const toggleBtn = document.querySelector('.admin-menu-toggle');
  if (!navLinks || !toggleBtn) return;

  if (forceClose) {
    navLinks.classList.remove('active');
    toggleBtn.classList.remove('active');
  } else {
    navLinks.classList.toggle('active');
    toggleBtn.classList.toggle('active');
  }
}


// =============================================
// ADMIN DASHBOARD TABS
// =============================================

window.switchAdminTab = (tab) => {
  document.getElementById('viewProducts').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('viewCustomers').style.display = tab === 'customers' ? 'block' : 'none';
  document.getElementById('viewLeads').style.display = tab === 'leads' ? 'block' : 'none';
  document.getElementById('viewOrders').style.display = tab === 'orders' ? 'block' : 'none';

  document.getElementById('tabProducts').classList.toggle('active', tab === 'products');
  document.getElementById('tabCustomers').classList.toggle('active', tab === 'customers');
  document.getElementById('tabLeads').classList.toggle('active', tab === 'leads');
  document.getElementById('tabOrders').classList.toggle('active', tab === 'orders');

  const titleEl = document.getElementById('adminTabTitle');
  if (tab === 'products') titleEl.innerText = 'Product Management';
  else if (tab === 'customers') titleEl.innerText = 'Customer Records';
  else if (tab === 'leads') titleEl.innerText = 'Consultation Leads';
  else titleEl.innerText = 'Order & Payment History';

  document.getElementById('addBtnTop').style.display = tab === 'products' ? 'block' : 'none';

  if (tab === 'customers') renderAdminCustomers();
  if (tab === 'leads') renderAdminLeads();
  if (tab === 'orders') renderAdminOrders();

  // Auto-close menu on mobile after switching tab
  window.toggleAdminMenu(true);
}

// =============================================
// ADMIN: LEADS — Firestore + localStorage fallback
// =============================================

function renderAdminLeads() {
  const list = document.getElementById('adminLeadList');
  if (!list) return;

  // Show loading state
  list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--muted);">Loading leads...</td></tr>';

  if (db) {
    db.collection("leads")
      .orderBy("date", "desc")
      .get()
      .then((snapshot) => {
        if (snapshot.empty) {
          list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--muted);">No leads captured yet.</td></tr>';
          return;
        }
        list.innerHTML = snapshot.docs.map((doc) => {
          const l = doc.data();
          const dateStr = l.date ? new Date(l.date).toLocaleDateString('en-IN') : 'N/A';
          return `
            <tr>
              <td><strong>${l.name || 'N/A'}</strong></td>
              <td>${l.phone || 'N/A'}</td>
              <td><span class="badge" style="background:var(--ivory); padding:5px 10px; font-size:10px; border:1px solid var(--gold);">${l.interest || 'N/A'}</span></td>
              <td>${dateStr}</td>
              <td><button class="admin-btn btn-delete" onclick="deleteFirebaseLead('${doc.id}')">Delete</button></td>
            </tr>`;
        }).join('');
      })
      .catch((err) => {
        console.error("Firestore leads fetch error:", err);
        renderAdminLeadsLocal(); // fallback
      });
  } else {
    renderAdminLeadsLocal();
  }
}

function renderAdminLeadsLocal() {
  const list = document.getElementById('adminLeadList');
  if (!list) return;
  const leads = JSON.parse(localStorage.getItem('saforio_leads')) || [];
  if (leads.length === 0) {
    list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--muted);">No leads captured yet.</td></tr>';
    return;
  }
  list.innerHTML = leads.map((l, idx) => `
    <tr>
      <td><strong>${l.name}</strong></td>
      <td>${l.phone}</td>
      <td><span class="badge" style="background:var(--ivory); padding:5px 10px; font-size:10px; border:1px solid var(--gold);">${l.interest}</span></td>
      <td>${l.date}</td>
      <td><button class="admin-btn btn-delete" onclick="deleteLocalLead(${idx})">Delete</button></td>
    </tr>`).join('');
}

window.deleteFirebaseLead = (docId) => {
  if (!confirm('Delete this lead?')) return;
  db.collection("leads").doc(docId).delete()
    .then(() => { console.log("Lead deleted from Firestore"); renderAdminLeads(); })
    .catch(err => console.error("Delete lead error:", err));
}

window.deleteLocalLead = (idx) => {
  if (!confirm('Delete this lead record?')) return;
  const leads = JSON.parse(localStorage.getItem('saforio_leads')) || [];
  leads.splice(idx, 1);
  localStorage.setItem('saforio_leads', JSON.stringify(leads));
  renderAdminLeadsLocal();
}

// Legacy alias
window.deleteLead = window.deleteLocalLead;

// =============================================
// ADMIN: CUSTOMERS — Firestore + localStorage fallback
// =============================================

function renderAdminCustomers() {
  const list = document.getElementById('adminCustomerList');
  if (!list) return;

  list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--muted);">Loading customers...</td></tr>';

  if (db) {
    db.collection("users")
      .orderBy("date", "desc")
      .get()
      .then((snapshot) => {
        if (snapshot.empty) {
          list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--muted);">No customers registered yet.</td></tr>';
          return;
        }
        list.innerHTML = snapshot.docs.map((doc) => {
          const u = doc.data();
          const dateStr = u.date ? new Date(u.date).toLocaleDateString('en-IN') : 'N/A';
          return `
            <tr>
              <td><strong>${u.name || 'N/A'}</strong></td>
              <td>${u.email || 'N/A'}</td>
              <td>${u.phone || 'N/A'}</td>
              <td>${dateStr}</td>
            </tr>`;
        }).join('');
      })
      .catch((err) => {
        console.error("Firestore customers fetch error:", err);
        renderAdminCustomersLocal(); // fallback
      });
  } else {
    renderAdminCustomersLocal();
  }
}

function renderAdminCustomersLocal() {
  const list = document.getElementById('adminCustomerList');
  if (!list) return;
  if (users.length === 0) {
    list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--muted);">No customers yet.</td></tr>';
    return;
  }
  list.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone}</td>
      <td>${u.date}</td>
    </tr>`).join('');
}

// =============================================
// ADMIN: ORDERS — Firestore + localStorage fallback
// =============================================

function renderAdminOrders() {
  const list = document.getElementById('adminOrderList');
  if (!list) return;

  list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--muted);">Loading orders...</td></tr>';

  if (db) {
    db.collection("orders")
      .orderBy("date", "desc")
      .get()
      .then((snapshot) => {
        if (snapshot.empty) {
          list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--muted);">No orders found.</td></tr>';
          return;
        }
        list.innerHTML = snapshot.docs.map((doc) => {
          const o = doc.data();
          const dateStr = o.date ? new Date(o.date).toLocaleDateString('en-IN') : 'N/A';
          const itemNames = (o.items || []).map(i => i.name).join(', ');
          const shortId = doc.id.slice(0, 8).toUpperCase();
          return `
            <tr>
              <td><strong>#${shortId}</strong></td>
              <td>${o.customer?.name || 'N/A'}</td>
              <td>${o.customer?.phone || 'N/A'}</td>
              <td>₹${(o.total || 0).toLocaleString('en-IN')}</td>
              <td><span class="badge" style="background:var(--ivory); padding:5px 10px; font-size:10px; border:1px solid var(--gold);">${o.paymentId || 'N/A'}</span></td>
              <td>${dateStr}</td>
              <td>
                <button class="admin-btn btn-edit" onclick="alert('Items:\\n\\n${itemNames.replace(/'/g, "\\'")}')">View Items</button>
              </td>
            </tr>`;
        }).join('');
      })
      .catch((err) => {
        console.error("Firestore orders fetch error:", err);
        renderAdminOrdersLocal(); // fallback
      });
  } else {
    renderAdminOrdersLocal();
  }
}

function renderAdminOrdersLocal() {
  const list = document.getElementById('adminOrderList');
  const orders = JSON.parse(localStorage.getItem('saforio_orders')) || [];
  if (orders.length === 0) {
    list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--muted);">No orders found.</td></tr>';
    return;
  }
  list.innerHTML = orders.map((o) => `
    <tr>
      <td><strong>#${o.id}</strong></td>
      <td>${o.customer.name}</td>
      <td>${o.customer.phone}</td>
      <td>₹${o.total.toLocaleString()}</td>
      <td><span class="badge" style="background:var(--ivory); padding:5px 10px; font-size:10px; border:1px solid var(--gold);">${o.paymentId || 'N/A'}</span></td>
      <td>${o.date}</td>
      <td><button class="admin-btn btn-edit" onclick="viewOrderItems(${o.id})">View Items</button></td>
    </tr>`).join('');
}

window.viewOrderItems = (orderId) => {
  const orders = JSON.parse(localStorage.getItem('saforio_orders')) || [];
  const order = orders.find(o => o.id === orderId);
  if (order) {
    const itemNames = order.items.map(item => item.name).join('\n');
    alert(`Items for Order #${order.id}:\n\n${itemNames}`);
  }
}

// =============================================
// MARQUEE RENDERING
// =============================================

function renderMarquee() {
  const track = document.getElementById('marquee-track');
  if (!track) return;

  // Show up to 15 products in the marquee
  const displayProducts = products.slice(0, 15);

  let content = displayProducts.map(p => `
    <span class="marquee-item" onclick="openProductDetail(${p.id})" style="cursor:pointer">
      ${p.name} <span class="marquee-price" style="color:#fff; margin-left: 5px; opacity: 0.9;">— ₹${(extractPriceFromDesc(p.description) || p.price || 0).toLocaleString('en-IN')}</span> <span class="marquee-dot"></span>
    </span>
  `).join('');

  // Duplicate for seamless loop
  track.innerHTML = content + content;
}

// =============================================
// PRODUCT GRID
// =============================================

function renderGrid() {
  const grid = document.getElementById('main-product-grid');
  if (!grid) return;
  let filtered = products.filter(p => p.category === currentCategory);

  // Apply Sorting
  if (currentSort === 'low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'high') {
    filtered.sort((a, b) => b.price - a.price);
  }

  grid.innerHTML = filtered.map((p) => {
    const inWishlist = wishlist.find(w => w.id == p.id);
    return `
    <div class="product-card" style="animation: fadeInUp 0.5s ease forwards;" onclick="openProductDetail(${p.id})">
      <div class="product-img ${p.stock === 'Out of Stock' ? 'out-of-stock' : ''}">
        <img src="${p.image || p.img}" alt="${p.name}" class="img-main">
        <img src="${p.imageHover || p.imgHover || p.image || p.img}" class="img-hover" alt="${p.name}">
        <div class="product-wish ${inWishlist ? 'active' : ''}" onclick="event.stopPropagation(); addToWishlist(${p.id})">
          <svg class="wish-icon-svg" viewBox="0 0 24 24" fill="${inWishlist ? '#e91e63' : 'none'}" stroke="${inWishlist ? '#e91e63' : '#fff'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </div>
      </div>
      <div class="product-info" style="display: flex; flex-direction: column; flex-grow: 1; padding: 15px;">
        <div class="product-price" style="display: block !important; margin-bottom: 8px;">
          <span class="price-main" style="color: var(--gold-dark); font-weight: 700; font-size: 18px;">₹${(extractPriceFromDesc(p.description) || p.price || 0).toLocaleString('en-IN')}</span>
        </div>
        <div class="product-type" style="font-size: 10px; color: var(--muted); text-transform: uppercase;">${p.category.toUpperCase()}</div>
        <h3 class="product-name" style="margin: 5px 0 15px 0;">${p.name}</h3>
        <button class="btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: auto;" onclick="event.stopPropagation(); addToCart(${p.id})" ${p.stock === "Out of Stock" ? 'disabled' : ''}>
          ${p.stock === "Out of Stock" ? 'Sold Out' : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Add to Cart`}
        </button>
      </div>
    </div>`;
  }).join('');
}

window.switchCategory = (cat) => {
  currentCategory = cat;
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.cat === cat);
  });
  renderGrid();
}

window.selectCategory = (cat) => {
  // Navigate to collections page
  window.location.href = `collections.html?category=${cat}`;
}

window.backToCategories = () => {
  // Navigate back to home page category section
  window.location.href = 'index.html#products';
}

window.applySort = (sortType) => {
  currentSort = sortType;
  renderGrid();
}

function renderAdminList() {
  const list = document.getElementById('adminProductList');
  if (!list) return;
  list.innerHTML = products.map((p, idx) => `
    <div class="admin-item">
      <div class="admin-img" style="width:40px;height:40px;border-radius:4px;flex-shrink:0; background:url('${p.image || p.img}') center/cover"></div>
      <div class="admin-item-info">
        <div style="font-size:12px; font-weight:600;">${p.name}</div>
        <div style="font-size:10px; color:var(--muted)">${p.category} • ₹${p.price.toLocaleString('en-IN')} • ${p.stock.toUpperCase()}</div>
      </div>
      <div class="admin-item-actions">
        <button class="admin-btn btn-edit" onclick="editProduct(${idx})">Edit</button>
        <button class="admin-btn btn-delete" onclick="deleteProduct(${idx})">Delete</button>
      </div>
    </div>`).join('');
}

function renderAll() {
  renderGrid();
  renderAdminList();
  renderMarquee();
}

const adminModal = document.getElementById('adminModal');
const productForm = document.getElementById('productForm');

if (productForm) {
  productForm.onsubmit = (e) => {
    e.preventDefault();
    const editIndex = parseInt(document.getElementById('editIndex').value);
    const newProd = {
      name: document.getElementById('prodName').value,
      category: document.getElementById('prodCategory').value,
      price: parseInt(document.getElementById('prodPrice').value),
      image: document.getElementById('prodImg').value,
      imageHover: document.getElementById('prodImgHover').value,
      extraImages: document.getElementById('prodExtraImgs') ? document.getElementById('prodExtraImgs').value.split(',').map(s => s.trim()).filter(Boolean) : [],
      stock: document.getElementById('prodStock').value,
      description: document.getElementById('prodDesc').value,
      productCare: document.getElementById('prodCare').value
    };
    // Sync price from description if present
    const extractedPrice = extractPriceFromDesc(newProd.description);
    if (extractedPrice > 0) {
      newProd.price = extractedPrice;
    }
    if (editIndex > -1) {
      newProd.id = products[editIndex].id;
      products[editIndex] = newProd;
    } else {
      newProd.id = Date.now();
      products.unshift(newProd);
    }

    // Sync to Firestore
    if (db) {
      db.collection("products").doc(newProd.id.toString()).set(newProd)
        .then(() => console.log("Product synced to Cloud"))
        .catch(err => console.error("Cloud sync error:", err));
    }

    saveProducts();
    currentCategory = newProd.category;
    switchCategory(currentCategory);
    productForm.reset();
    document.getElementById('editIndex').value = "-1";
    document.getElementById('submitBtn').innerText = "Save Product";
    alert("Successfully Saved: " + newProd.name);
  };
}

window.editProduct = (idx) => {
  const p = products[idx];
  document.getElementById('editIndex').value = idx;
  document.getElementById('prodName').value = p.name;
  document.getElementById('prodCategory').value = p.category;
  document.getElementById('prodPrice').value = p.price;
  document.getElementById('prodImg').value = p.image || p.img;
  document.getElementById('prodImgHover').value = p.imageHover || p.imgHover || p.image || p.img;
  if (document.getElementById('prodExtraImgs')) document.getElementById('prodExtraImgs').value = p.extraImages ? p.extraImages.join(', ') : "";
  document.getElementById('prodStock').value = p.stock;
  document.getElementById('prodDesc').value = p.description || "";
  if (document.getElementById('prodCare')) document.getElementById('prodCare').value = p.productCare || "";
  document.getElementById('submitBtn').innerText = "Update Product";
  if (adminModal) adminModal.querySelector('.admin-main').scrollTop = 0;
};

window.deleteProduct = (idx) => {
  if (confirm('Delete this product permanently?')) {
    const p = products[idx];
    products.splice(idx, 1);
    saveProducts();
    if (db && p.id) {
      db.collection("products").doc(p.id.toString()).delete()
        .then(() => console.log("Product deleted from cloud"))
        .catch(err => console.error("Cloud delete error:", err));
    }
  }
};

// Full Story Logic
const storyModal = document.getElementById('storyModal');
window.openFullStory = () => { if (storyModal) storyModal.style.display = 'flex'; }
window.closeFullStory = () => { if (storyModal) storyModal.style.display = 'none'; }

// Close modals on background click
window.onclick = (e) => {
  if (e.target === adminModal) return;
  if (e.target === authModal) closeAuth();
  if (e.target === storyModal) closeFullStory();
  if (e.target === document.getElementById('leadModal')) closeLeadModal();
  if (e.target === document.getElementById('productDetailModal')) closeProductDetail();
}

// PRODUCT DETAIL LOGIC
let currentDetailImages = [];
let currentDetailIndex = 0;
let touchstartX = 0;
let touchendX = 0;

window.openProductDetail = (productId) => {
  // Navigate to dedicated product page
  window.location.href = `product-details.html?id=${productId}`;
}

function renderRelatedProducts(category, currentId) {
  const slider = document.getElementById('relatedSlider');
  if (!slider) return;
  // Fallback to all products if less than 5 related
  let related = products.filter(p => p.category === category && p.id != currentId);
  if (related.length < 5) related = products.filter(p => p.id != currentId);
  slider.innerHTML = related.map((p, idx) => `
    <div class="slider-item product-card" onclick="openProductDetail(${p.id})" style="flex: 0 0 calc(20% - 12px); min-width: 190px; overflow: visible;">
      <div style="position: relative; width: 100%; aspect-ratio: 4/5; background: #fafafa;">
         <img src="${p.imageHover || p.imgHover || p.image || p.img}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;">
         <div style="position: absolute; top: 12px; left: 12px; border: 1px solid rgba(0,0,0,0.3); color: #222; padding: 4px 14px; font-size: 10px; border-radius: 20px; background: rgba(255,255,255,0.85); display: ${idx % 3 === 0 ? 'none' : 'block'}">Best Seller</div>
      </div>
      <div style="padding: 16px 15px; display: flex; flex-direction: column; flex-grow: 1;">
         <div style="font-size: 13px; color: var(--gold-dark); font-weight: 700; margin-bottom: 8px;">₹${(extractPriceFromDesc(p.description) || p.price || 0).toLocaleString('en-IN')}</div>
         <div style="font-family: 'Poppins', sans-serif; font-size: 11px; color: #444; text-transform: uppercase; margin-bottom: 12px; font-weight: 500; letter-spacing: 0px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.5; height: 33px;">${p.name}</div>
      </div>
    </div>`).join('');
}

window.scrollSlider = (dir) => {
  const slider = document.getElementById('relatedSlider');
  slider.scrollBy({ left: 300 * dir, behavior: 'smooth' });
}

window.closeProductDetail = () => {
  const modal = document.getElementById('productDetailModal');
  if (modal) modal.style.display = 'none';
  document.body.classList.remove('modal-open');
  modalHistory = [];
}

window.modalGoBack = () => {
  if (modalHistory.length > 0) {
    const lastId = modalHistory.pop();
    openProductDetail(lastId, true);
  }
}

window.switchDetailImage = (index) => {
  if (index < 0 || index >= currentDetailImages.length) return;
  currentDetailIndex = index;
  const src = currentDetailImages[index];
  document.getElementById('detailMainImg').src = src;

  const tItems = document.querySelectorAll('.thumb-item');
  tItems.forEach(t => { t.classList.remove('active'); t.style.borderColor = 'transparent'; });

  if (tItems[index]) {
    tItems[index].classList.add('active');
    tItems[index].style.borderColor = '#000';
  }
}

window.switchDetailTab = (tab) => {
  const descBtn = document.getElementById('tabDescBtn');
  const careBtn = document.getElementById('tabCareBtn');
  const descContent = document.getElementById('detailDesc');
  const careContent = document.getElementById('detailCare');

  if (!descBtn || !careBtn || !descContent || !careContent) return;

  if (tab === 'desc') {
    descBtn.classList.add('active');
    descBtn.style.background = '#000';
    descBtn.style.color = '#fff';
    descBtn.style.borderColor = '#000';

    careBtn.classList.remove('active');
    careBtn.style.background = '#fff';
    careBtn.style.color = '#888';
    careBtn.style.borderColor = '#eee';

    descContent.style.display = 'block';
    careContent.style.display = 'none';
  } else {
    careBtn.classList.add('active');
    careBtn.style.background = '#000';
    careBtn.style.color = '#fff';
    careBtn.style.borderColor = '#000';

    descBtn.classList.remove('active');
    descBtn.style.background = '#fff';
    descBtn.style.color = '#888';
    descBtn.style.borderColor = '#eee';

    descContent.style.display = 'none';
    careContent.style.display = 'block';
  }
}

function handleMainImgSwipe() {
  if (touchendX < touchstartX - 40) { // Swipe Left -> Next
    if (currentDetailIndex < currentDetailImages.length - 1) {
      switchDetailImage(currentDetailIndex + 1);
    }
  }
  if (touchendX > touchstartX + 40) { // Swipe Right -> Prev
    if (currentDetailIndex > 0) {
      switchDetailImage(currentDetailIndex - 1);
    }
  }
}

// LEAD POPUP LOGIC
setTimeout(() => {
  const leadModal = document.getElementById('leadModal');
  if (leadModal && !sessionStorage.getItem('leadShown')) {
    leadModal.style.display = 'flex';
    sessionStorage.setItem('leadShown', 'true');
  }
}, 8000);

window.closeLeadModal = () => {
  const modal = document.getElementById('leadModal');
  if (modal) modal.style.display = 'none';
}

window.handleLead = (e) => {
  e.preventDefault();
  const name = document.getElementById('leadName').value;
  const phone = document.getElementById('leadPhone').value;
  const interest = document.getElementById('leadInterest').value;

  const leadData = { name, phone, interest, date: new Date().toISOString() };

  // Save to localStorage
  const leads = JSON.parse(localStorage.getItem('saforio_leads')) || [];
  leads.push({ name, phone, interest, date: new Date().toLocaleDateString() });
  localStorage.setItem('saforio_leads', JSON.stringify(leads));

  // Save to Firestore
  if (db) {
    db.collection("leads").add(leadData)
      .then(() => console.log("Lead saved to Firestore!"))
      .catch(err => console.error("Firestore lead error:", err));
  }

  alert("Thank you, " + name + "! Our master stylist will contact you shortly.");
  closeLeadModal();
}

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .preview-close:hover {
    transform: scale(1.1);
    background: #c2185b !important;
  }

  .stylist-recommendation-card {
    position: relative;
    transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
    cursor: pointer;
    background: transparent !important;
    text-align: center !important;
    z-index: 1;
  }

  .stylist-recommendation-card:hover {
    transform: translateY(-10px) scale(1.05);
  }

  /* Elegant Glow for Circular Cards */
  .stylist-recommendation-card::before {
    content: "";
    position: absolute;
    inset: -10px;
    z-index: -1;
    background: radial-gradient(circle at center, rgba(201, 168, 76, 0.3) 0%, transparent 70%);
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.5s ease;
    filter: blur(10px);
  }

  .stylist-recommendation-card:hover::before {
    opacity: 1;
  }

  .stylist-recommendation-card .product-img {
    width: 150px !important;
    height: 150px !important;
    border-radius: 50% !important;
    margin: 0 auto 15px auto !important;
    border: 3px solid var(--gold);
    box-shadow: 0 10px 25px rgba(201,168,76,0.2);
    overflow: hidden;
    background: #fff;
    position: relative;
    z-index: 2;
    transition: all 0.5s ease;
  }

  .stylist-recommendation-card:hover .product-img {
    border-color: var(--gold-light);
    box-shadow: 0 15px 35px rgba(201, 168, 76, 0.4);
    transform: rotate(3deg);
  }

  .results-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 40px;
    margin-top: 40px;
  }
`;
document.head.appendChild(styleSheet);

updateUserUI();
updateWishlistIcon();
updateCartIcon();
renderAll();

// AI Stylist Logic
let stylistCache = new Map();

window.handleUserImage = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const imageData = e.target.result;
    const previewImg = document.getElementById('userPhotoPreview');
    const previewCont = document.getElementById('userPreviewCont');
    const zone = document.getElementById('uploadZone');
    const loader = document.getElementById('aiAnalysis');
    const results = document.getElementById('aiResults');

    if (previewImg) previewImg.src = imageData;
    if (zone) zone.style.display = 'none';
    if (previewCont) previewCont.style.display = 'block';
    if (loader) {
      loader.innerHTML = '<div class="ai-loader"></div><p id="aiStatus">Initializing AI Vision Engine...</p>';
      loader.style.display = 'block';
    }
    if (results) results.style.display = 'none';

    // Simulated Gender & Face Detection
    const statusEl = document.getElementById('aiStatus');

    setTimeout(() => {
      if (statusEl) statusEl.innerText = "Analyzing facial features & style profile...";

      setTimeout(() => {
        // Randomly simulate a "male" or "unclear" detection to fulfill "only allow women"
        // In a real app, this would be a model output.
        // For demonstration, let's say 90% are detected as female.
        const isFemale = Math.random() > 0.1;

        if (!isFemale) {
          alert("AI Detection Failed: Our virtual stylist currently only supports recommendations for girls and women. Please upload a clear photo of a woman.");
          resetStylist();
          return;
        }

        if (statusEl) statusEl.innerText = "Female profile detected. Analyzing skin tone & undertones...";

        setTimeout(() => {
          // Simulate skin tone detection
          const tones = ['Fair', 'Medium', 'Deep'];
          const detectedTone = tones[Math.floor(Math.random() * tones.length)];

          if (statusEl) statusEl.innerText = `${detectedTone} skin tone detected. Matching compatible palettes...`;

          setTimeout(() => {
            if (loader) loader.style.display = 'none';
            if (results) results.style.display = 'block';

            // Use cache if same image
            let recommended;
            if (stylistCache.has(imageData)) {
              recommended = stylistCache.get(imageData);
            } else {
              // Filter products based on skin tone compatibility (simulated tagging)
              recommended = matchProductsToSkinTone(detectedTone);
              stylistCache.set(imageData, recommended);
            }

            renderRecommendations(recommended, detectedTone);
          }, 1500);
        }, 1500);
      }, 1500);
    }, 1000);
  };
  reader.readAsDataURL(file);
}

function matchProductsToSkinTone(tone) {
  // Simple logic to match colors to skin tones
  // Deep/Vibrant colors for Fair
  // Warm/Earthy for Medium
  // Bright/Contrast for Deep
  let filtered = [...products];

  if (tone === 'Fair') {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes('red') ||
      p.name.toLowerCase().includes('emerald') ||
      p.name.toLowerCase().includes('silk') ||
      p.category === 'imitation'
    );
  } else if (tone === 'Medium') {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes('gold') ||
      p.name.toLowerCase().includes('jewel') ||
      p.name.toLowerCase().includes('kundan')
    );
  } else { // Deep
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes('yellow') ||
      p.name.toLowerCase().includes('white') ||
      p.name.toLowerCase().includes('pearl') ||
      p.name.toLowerCase().includes('essence')
    );
  }

  // If filter is too strict, just shuffle
  if (filtered.length < 3) filtered = [...products];

  return filtered.sort(() => 0.5 - Math.random()).slice(0, 3);
}

window.resetStylist = () => {
  const zone = document.getElementById('uploadZone');
  const previewCont = document.getElementById('userPreviewCont');
  const results = document.getElementById('aiResults');
  const loader = document.getElementById('aiAnalysis');
  const input = document.getElementById('userImageInput');
  if (zone) zone.style.display = 'block';
  if (previewCont) previewCont.style.display = 'none';
  if (results) results.style.display = 'none';
  if (loader) loader.style.display = 'none';
  if (input) input.value = '';
}

function renderRecommendations(selected, tone = "") {
  const recContainer = document.getElementById('stylistRecommendations');
  if (!recContainer) return;

  const titleEl = document.querySelector('.results-title');
  if (titleEl && tone) {
    titleEl.innerHTML = `AI Recommendations: Handpicked for your <span style="color:var(--gold)">${tone}</span> Skin Tone`;
  }

  recContainer.innerHTML = selected.map(p => `
    <div class="product-card stylist-recommendation-card" onclick="openProductDetail(${p.id})">
      <div class="product-img">
        <img src="${p.image || p.img}" class="img-main" style="width:100%; height:100%; object-fit:cover;">
        <img src="${p.imageHover || p.imgHover || p.image || p.img}" class="img-hover" style="width:100%; height:100%; object-fit:cover;">
      </div>
      <div style="padding: 15px; text-align: center;">
        <div style="color:var(--gold-dark); font-weight:700; font-size: 14px; margin-bottom: 5px;">₹${(extractPriceFromDesc(p.description) || p.price || 0).toLocaleString('en-IN')}</div>
        <div style="font-size:9px; color:var(--gold); text-transform: uppercase; letter-spacing:1px; margin-bottom: 5px;">${p.category}</div>
        <h3 class="product-name" style="font-family:'Playfair Display',serif; font-size:15px; color:var(--dark); margin:0 auto 5px; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h3>
        <div style="font-size: 10px; margin-top: 10px; color: var(--muted); font-style: italic;">Perfect for you</div>
      </div>
    </div>`).join('');
}

// Handle Category from URL
const urlParams = new URLSearchParams(window.location.search);
const urlCat = urlParams.get('category');
if (urlCat) {
  currentCategory = urlCat;
  // Update Tab UI if on collections page
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.cat === currentCategory);
  });
}

// Handle Product ID from URL
const urlId = urlParams.get('id');
if (urlId && products.length > 0) {
  // We need to wait for products to be loaded if they are from cloud
  // But products array is usually populated by renderAll() or localStorage
  setTimeout(() => {
    initProductPage(urlId);
  }, 100);
}

function initProductPage(productId) {
  const p = products.find(prod => prod.id == productId);
  if (!p) return;

  // Populate Elements (similar to old openProductDetail logic but for static page)
  const mainImg = document.getElementById('detailMainImg');
  const name = document.getElementById('detailName');
  const price = document.getElementById('detailPrice');
  const desc = document.getElementById('descBody');
  const care = document.getElementById('careBody');
  const stock = document.getElementById('detailStockStatus');
  const btn = document.getElementById('detailAddToCartBtn');
  const buyBtn = document.getElementById('detailBuyNowBtn');
  const thumbs = document.getElementById('detailThumbnails');
  const qtyVal = document.getElementById('detailQtyVal');
  const qtyMinus = document.getElementById('detailQtyMinus');
  const qtyPlus = document.getElementById('detailQtyPlus');
  const breadCat = document.getElementById('breadcrumb-cat');
  const breadName = document.getElementById('breadcrumb-name');

  if (!name) return; // Not on product page

  let currentQty = 1;
  if (qtyVal) qtyVal.innerText = currentQty;
  if (qtyMinus) qtyMinus.onclick = () => { if (currentQty > 1) { currentQty--; qtyVal.innerText = currentQty; } };
  if (qtyPlus) qtyPlus.onclick = () => { currentQty++; qtyVal.innerText = currentQty; };

  if (mainImg) mainImg.src = p.image || p.img;
  if (name) name.innerText = p.name;
  if (breadName) breadName.innerText = p.name;
  if (breadCat) {
    breadCat.innerText = p.category;
    breadCat.href = `collections.html?category=${p.category}`;
  }
  if (price) price.innerText = `₹${(extractPriceFromDesc(p.description) || p.price || 0).toLocaleString('en-IN')}`;

  if (desc) {
    const descText = p.description || "Exquisite premium collection from ROKEA by RK.";
    const descLines = descText.split('\n').filter(line => line.trim().length > 0);
    desc.innerHTML = `<div style="display: flex; flex-direction: column; gap: 15px;">` + descLines.map(line => `
      <div style="background: rgba(255,255,255,0.7); border-left: 3px solid var(--gold); padding: 15px 20px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.7; color: var(--text); box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: transform 0.3s; cursor: default;" onmouseover="this.style.transform='translateX(3px)';" onmouseout="this.style.transform='translateX(0)';">
        ${line.replace(/^[✦•\-\*]\s*/, '').trim()}
      </div>
    `).join('') + `</div>`;
  }
  
  if (care) {
    const careText = p.productCare || "Handle with care to maintain the longevity of this premium piece.";
    const items = careText.split('\n').filter(line => line.trim().length > 0);
    
    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 15px; margin-top: 10px;">`;
    
    items.forEach(item => {
      const text = item.replace(/^[✦•\-\*]\s*/, '').trim();
      if (text === "CARE & SAFETY") return;
      
      let title = "Care Tip";
      let descText = text;
      
      if(text.includes(':')) {
         const parts = text.split(':');
         title = parts[0].trim();
         descText = parts.slice(1).join(':').trim();
      }
      
      let iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
      if(title.toLowerCase().includes('clean')) iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`;
      if(title.toLowerCase().includes('water') || title.toLowerCase().includes('moisture')) iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
      if(title.toLowerCase().includes('stor')) iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
      if(title.toLowerCase().includes('perfume') || title.toLowerCase().includes('chemical')) iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><path d="M10 2v4M14 2v4M6 10v10a2 2 0 002 2h8a2 2 0 002-2V10a2 2 0 00-2-2H8a2 2 0 00-2 2z"/></svg>`;
      if(title.toLowerCase().includes('handl')) iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`;
      if(title.toLowerCase().includes('longevity') || title.toLowerCase().includes('tip')) iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      
      html += `
        <div style="background: rgba(255,255,255,0.7); border: 1px solid rgba(201,168,76,0.15); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 10px; transition: transform 0.3s, box-shadow 0.3s; cursor: default;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 5px 15px rgba(201,168,76,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 2px;">
            <div style="background: rgba(201,168,76,0.1); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: inset 0 0 10px rgba(201,168,76,0.05);">
               ${iconSvg}
            </div>
            <div style="font-family: 'Playfair Display', serif; font-weight: 600; font-size: 15px; color: var(--dark); letter-spacing: 0.3px;">${title}</div>
          </div>
          <div style="font-size: 13px; line-height: 1.6; color: var(--text);">${descText}</div>
        </div>
      `;
    });
    
    html += `</div>`;
    care.innerHTML = html;
  }

  if (stock) {
    const isOut = p.stock === 'Out of Stock';
    stock.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: ${isOut ? '#D93025' : '#4CAF50'};"></span> Availability: ${isOut ? 'Sold Out' : 'In Stock'}`;
  }

  if (p.stock === 'Out of Stock') {
    if (btn) { btn.innerText = 'Sold Out'; btn.disabled = true; }
    if (buyBtn) { buyBtn.disabled = true; }
  } else {
    if (btn) {
      btn.onclick = () => {
        for (let i = 0; i < currentQty; i++) cart.push(p);
        localStorage.setItem('saforio_cart', JSON.stringify(cart));
        updateCartIcon();
        toggleCart();
      };
    }
    if (buyBtn) {
      buyBtn.onclick = () => {
        for (let i = 0; i < currentQty; i++) cart.push(p);
        localStorage.setItem('saforio_cart', JSON.stringify(cart));
        updateCartIcon();
        openCheckout();
      };
    }
  }

  // Thumbs
  const images = [p.image || p.img, p.imageHover || p.imgHover || p.image || p.img];
  if (p.extraImages) images.push(...p.extraImages);
  currentDetailImages = [...new Set(images)];
  currentDetailIndex = 0;

  if (thumbs) {
    thumbs.innerHTML = currentDetailImages.map((img, i) => `
      <img src="${img}" class="thumb-item ${i === 0 ? 'active' : ''}" onclick="switchDetailImage(${i})">
    `).join('');
  }

  // Swipe Logic
  const visualCont = document.getElementById('mainVisualCont');
  if (visualCont) {
    visualCont.addEventListener('touchstart', e => {
      touchstartX = e.changedTouches[0].screenX;
    }, { passive: true });

    visualCont.addEventListener('touchend', e => {
      touchendX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  }

  renderRelatedProducts(p.category, p.id);
}

window.switchDetailImage = (index) => {
  currentDetailIndex = index;
  const mainImg = document.getElementById('detailMainImg');
  if (mainImg) {
    mainImg.style.opacity = '0';
    setTimeout(() => {
      mainImg.src = currentDetailImages[currentDetailIndex];
      mainImg.style.opacity = '1';
    }, 200);
  }
  
  // Update thumbs
  document.querySelectorAll('.thumb-item').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });
}

function handleSwipe() {
  if (touchendX < touchstartX - 50) {
    // Swipe Left -> Next Image
    if (currentDetailIndex < currentDetailImages.length - 1) {
      switchDetailImage(currentDetailIndex + 1);
    } else {
      switchDetailImage(0);
    }
  }
  if (touchendX > touchstartX + 50) {
    // Swipe Right -> Prev Image
    if (currentDetailIndex > 0) {
      switchDetailImage(currentDetailIndex - 1);
    } else {
      switchDetailImage(currentDetailImages.length - 1);
    }
  }
}

// Initial Render
renderAll();
updateCartIcon();
updateWishlistIcon();
updateUserUI();

// =============================================
// SPLASH SCREEN LOGIC
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const splashScreen = document.getElementById('splashScreen');
  const splashLogo = document.getElementById('splashLogo');
  const navLogoImg = document.getElementById('navLogoImg');
  
  if (splashScreen && splashLogo && navLogoImg) {
    if (document.getElementById('home')) {
      navLogoImg.style.opacity = '0';
      navLogoImg.style.transition = 'opacity 0.5s ease'; 
      
      // Strictly prevent scrolling before and during animation
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      
      let splashDone = false;
      
      const preventScroll = (e) => {
        if (!splashDone) e.preventDefault();
      };
      
      window.addEventListener('wheel', preventScroll, { passive: false });
      window.addEventListener('touchmove', preventScroll, { passive: false });
      
      const handleSplash = (e) => {
        if (splashDone) return;
        
        if (e.type === 'wheel' && e.deltaY <= 0) return;
        
        splashDone = true;
        
        // Hide scroll indicator immediately
        const scrollInd = splashScreen.querySelector('.splash-scroll-indicator');
        if (scrollInd) scrollInd.style.opacity = '0';
        
        const navRect = navLogoImg.getBoundingClientRect();
        const logoRect = splashLogo.getBoundingClientRect();
        
        const xTranslate = navRect.left + (navRect.width/2) - (logoRect.left + logoRect.width/2);
        const yTranslate = navRect.top + (navRect.height/2) - (logoRect.top + logoRect.height/2);
        const scale = navRect.width / logoRect.width;
        
        splashLogo.style.transform = `translate(${xTranslate}px, ${yTranslate}px) scale(${Math.max(scale, 0.2)})`;
        
        // Wait for the logo to reach the destination
        setTimeout(() => {
          splashLogo.style.opacity = '0';
          navLogoImg.style.transition = 'opacity 0.5s ease';
          navLogoImg.style.opacity = '1';
          splashScreen.classList.add('scrolled');
          
          // Restore scrolling only after the splash background is gone
          setTimeout(() => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            window.removeEventListener('wheel', preventScroll);
            window.removeEventListener('touchmove', preventScroll);
          }, 800);
        }, 950);
        
        window.removeEventListener('wheel', handleSplash);
        window.removeEventListener('touchmove', handleSplash);
        window.removeEventListener('touchstart', handleSplash);
      };
      
      window.addEventListener('wheel', handleSplash, { passive: false });
      window.addEventListener('touchmove', handleSplash, { passive: false });
      window.addEventListener('touchstart', handleSplash, { passive: false });
    } else {
      splashScreen.style.display = 'none';
      navLogoImg.style.opacity = '1';
    }
  }
});
