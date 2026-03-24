/* ============================================================
   DOOMINIKS STORE — script.js
   ============================================================ */

// ============================================================
// OWNER CONFIG — GANTI EMAIL INI DENGAN EMAIL OWNER
// ============================================================
const OWNER_EMAIL = "owner@doominiks.com";
// ============================================================

let fb, currentUser, currentUserData;
let activePage = 'home';
let selectedPaymentMethod = 'bank';
let selectedTopupMethod = 'bank';
let selectedTopupCoinMethod = 'bank';
let currentProductForBuy = null;
let appliedDiscount = null;
let currentRating = 0;
let ownerChatSelectedUid = null;
let topupType = null;
let topupAmountVal = 0;
let topupCoinsVal = 0;
let payCountdownInterval = null;
let topupCountdownInterval = null;
let selectedBadgeVal = '';

// ===== LOADING SCREEN =====
window.addEventListener('load', () => {
  const bar = document.getElementById('loadingBar');
  const text = document.getElementById('loadingText');
  const msgs = ['Initializing systems...', 'Loading Firebase...', 'Connecting database...', 'Almost ready...'];
  let pct = 0, idx = 0;
  const tick = setInterval(() => {
    pct = Math.min(pct + Math.random() * 18, 100);
    bar.style.width = pct + '%';
    if (Math.floor(pct / 25) > idx && idx < msgs.length - 1) {
      idx++;
      text.textContent = msgs[idx];
    }
    if (pct >= 100) {
      clearInterval(tick);
      text.textContent = 'Welcome to DOOMINIKS STORE!';
      setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('app').style.display = 'block';
        initFirebase();
        spawnParticles();
      }, 600);
    }
  }, 120);
});

function initFirebase() {
  // Wait for Firebase module to load
  const wait = setInterval(() => {
    if (window._firebase) {
      clearInterval(wait);
      fb = window._firebase;
      fb.onAuthStateChanged(fb.auth, async (user) => {
        if (user) {
          currentUser = user;
          await loadUserData(user.uid);
          updateNavUser();
          loadDiscordLink();
        } else {
          currentUser = null;
          currentUserData = null;
          updateNavGuest();
          loadDiscordLink();
        }
        loadHomeStats();
        loadFeaturedProducts();
        loadHomeReviews();
      });
    }
  }, 200);
}

// ===== PARTICLES =====
function spawnParticles() {
  const container = document.getElementById('heroParticles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'hero-particle';
    const x = Math.random() * 100;
    const dur = 6 + Math.random() * 10;
    const delay = Math.random() * 10;
    const dx = (Math.random() - 0.5) * 200;
    p.style.cssText = `left:${x}%;animation-duration:${dur}s;animation-delay:${delay}s;--dx:${dx}px;width:${Math.random()*3+1}px;height:${Math.random()*3+1}px;`;
    container.appendChild(p);
  }
}

// ===== NAV =====
function updateNavUser() {
  document.getElementById('navGuest').style.display = 'none';
  document.getElementById('navUser').style.display = 'flex';
  document.getElementById('navUsername').textContent = currentUserData?.username || 'User';
  document.getElementById('navCoinBal').textContent = currentUserData?.coins || 0;
  const av = currentUserData?.avatarUrl || '';
  document.getElementById('navAvatar').src = av || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23222" width="40" height="40"/><text fill="%23e11d1d" font-size="20" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">👤</text></svg>';
}

function updateNavGuest() {
  document.getElementById('navGuest').style.display = 'flex';
  document.getElementById('navUser').style.display = 'none';
}

function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open');
}

// ===== PAGES =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (!pg) return;
  pg.classList.add('active');
  activePage = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'products') loadAllProducts();
  if (name === 'reviews') loadAllReviews();
  if (name === 'profile') loadProfile();
  if (name === 'orders') loadMyOrders();
  if (name === 'chat') { if (!currentUser) { showModal('loginModal'); return; } loadCustomerChat(); }
  if (name === 'owner') {
    if (!isOwner()) { showToast('Access denied', 'error'); showPage('home'); return; }
    loadOwnerDashboard();
  }
  document.getElementById('mobileNav').classList.remove('open');
}

function isOwner() { return currentUser && currentUser.email === OWNER_EMAIL; }

// ===== MODALS =====
function showModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ===== TOAST =====
let toastTimeout;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== AUTH =====
async function registerUser() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const err = document.getElementById('regError');
  if (!username || !email || !password) { err.textContent = 'Please fill all fields'; return; }
  if (password.length < 6) { err.textContent = 'Password must be at least 6 characters'; return; }
  try {
    const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, password);
    const uid = cred.user.uid;
    await fb.setDoc(fb.doc(fb.db, 'users', uid), {
      username, email, balance: 0, coins: 0,
      badges: [], avatarUrl: '',
      createdAt: fb.serverTimestamp(), role: 'customer'
    });
    closeModal('registerModal');
    showToast('Account created! Welcome ' + username, 'success');
  } catch (e) { err.textContent = e.message; }
}

async function loginUser() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  if (!email || !password) { err.textContent = 'Please fill all fields'; return; }
  try {
    await fb.signInWithEmailAndPassword(fb.auth, email, password);
    closeModal('loginModal');
    showToast('Welcome back!', 'success');
    if (isOwner()) {
      document.querySelector('.nav-links').innerHTML += '<a onclick="showPage(\'owner\')" class="nav-link" style="color:var(--red)"><i class="fas fa-crown"></i> Owner</a>';
    }
  } catch (e) { err.textContent = 'Invalid email or password'; }
}

async function logoutUser() {
  await fb.signOut(fb.auth);
  showPage('home');
  showToast('Logged out', 'info');
}

async function loadUserData(uid) {
  const snap = await fb.getDoc(fb.doc(fb.db, 'users', uid));
  if (snap.exists()) currentUserData = { id: uid, ...snap.data() };
}

// ===== DISCORD =====
async function loadDiscordLink() {
  try {
    const snap = await fb.getDoc(fb.doc(fb.db, 'settings', 'site'));
    const link = snap.exists() ? (snap.data().discordLink || '#') : '#';
    ['discordNavLink', 'discordMobileLink', 'heroDiscordBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = link;
    });
  } catch (e) {}
}

// ===== HOME STATS =====
async function loadHomeStats() {
  try {
    const [prods, ords, revs] = await Promise.all([
      fb.getDocs(fb.collection(fb.db, 'products')),
      fb.getDocs(fb.collection(fb.db, 'orders')),
      fb.getDocs(fb.collection(fb.db, 'reviews'))
    ]);
    animateCount('statProducts', prods.size);
    animateCount('statOrders', ords.size);
    animateCount('statReviews', revs.size);
  } catch (e) {}
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let c = 0;
  const step = Math.ceil(target / 30);
  const iv = setInterval(() => {
    c = Math.min(c + step, target);
    el.textContent = c;
    if (c >= target) clearInterval(iv);
  }, 40);
}

// ===== PRODUCTS =====
let allProductsData = [];

async function loadFeaturedProducts() {
  const snap = await fb.getDocs(fb.query(fb.collection(fb.db, 'products'), fb.orderBy('createdAt', 'desc')));
  allProductsData = snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 6);
  renderProducts(allProductsData, 'featuredProducts');
}

async function loadAllProducts() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'products'), fb.orderBy('createdAt', 'desc')), snap => {
    allProductsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts(allProductsData, 'allProducts');
  });
}

function renderProducts(products, containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (!products.length) { c.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No products yet</p></div>'; return; }
  c.innerHTML = products.map(p => {
    const stockClass = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : '';
    const stockTxt = p.stock === 0 ? 'Out of Stock' : p.stock + ' left';
    const img = p.imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 180"><rect fill="%23181818" width="260" height="180"/><text fill="%23333" font-size="40" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">📦</text></svg>';
    return `<div class="product-card" onclick="openProductModal('${p.id}')">
      ${p.stock === 0 ? '<div class="product-badge">OUT</div>' : ''}
      <img class="product-card-img" src="${img}" alt="${p.name}" loading="lazy"/>
      <div class="product-card-body">
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-desc">${p.description || ''}</div>
        <div class="product-card-footer">
          <div class="product-price">Rp ${formatNum(p.price)}</div>
          <div class="product-stock ${stockClass}">${stockTxt}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterProducts() {
  const q = document.getElementById('searchProduct').value.toLowerCase();
  const filtered = allProductsData.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  renderProducts(filtered, 'allProducts');
}

async function openProductModal(pid) {
  const snap = await fb.getDoc(fb.doc(fb.db, 'products', pid));
  if (!snap.exists()) return;
  const p = { id: snap.id, ...snap.data() };
  currentProductForBuy = p;
  appliedDiscount = null;
  document.getElementById('discountMsg').textContent = '';
  document.getElementById('discountCode').value = '';

  document.getElementById('pdTitle').textContent = p.name;
  document.getElementById('pdDesc').textContent = p.description || '';
  document.getElementById('pdPrice').textContent = 'Rp ' + formatNum(p.price);
  document.getElementById('pdCoinPrice').textContent = p.coinPrice + ' Coins';
  document.getElementById('pdStock').textContent = p.stock;
  document.getElementById('pdCategory').textContent = p.category || '-';
  document.getElementById('pdImage').src = p.imageUrl || '';

  loadProductReviews(pid);
  showModal('productModal');
}

async function loadProductReviews(pid) {
  const c = document.getElementById('productReviews');
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'reviews'), fb.where('productId', '==', pid), fb.orderBy('createdAt', 'desc')), snap => {
    if (snap.empty) { c.innerHTML = '<p class="text-muted" style="font-size:13px">No reviews yet.</p>'; return; }
    c.innerHTML = snap.docs.map(d => {
      const r = d.data();
      return `<div class="review-card" style="min-width:unset;margin-bottom:10px">
        <div class="review-header">
          <div><div class="review-name">${r.username}</div><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div></div>
        </div>
        <div class="review-text">${r.text}</div>
      </div>`;
    }).join('');
  });
}

// ===== DISCOUNT =====
async function applyDiscount() {
  if (!currentProductForBuy) return;
  const code = document.getElementById('discountCode').value.trim().toUpperCase();
  if (!code) return;
  const snap = await fb.getDocs(fb.query(fb.collection(fb.db, 'discounts'), fb.where('code', '==', code)));
  if (snap.empty) { document.getElementById('discountMsg').textContent = '❌ Invalid code'; document.getElementById('discountMsg').style.color = '#e74c3c'; return; }
  const d = snap.docs[0].data();
  if (d.used >= d.maxUses) { document.getElementById('discountMsg').textContent = '❌ Code expired'; document.getElementById('discountMsg').style.color = '#e74c3c'; return; }
  appliedDiscount = { id: snap.docs[0].id, ...d };
  const save = Math.floor(currentProductForBuy.price * d.percent / 100);
  document.getElementById('discountMsg').textContent = `✅ ${d.percent}% off — Save Rp ${formatNum(save)}`;
  document.getElementById('discountMsg').style.color = 'var(--green)';
}

// ===== BUY PRODUCT =====
function buyProduct(method) {
  if (!currentUser) { closeModal('productModal'); showModal('loginModal'); return; }
  if (!currentProductForBuy) return;
  const p = currentProductForBuy;
  if (p.stock <= 0) { showToast('Out of stock!', 'error'); return; }

  if (method === 'coin') {
    const coinPrice = p.coinPrice;
    if ((currentUserData?.coins || 0) < coinPrice) { showToast('Not enough coins!', 'error'); return; }
    confirmCoinPurchase(p, coinPrice);
    return;
  }

  // IDR payment
  let price = p.price;
  if (appliedDiscount) price = price - Math.floor(price * appliedDiscount.percent / 100);

  closeModal('productModal');
  openPaymentModal(p, price);
}

function openPaymentModal(product, price) {
  document.getElementById('paymentSummary').innerHTML = `
    <div class="pi-row"><span>Product</span><strong>${product.name}</strong></div>
    <div class="pi-row"><span>Amount</span><strong>Rp ${formatNum(price)}</strong></div>
    ${appliedDiscount ? `<div class="pi-row"><span>Discount</span><strong style="color:var(--green)">-${appliedDiscount.percent}%</strong></div>` : ''}
  `;
  document.getElementById('payStep1').style.display = 'block';
  document.getElementById('payStep2').style.display = 'none';
  document.getElementById('payStep3').style.display = 'none';
  ['pstep1','pstep2','pstep3'].forEach(s => document.getElementById(s).classList.remove('active'));
  document.getElementById('pstep1').classList.add('active');
  currentProductForBuy._finalPrice = price;
  showModal('paymentModal');
}

function selectMethod(method, btn, ctx) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (ctx === 'topup') selectedTopupMethod = method;
  else if (ctx === 'coin') selectedTopupCoinMethod = method;
  else selectedPaymentMethod = method;
}

async function goPayStep2() {
  document.getElementById('payStep1').style.display = 'none';
  document.getElementById('payStep2').style.display = 'block';
  document.getElementById('pstep1').classList.remove('active');
  document.getElementById('pstep2').classList.add('active');
  await showPaymentInfo('paymentInfoBox', selectedPaymentMethod, currentProductForBuy._finalPrice);
  startCountdown('payCountdown', 15 * 60);
}

function goPayStep3() {
  document.getElementById('payStep2').style.display = 'none';
  document.getElementById('payStep3').style.display = 'block';
  document.getElementById('pstep2').classList.remove('active');
  document.getElementById('pstep3').classList.add('active');
}

async function submitPayment() {
  if (!currentUser || !currentProductForBuy) return;
  const file = document.getElementById('proofUpload').files[0];
  const err = document.getElementById('payError');
  if (!file) { err.textContent = 'Please upload payment proof'; return; }
  try {
    const storageRef = fb.ref(fb.storage, `proofs/${currentUser.uid}_${Date.now()}`);
    await fb.uploadBytes(storageRef, file);
    const proofUrl = await fb.getDownloadURL(storageRef);

    const p = currentProductForBuy;
    const orderId = 'ORD-' + Date.now();
    await fb.setDoc(fb.doc(fb.db, 'orders', orderId), {
      userId: currentUser.uid, username: currentUserData.username,
      productId: p.id, productName: p.name,
      amount: p._finalPrice, paymentMethod: selectedPaymentMethod,
      discountCode: appliedDiscount?.code || null,
      proofUrl, status: 'pending',
      createdAt: fb.serverTimestamp()
    });

    // Decrement stock
    await fb.updateDoc(fb.doc(fb.db, 'products', p.id), { stock: fb.increment(-1) });

    // Increment discount usage
    if (appliedDiscount) {
      await fb.updateDoc(fb.doc(fb.db, 'discounts', appliedDiscount.id), { used: fb.increment(1) });
    }

    clearInterval(payCountdownInterval);
    closeModal('paymentModal');
    showToast('Payment submitted! Waiting for confirmation.', 'success');
    showPage('orders');
  } catch (e) { err.textContent = e.message; }
}

async function confirmCoinPurchase(product, coinPrice) {
  if (!currentUser) return;
  try {
    const orderId = 'ORD-' + Date.now();
    await fb.setDoc(fb.doc(fb.db, 'orders', orderId), {
      userId: currentUser.uid, username: currentUserData.username,
      productId: product.id, productName: product.name,
      amount: coinPrice, paymentMethod: 'coins',
      proofUrl: null, status: 'processing',
      createdAt: fb.serverTimestamp()
    });
    await fb.updateDoc(fb.doc(fb.db, 'users', currentUser.uid), { coins: fb.increment(-coinPrice) });
    await fb.updateDoc(fb.doc(fb.db, 'products', product.id), { stock: fb.increment(-1) });
    currentUserData.coins -= coinPrice;
    updateNavUser();
    closeModal('productModal');
    showToast('Purchase successful! Paid with coins.', 'success');
    showPage('orders');
  } catch (e) { showToast(e.message, 'error'); }
}

// ===== PAYMENT INFO BOX =====
async function showPaymentInfo(containerId, method, amount) {
  const snap = await fb.getDoc(fb.doc(fb.db, 'settings', 'site'));
  const s = snap.exists() ? snap.data() : {};
  const c = document.getElementById(containerId);
  if (method === 'bank') {
    c.innerHTML = `
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Transfer to:</p>
      <div class="pi-row"><span>Bank</span><strong>${s.bankName || '—'}</strong></div>
      <div class="pi-row"><span>Account No.</span><strong>${s.bankNumber || '—'}</strong></div>
      <div class="pi-row"><span>Name</span><strong>${s.bankOwner || '—'}</strong></div>
      <div class="pi-row" style="border:none"><span>Amount</span><strong style="color:var(--red);font-size:18px">Rp ${formatNum(amount)}</strong></div>
    `;
  } else {
    c.innerHTML = `
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Send to E-Wallet:</p>
      <div class="pi-row"><span>Provider</span><strong>${s.ewalletName || '—'}</strong></div>
      <div class="pi-row"><span>Number</span><strong>${s.ewalletNumber || '—'}</strong></div>
      <div class="pi-row"><span>Name</span><strong>${s.ewalletOwner || '—'}</strong></div>
      <div class="pi-row" style="border:none"><span>Amount</span><strong style="color:var(--red);font-size:18px">Rp ${formatNum(amount)}</strong></div>
    `;
  }
}

function startCountdown(elId, seconds) {
  const el = document.getElementById(elId);
  if (!el) return;
  clearInterval(payCountdownInterval);
  let t = seconds;
  const iv = setInterval(() => {
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    el.textContent = m + ':' + s;
    if (--t < 0) { clearInterval(iv); el.textContent = 'EXPIRED'; }
  }, 1000);
  payCountdownInterval = iv;
}

// ===== TOPUP BALANCE =====
async function initiateTopup(type) {
  topupType = type;
  if (type === 'balance') {
    topupAmountVal = parseInt(document.getElementById('topupAmount').value) || 0;
    if (topupAmountVal < 5000) { showToast('Minimum top up Rp 5.000', 'error'); return; }
    closeModal('topupModal');
    await showPaymentInfo('topupPayInfo', selectedTopupMethod, topupAmountVal);
    startTopupCountdown();
    showModal('topupPayModal');
  } else {
    const pkg = document.getElementById('selectedCoinPkg').value;
    if (!pkg) { showToast('Please select a coin package', 'error'); return; }
    const [idr, coins] = pkg.split('|');
    topupAmountVal = parseInt(idr);
    topupCoinsVal = parseInt(coins);
    closeModal('topupCoinModal');
    await showPaymentInfo('topupPayInfo', selectedTopupCoinMethod, topupAmountVal);
    startTopupCountdown();
    showModal('topupPayModal');
  }
}

function selectCoinPkg(idr, coins, el) {
  document.querySelectorAll('.coin-pkg').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('selectedCoinPkg').value = idr + '|' + coins;
}

function startTopupCountdown() {
  clearInterval(topupCountdownInterval);
  let t = 900;
  topupCountdownInterval = setInterval(() => {
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    const el = document.getElementById('topupCountdown');
    if (el) el.textContent = m + ':' + s;
    if (--t < 0) { clearInterval(topupCountdownInterval); if (el) el.textContent = 'EXPIRED'; }
  }, 1000);
}

async function submitTopupProof() {
  if (!currentUser) return;
  const file = document.getElementById('topupProof').files[0];
  const err = document.getElementById('topupError');
  if (!file) { err.textContent = 'Please upload payment proof'; return; }
  try {
    const storageRef = fb.ref(fb.storage, `topup_proofs/${currentUser.uid}_${Date.now()}`);
    await fb.uploadBytes(storageRef, file);
    const proofUrl = await fb.getDownloadURL(storageRef);

    await fb.addDoc(fb.collection(fb.db, 'topupRequests'), {
      userId: currentUser.uid, username: currentUserData.username,
      type: topupType, amount: topupAmountVal, coins: topupCoinsVal,
      proofUrl, status: 'pending',
      createdAt: fb.serverTimestamp()
    });

    clearInterval(topupCountdownInterval);
    closeModal('topupPayModal');
    showToast('Top up submitted! Waiting for verification.', 'success');
  } catch (e) { err.textContent = e.message; }
}

// ===== PROFILE =====
async function loadProfile() {
  if (!currentUser) { showModal('loginModal'); return; }
  await loadUserData(currentUser.uid);
  const u = currentUserData;
  document.getElementById('profileUsername').textContent = u.username;
  document.getElementById('profileEmail').textContent = u.email;
  document.getElementById('profileBalance').textContent = formatNum(u.balance || 0);
  document.getElementById('profileCoins').textContent = u.coins || 0;
  const av = u.avatarUrl || '';
  document.getElementById('profileAvatar').src = av || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><rect fill="%23222" width="90" height="90"/><text fill="%23e11d1d" font-size="48" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">👤</text></svg>';
  renderBadges(u.badges || [], 'profileBadges', u.email === OWNER_EMAIL);
}

function renderBadges(badges, containerId, isOwnerUser) {
  const c = document.getElementById(containerId);
  if (!c) return;
  let html = '';
  if (isOwnerUser) html += '<span class="badge-pill badge-owner">👑 Owner</span>';
  const map = { warrior:'⚔️ Warrior', elite:'🛡️ Elite', master:'🏆 Master', grandmaster:'👑 Grandmaster', mythical:'🌟 Mythical' };
  (badges || []).forEach(b => { if (map[b]) html += `<span class="badge-pill badge-${b}">${map[b]}</span>`; });
  c.innerHTML = html;
}

// ===== ORDERS (Customer) =====
async function loadMyOrders() {
  if (!currentUser) { showModal('loginModal'); return; }
  const c = document.getElementById('ordersListUser');
  fb.onSnapshot(
    fb.query(fb.collection(fb.db, 'orders'), fb.where('userId', '==', currentUser.uid), fb.orderBy('createdAt', 'desc')),
    snap => {
      if (snap.empty) { c.innerHTML = '<div class="empty-state"><i class="fas fa-box"></i><p>No orders yet</p></div>'; return; }
      c.innerHTML = snap.docs.map(d => renderOrderCard(d.id, d.data(), false)).join('');
    }
  );
}

function renderOrderCard(id, o, isOwner) {
  const date = o.createdAt?.toDate?.()?.toLocaleDateString('id-ID') || '—';
  const canReview = o.status === 'completed' && !isOwner;
  const ownerActions = isOwner ? `
    <button class="btn-outline-red" style="font-size:12px" onclick="updateOrderStatus('${id}','processing')">Processing</button>
    <button class="btn-outline-red" style="font-size:12px" onclick="updateOrderStatus('${id}','shipped')">Shipped</button>
    <button class="btn-red" style="font-size:12px" onclick="updateOrderStatus('${id}','completed')">Complete</button>
    <button class="btn-outline-red" style="font-size:12px;color:#e74c3c;border-color:#e74c3c" onclick="updateOrderStatus('${id}','cancelled')">Cancel</button>
    ${o.proofUrl ? `<a href="${o.proofUrl}" target="_blank"><img src="${o.proofUrl}" class="proof-img"/></a>` : ''}
  ` : (canReview ? `<button class="btn-outline-red" style="font-size:12px" onclick="openReviewModal('${id}','${o.productId}')"><i class="fas fa-star"></i> Review</button>` : '');

  return `<div class="order-card">
    <div class="order-header">
      <div class="order-id">${id}</div>
      <div class="order-status status-${o.status}">${o.status.toUpperCase().replace('_',' ')}</div>
    </div>
    <div class="order-product">${o.productName}</div>
    <div class="order-meta">
      <span>Rp ${formatNum(o.amount)}</span>
      <span>${o.paymentMethod}</span>
      <span>${o.username || ''}</span>
      <span>${date}</span>
    </div>
    ${ownerActions ? `<div class="order-actions">${ownerActions}</div>` : ''}
  </div>`;
}

// ===== REVIEW =====
function openReviewModal(orderId, productId) {
  document.getElementById('reviewOrderId').value = orderId;
  document.getElementById('reviewProductId').value = productId;
  currentRating = 0;
  document.querySelectorAll('.star-rating .star').forEach(s => s.classList.remove('active'));
  document.getElementById('reviewText').value = '';
  showModal('reviewModal');
}

function setRating(n) {
  currentRating = n;
  document.querySelectorAll('.star-rating .star').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
}

async function submitReview() {
  if (!currentUser || currentRating === 0) { showToast('Please select a rating', 'error'); return; }
  const text = document.getElementById('reviewText').value.trim();
  const productId = document.getElementById('reviewProductId').value;
  if (!text) { showToast('Please write a review', 'error'); return; }
  try {
    await fb.addDoc(fb.collection(fb.db, 'reviews'), {
      userId: currentUser.uid, username: currentUserData.username,
      productId, rating: currentRating, text,
      createdAt: fb.serverTimestamp()
    });
    await fb.updateDoc(fb.doc(fb.db, 'orders', document.getElementById('reviewOrderId').value), { reviewed: true });
    closeModal('reviewModal');
    showToast('Review submitted! Thank you.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

// ===== REVIEWS (Public) =====
async function loadHomeReviews() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'reviews'), fb.orderBy('createdAt', 'desc')), snap => {
    const c = document.getElementById('homeReviews');
    if (!c) return;
    if (snap.empty) { c.innerHTML = '<p class="text-muted">No reviews yet.</p>'; return; }
    c.innerHTML = snap.docs.slice(0, 8).map(d => {
      const r = d.data();
      return `<div class="review-card">
        <div class="review-header">
          <div><div class="review-name">${r.username}</div><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div></div>
        </div>
        <div class="review-text">${r.text}</div>
      </div>`;
    }).join('');
  });
}

async function loadAllReviews() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'reviews'), fb.orderBy('createdAt', 'desc')), snap => {
    const c = document.getElementById('allReviews');
    if (!c) return;
    if (snap.empty) { c.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><p>No reviews yet</p></div>'; return; }
    c.innerHTML = snap.docs.map(d => {
      const r = d.data();
      return `<div class="review-card">
        <div class="review-header">
          <div><div class="review-name">${r.username}</div><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div></div>
        </div>
        <div class="review-text">${r.text}</div>
        <div class="review-product">📦 Product ID: ${r.productId}</div>
      </div>`;
    }).join('');
  });
}

// ===== CHAT (Customer) =====
function loadCustomerChat() {
  if (!currentUser) return;
  const uid = currentUser.uid;
  const c = document.getElementById('chatMessages');
  fb.onSnapshot(
    fb.query(fb.collection(fb.db, 'chats', uid, 'messages'), fb.orderBy('createdAt', 'asc')),
    snap => {
      c.innerHTML = snap.docs.map(d => {
        const m = d.data();
        const mine = m.sender === uid;
        return `<div class="chat-msg ${mine ? 'mine' : 'theirs'}">
          <div class="chat-msg-sender">${mine ? 'You' : 'Support'}</div>
          <div>${m.text}</div>
          <div class="chat-msg-time">${m.createdAt?.toDate?.()?.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'}) || ''}</div>
        </div>`;
      }).join('');
      c.scrollTop = c.scrollHeight;
    }
  );
}

async function sendChat() {
  if (!currentUser) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await fb.addDoc(fb.collection(fb.db, 'chats', currentUser.uid, 'messages'), {
    text, sender: currentUser.uid, senderName: currentUserData.username,
    createdAt: fb.serverTimestamp()
  });
  // Update chat meta for owner to see
  await fb.setDoc(fb.doc(fb.db, 'chatMeta', currentUser.uid), {
    username: currentUserData.username,
    lastMessage: text, lastAt: fb.serverTimestamp()
  }, { merge: true });
}

// ===== OWNER PANEL =====
function ownerTab(name) {
  document.querySelectorAll('.otab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.owner-panel-content').forEach(p => p.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('otab-' + name).classList.add('active');
  if (name === 'manageProducts') loadOwnerProducts();
  if (name === 'manageOrders') loadOwnerOrders();
  if (name === 'manageTransactions') loadOwnerTransactions();
  if (name === 'manageUsers') loadOwnerUsers();
  if (name === 'manageChats') loadOwnerChatList();
  if (name === 'manageReviews') loadOwnerReviews();
  if (name === 'manageDiscount') loadOwnerDiscounts();
  if (name === 'manageSettings') loadOwnerSettings();
}

async function loadOwnerDashboard() {
  if (!isOwner()) return;
  const [orders, users, prods] = await Promise.all([
    fb.getDocs(fb.collection(fb.db, 'orders')),
    fb.getDocs(fb.collection(fb.db, 'users')),
    fb.getDocs(fb.collection(fb.db, 'products'))
  ]);
  document.getElementById('ds-orders').textContent = orders.size;
  document.getElementById('ds-users').textContent = users.size;
  document.getElementById('ds-products').textContent = prods.size;
  let rev = 0;
  orders.forEach(d => { if (d.data().status === 'completed') rev += d.data().amount || 0; });
  document.getElementById('ds-revenue').textContent = 'Rp ' + formatNum(rev);

  const c = document.getElementById('recentOrdersList');
  const recent = orders.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0)).slice(0, 5);
  c.innerHTML = recent.map(d => renderOrderCard(d.id, d.data(), true)).join('') || '<p class="text-muted">No orders</p>';
}

function loadOwnerProducts() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'products'), fb.orderBy('createdAt', 'desc')), snap => {
    const c = document.getElementById('ownerProductsList');
    if (snap.empty) { c.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No products</p></div>'; return; }
    c.innerHTML = `<table class="data-table"><thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Coins</th><th>Stock</th><th>Actions</th></tr></thead><tbody>` +
      snap.docs.map(d => {
        const p = d.data();
        return `<tr>
          <td><img src="${p.imageUrl || ''}" style="width:48px;height:36px;object-fit:cover;border-radius:6px;background:var(--bg4)"/></td>
          <td>${p.name}</td>
          <td>Rp ${formatNum(p.price)}</td>
          <td>${p.coinPrice}</td>
          <td>${p.stock}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-outline-red" style="font-size:12px" onclick="openEditProduct('${d.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-outline-red" style="font-size:12px;color:#e74c3c;border-color:#e74c3c" onclick="deleteProduct('${d.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('') + '</tbody></table>';
  });
}

async function addProduct() {
  const name = document.getElementById('pName').value.trim();
  const desc = document.getElementById('pDesc').value.trim();
  const price = parseInt(document.getElementById('pPrice').value) || 0;
  const coinPrice = parseInt(document.getElementById('pCoinPrice').value) || 0;
  const stock = parseInt(document.getElementById('pStock').value) || 0;
  const category = document.getElementById('pCategory').value.trim();
  const file = document.getElementById('pImage').files[0];
  if (!name || !price) { document.getElementById('addProductError').textContent = 'Name and price required'; return; }
  try {
    let imageUrl = '';
    if (file) {
      const storageRef = fb.ref(fb.storage, `products/${Date.now()}_${file.name}`);
      await fb.uploadBytes(storageRef, file);
      imageUrl = await fb.getDownloadURL(storageRef);
    }
    await fb.addDoc(fb.collection(fb.db, 'products'), { name, description: desc, price, coinPrice, stock, category, imageUrl, createdAt: fb.serverTimestamp() });
    closeModal('addProductModal');
    showToast('Product added!', 'success');
    ['pName','pDesc','pPrice','pCoinPrice','pStock','pCategory'].forEach(id => document.getElementById(id).value = '');
  } catch (e) { document.getElementById('addProductError').textContent = e.message; }
}

async function openEditProduct(pid) {
  const snap = await fb.getDoc(fb.doc(fb.db, 'products', pid));
  if (!snap.exists()) return;
  const p = snap.data();
  document.getElementById('editPid').value = pid;
  document.getElementById('editPName').value = p.name;
  document.getElementById('editPDesc').value = p.description || '';
  document.getElementById('editPPrice').value = p.price;
  document.getElementById('editPCoinPrice').value = p.coinPrice;
  document.getElementById('editPStock').value = p.stock;
  document.getElementById('editPCategory').value = p.category || '';
  showModal('editProductModal');
}

async function saveEditProduct() {
  const pid = document.getElementById('editPid').value;
  const file = document.getElementById('editPImage').files[0];
  const data = {
    name: document.getElementById('editPName').value.trim(),
    description: document.getElementById('editPDesc').value.trim(),
    price: parseInt(document.getElementById('editPPrice').value) || 0,
    coinPrice: parseInt(document.getElementById('editPCoinPrice').value) || 0,
    stock: parseInt(document.getElementById('editPStock').value) || 0,
    category: document.getElementById('editPCategory').value.trim()
  };
  if (file) {
    const storageRef = fb.ref(fb.storage, `products/${Date.now()}_${file.name}`);
    await fb.uploadBytes(storageRef, file);
    data.imageUrl = await fb.getDownloadURL(storageRef);
  }
  await fb.updateDoc(fb.doc(fb.db, 'products', pid), data);
  closeModal('editProductModal');
  showToast('Product updated!', 'success');
}

async function deleteProduct(pid) {
  if (!confirm('Delete this product?')) return;
  await fb.deleteDoc(fb.doc(fb.db, 'products', pid));
  showToast('Product deleted', 'info');
}

function loadOwnerOrders() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'orders'), fb.orderBy('createdAt', 'desc')), snap => {
    const c = document.getElementById('ownerOrdersList');
    if (snap.empty) { c.innerHTML = '<div class="empty-state"><i class="fas fa-box"></i><p>No orders</p></div>'; return; }
    c.innerHTML = snap.docs.map(d => renderOrderCard(d.id, d.data(), true)).join('');
  });
}

async function updateOrderStatus(orderId, status) {
  await fb.updateDoc(fb.doc(fb.db, 'orders', orderId), { status });
  showToast('Order status updated to ' + status, 'success');
  // Log transaction if completed
  if (status === 'completed') {
    const snap = await fb.getDoc(fb.doc(fb.db, 'orders', orderId));
    const o = snap.data();
    await fb.addDoc(fb.collection(fb.db, 'transactions'), {
      orderId, userId: o.userId, username: o.username,
      productName: o.productName, amount: o.amount,
      type: 'sale', createdAt: fb.serverTimestamp()
    });
  }
}

function loadOwnerTransactions() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'transactions'), fb.orderBy('createdAt', 'desc')), snap => {
    const c = document.getElementById('ownerTransactionsList');
    if (snap.empty) { c.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No transactions</p></div>'; return; }
    c.innerHTML = `<table class="data-table"><thead><tr><th>User</th><th>Product</th><th>Amount</th><th>Type</th><th>Date</th></tr></thead><tbody>` +
      snap.docs.map(d => {
        const t = d.data();
        const date = t.createdAt?.toDate?.()?.toLocaleDateString('id-ID') || '—';
        return `<tr><td>${t.username}</td><td>${t.productName || '-'}</td><td>Rp ${formatNum(t.amount)}</td><td>${t.type}</td><td>${date}</td></tr>`;
      }).join('') + '</tbody></table>';
  });
}

function loadOwnerUsers() {
  fb.onSnapshot(fb.collection(fb.db, 'users'), snap => {
    const c = document.getElementById('ownerUsersList');
    c.innerHTML = `<table class="data-table"><thead><tr><th>Username</th><th>Email</th><th>Balance</th><th>Coins</th><th>Badges</th><th>Actions</th></tr></thead><tbody>` +
      snap.docs.map(d => {
        const u = d.data();
        const badges = (u.badges || []).map(b => `<span class="badge-pill badge-${b}" style="font-size:10px">${b}</span>`).join('');
        return `<tr>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>Rp ${formatNum(u.balance || 0)}</td>
          <td>${u.coins || 0}</td>
          <td>${badges}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn-outline-red" style="font-size:11px" onclick="openGiveBadge('${d.id}')"><i class="fas fa-award"></i> Badge</button>
            <button class="btn-outline-red" style="font-size:11px" onclick="approveTopup('${d.id}')"><i class="fas fa-check-circle"></i> Topup</button>
          </td>
        </tr>`;
      }).join('') + '</tbody></table>';
    loadTopupRequests();
  });
}

async function loadTopupRequests() {
  const snap = await fb.getDocs(fb.query(fb.collection(fb.db, 'topupRequests'), fb.where('status', '==', 'pending')));
  if (snap.empty) return;
  const c = document.getElementById('ownerUsersList');
  let html = '<h3 style="margin:20px 0 10px;color:var(--red);font-family:var(--font-head);letter-spacing:2px">PENDING TOP UPS</h3>';
  html += snap.docs.map(d => {
    const t = d.data();
    return `<div class="order-card">
      <div class="order-header"><div class="order-id">${d.id}</div><div class="order-status status-pending">PENDING</div></div>
      <div class="order-product">${t.username} — ${t.type === 'balance' ? 'Rp ' + formatNum(t.amount) : t.coins + ' Coins (Rp ' + formatNum(t.amount) + ')'}</div>
      <div class="order-meta"><span>${t.type}</span></div>
      <div class="order-actions">
        ${t.proofUrl ? `<a href="${t.proofUrl}" target="_blank"><img src="${t.proofUrl}" class="proof-img"/></a>` : ''}
        <button class="btn-red" style="font-size:12px" onclick="approveTopupRequest('${d.id}')">Approve</button>
        <button class="btn-outline-red" style="font-size:12px;color:#e74c3c;border-color:#e74c3c" onclick="rejectTopupRequest('${d.id}')">Reject</button>
      </div>
    </div>`;
  }).join('');
  c.innerHTML += html;
}

async function approveTopupRequest(rid) {
  const snap = await fb.getDoc(fb.doc(fb.db, 'topupRequests', rid));
  if (!snap.exists()) return;
  const t = snap.data();
  const updates = t.type === 'balance' ? { balance: fb.increment(t.amount) } : { coins: fb.increment(t.coins) };
  await fb.updateDoc(fb.doc(fb.db, 'users', t.userId), updates);
  await fb.updateDoc(fb.doc(fb.db, 'topupRequests', rid), { status: 'approved' });
  await fb.addDoc(fb.collection(fb.db, 'transactions'), {
    userId: t.userId, username: t.username,
    amount: t.amount, type: 'topup_' + t.type,
    createdAt: fb.serverTimestamp()
  });
  showToast('Top up approved!', 'success');
}

async function rejectTopupRequest(rid) {
  await fb.updateDoc(fb.doc(fb.db, 'topupRequests', rid), { status: 'rejected' });
  showToast('Top up rejected', 'info');
}

// ===== BADGES =====
function openGiveBadge(uid) {
  document.getElementById('badgeTargetUid').value = uid;
  document.getElementById('selectedBadge').value = '';
  document.querySelectorAll('.badge-opt').forEach(b => b.classList.remove('selected'));
  selectedBadgeVal = '';
  showModal('giveBadgeModal');
}

function selectBadge(badge, el) {
  document.querySelectorAll('.badge-opt').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  selectedBadgeVal = badge;
  document.getElementById('selectedBadge').value = badge;
}

async function giveBadge() {
  const uid = document.getElementById('badgeTargetUid').value;
  const badge = document.getElementById('selectedBadge').value;
  if (!uid || !badge) { showToast('Select a badge', 'error'); return; }
  const snap = await fb.getDoc(fb.doc(fb.db, 'users', uid));
  if (!snap.exists()) return;
  const current = snap.data().badges || [];
  if (!current.includes(badge)) current.push(badge);
  await fb.updateDoc(fb.doc(fb.db, 'users', uid), { badges: current });
  closeModal('giveBadgeModal');
  showToast('Badge given!', 'success');
}

// ===== OWNER CHAT =====
function loadOwnerChatList() {
  fb.onSnapshot(fb.collection(fb.db, 'chatMeta'), snap => {
    const c = document.getElementById('ownerChatUserList');
    c.innerHTML = snap.docs.map(d => {
      const m = d.data();
      return `<div class="chat-user-item ${ownerChatSelectedUid === d.id ? 'active' : ''}" onclick="selectOwnerChatUser('${d.id}','${m.username}')">
        <i class="fas fa-user"></i> ${m.username}
      </div>`;
    }).join('') || '<p class="text-muted" style="padding:12px;font-size:12px">No chats</p>';
  });
}

let ownerChatUnsub = null;
function selectOwnerChatUser(uid, username) {
  ownerChatSelectedUid = uid;
  if (ownerChatUnsub) ownerChatUnsub();
  const c = document.getElementById('ownerChatMessages');
  ownerChatUnsub = fb.onSnapshot(
    fb.query(fb.collection(fb.db, 'chats', uid, 'messages'), fb.orderBy('createdAt', 'asc')),
    snap => {
      c.innerHTML = snap.docs.map(d => {
        const m = d.data();
        const isSupport = m.sender === 'owner';
        return `<div class="chat-msg ${isSupport ? 'mine' : 'theirs'}">
          <div class="chat-msg-sender">${isSupport ? 'Support' : m.senderName || username}</div>
          <div>${m.text}</div>
          <div class="chat-msg-time">${m.createdAt?.toDate?.()?.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'}) || ''}</div>
        </div>`;
      }).join('');
      c.scrollTop = c.scrollHeight;
    }
  );
  document.querySelectorAll('.chat-user-item').forEach(el => el.classList.remove('active'));
  event?.currentTarget?.classList.add('active');
}

async function ownerSendChat() {
  if (!ownerChatSelectedUid) { showToast('Select a user first', 'error'); return; }
  const input = document.getElementById('ownerChatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await fb.addDoc(fb.collection(fb.db, 'chats', ownerChatSelectedUid, 'messages'), {
    text, sender: 'owner', senderName: 'Support',
    createdAt: fb.serverTimestamp()
  });
  await fb.updateDoc(fb.doc(fb.db, 'chatMeta', ownerChatSelectedUid), {
    lastMessage: text, lastAt: fb.serverTimestamp()
  });
}

// ===== OWNER REVIEWS =====
function loadOwnerReviews() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'reviews'), fb.orderBy('createdAt', 'desc')), snap => {
    const c = document.getElementById('ownerReviewsList');
    if (snap.empty) { c.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><p>No reviews</p></div>'; return; }
    c.innerHTML = snap.docs.map(d => {
      const r = d.data();
      const date = r.createdAt?.toDate?.()?.toLocaleDateString('id-ID') || '—';
      return `<div class="order-card">
        <div class="order-header">
          <div class="order-id">${r.username} — ${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
          <button class="btn-outline-red" style="font-size:12px;color:#e74c3c;border-color:#e74c3c" onclick="deleteReview('${d.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <div class="order-product">${r.text}</div>
        <div class="order-meta"><span>${date}</span><span>Product: ${r.productId}</span></div>
      </div>`;
    }).join('');
  });
}

async function deleteReview(rid) {
  if (!confirm('Delete this review?')) return;
  await fb.deleteDoc(fb.doc(fb.db, 'reviews', rid));
  showToast('Review deleted', 'info');
}

// ===== OWNER DISCOUNTS =====
async function addDiscount() {
  const code = document.getElementById('dcCode').value.trim().toUpperCase();
  const percent = parseInt(document.getElementById('dcPercent').value) || 0;
  const maxUses = parseInt(document.getElementById('dcMaxUses').value) || 100;
  if (!code || !percent) { showToast('Fill all fields', 'error'); return; }
  await fb.addDoc(fb.collection(fb.db, 'discounts'), { code, percent, maxUses, used: 0, createdAt: fb.serverTimestamp() });
  closeModal('addDiscountModal');
  showToast('Discount added!', 'success');
}

function loadOwnerDiscounts() {
  fb.onSnapshot(fb.query(fb.collection(fb.db, 'discounts'), fb.orderBy('createdAt', 'desc')), snap => {
    const c = document.getElementById('ownerDiscountList');
    if (snap.empty) { c.innerHTML = '<div class="empty-state"><i class="fas fa-tag"></i><p>No discounts</p></div>'; return; }
    c.innerHTML = `<table class="data-table"><thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Max</th><th>Actions</th></tr></thead><tbody>` +
      snap.docs.map(d => {
        const dc = d.data();
        return `<tr>
          <td><strong>${dc.code}</strong></td>
          <td>${dc.percent}%</td>
          <td>${dc.used}</td>
          <td>${dc.maxUses}</td>
          <td><button class="btn-outline-red" style="font-size:12px;color:#e74c3c;border-color:#e74c3c" onclick="deleteDiscount('${d.id}')"><i class="fas fa-trash"></i></button></td>
        </tr>`;
      }).join('') + '</tbody></table>';
  });
}

async function deleteDiscount(did) {
  if (!confirm('Delete discount?')) return;
  await fb.deleteDoc(fb.doc(fb.db, 'discounts', did));
  showToast('Discount deleted', 'info');
}

// ===== OWNER SETTINGS =====
async function loadOwnerSettings() {
  const snap = await fb.getDoc(fb.doc(fb.db, 'settings', 'site'));
  if (!snap.exists()) return;
  const s = snap.data();
  document.getElementById('discordLinkInput').value = s.discordLink || '';
  document.getElementById('bankNameInput').value = s.bankName || '';
  document.getElementById('bankNumberInput').value = s.bankNumber || '';
  document.getElementById('bankOwnerName').value = s.bankOwner || '';
  document.getElementById('ewalletNameInput').value = s.ewalletName || '';
  document.getElementById('ewalletNumberInput').value = s.ewalletNumber || '';
  document.getElementById('ewalletOwnerName').value = s.ewalletOwner || '';
  if (currentUserData) document.getElementById('ownerUsernameInput').value = currentUserData.username || '';
}

async function saveDiscordLink() {
  const link = document.getElementById('discordLinkInput').value.trim();
  await fb.setDoc(fb.doc(fb.db, 'settings', 'site'), { discordLink: link }, { merge: true });
  loadDiscordLink();
  showToast('Discord link saved!', 'success');
}

async function saveBankSettings() {
  await fb.setDoc(fb.doc(fb.db, 'settings', 'site'), {
    bankName: document.getElementById('bankNameInput').value.trim(),
    bankNumber: document.getElementById('bankNumberInput').value.trim(),
    bankOwner: document.getElementById('bankOwnerName').value.trim()
  }, { merge: true });
  showToast('Bank settings saved!', 'success');
}

async function saveEwalletSettings() {
  await fb.setDoc(fb.doc(fb.db, 'settings', 'site'), {
    ewalletName: document.getElementById('ewalletNameInput').value.trim(),
    ewalletNumber: document.getElementById('ewalletNumberInput').value.trim(),
    ewalletOwner: document.getElementById('ewalletOwnerName').value.trim()
  }, { merge: true });
  showToast('E-Wallet settings saved!', 'success');
}

async function saveOwnerAccount() {
  if (!currentUser) return;
  const username = document.getElementById('ownerUsernameInput').value.trim();
  const password = document.getElementById('ownerPasswordInput').value;
  if (username) {
    await fb.updateDoc(fb.doc(fb.db, 'users', currentUser.uid), { username });
    if (currentUserData) currentUserData.username = username;
    updateNavUser();
  }
  if (password) {
    try {
      await fb.updatePassword(currentUser, password);
      document.getElementById('ownerPasswordInput').value = '';
      showToast('Password updated!', 'success');
    } catch (e) { showToast(e.message, 'error'); return; }
  }
  showToast('Account updated!', 'success');
}

// ===== HELPERS =====
function formatNum(n) {
  return (n || 0).toLocaleString('id-ID');
}

// ===== NAVBAR OWNER LINK (dynamically added after login) =====
fb = null;
const waitOwner = setInterval(() => {
  if (!window._firebase) return;
  clearInterval(waitOwner);
  window._firebase.onAuthStateChanged(window._firebase.auth, u => {
    if (u && u.email === OWNER_EMAIL) {
      // Add owner nav if not there
      const ownerNavExists = document.querySelector('[data-owner-nav]');
      if (!ownerNavExists) {
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
          const a = document.createElement('a');
          a.setAttribute('data-owner-nav', '1');
          a.className = 'nav-link';
          a.style.color = 'var(--red)';
          a.innerHTML = '<i class="fas fa-crown"></i> Owner';
          a.onclick = () => showPage('owner');
          navLinks.appendChild(a);
        }
      }
    }
  });
}, 300);
