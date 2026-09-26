// ============================================================
//  app.js — Konfigurasi & utilitas bersama (public + admin)
//  Dimuat PERTAMA di setiap halaman, sebelum firebase-*.js
// ============================================================

// ---------- 1. KONFIGURASI FIREBASE (REALTIME DATABASE) ----------
const firebaseConfig = {
    apiKey: "AIzaSyB9D9e0-_wUEkzuwfek-0gpfOEqFSbJssE",
    authDomain: "sedekah-003.firebaseapp.com",
    projectId: "sedekah-003",
    databaseURL: "https://sedekah-003-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "sedekah-003.firebasestorage.app",
    messagingSenderId: "761180083609",
    appId: "1:761180083609:web:99d8ef58d157ba34692f08",
    measurementId: "G-NY2MSH0C6P"
};

// Override databaseURL untuk pengembangan lokal tanpa mengubah kode:
//   1) jalankan `firebase emulators:start` lalu buka http://localhost:4444/donasi.html?dev=1
//   2) atau set manual via console: localStorage.setItem('SB_DB_URL', '<url>')
const _dbOverride = new URLSearchParams(location.search).get('db') || localStorage.getItem('SB_DB_URL');
if (_dbOverride) firebaseConfig.databaseURL = _dbOverride;
else if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    if (location.search.includes('dev=1')) {
        firebaseConfig.databaseURL = 'http://localhost:9000/?ns=sedekah-003';
    } else {
        console.warn('[SedekahBerkah] Mode lokal terdeteksi. RTDB asli memakai CORS http/https — ' +
            'gunakan emulator dengan menambahkan ?dev=1 pada URL, atau atur localStorage SB_DB_URL.');
    }
}

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- 2. FORMAT ANGKA ----------
function rupiah(n) {
    return 'Rp\u00A0' + new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0));
}
function angkaRupiah(n) {
    return new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0));
}
function tanggalSingkat(ts) {
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function waktuLengkap(ts) {
    return new Date(ts).toLocaleString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}
function waktuRelatif(ts) {
    const d = Date.now() - ts, m = Math.floor(d / 60000);
    if (m < 1) return 'Baru saja';
    if (m < 60) return m + ' menit yang lalu';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' jam yang lalu';
    const hari = Math.floor(h / 24);
    if (hari < 30) return hari + ' hari yang lalu';
    return tanggalSingkat(ts);
}

// ---------- 3. METADATA METODE PEMBAYARAN (SIMULASI PAYMENT GATEWAY) ----------
const PAY_METHODS = {
    qris:      { nama: 'QRIS',                       kategori: 'QR Code',   vaPrefix: '88808', bank: 'Bank Central Asia' },
    bca:       { nama: 'Transfer BCA',               kategori: 'Virtual Account', vaPrefix: '88801', bank: 'BCA' },
    bsi:       { nama: 'Transfer BSI',               kategori: 'Virtual Account', vaPrefix: '88802', bank: 'BSI' },
    mandiri:   { nama: 'Transfer Mandiri',           kategori: 'Virtual Account', vaPrefix: '88803', bank: 'Bank Mandiri' },
    bri:       { nama: 'Transfer BRI',               kategori: 'Virtual Account', vaPrefix: '88804', bank: 'BRI' },
    gopay:     { nama: 'GoPay',                      kategori: 'E-Wallet',  vaPrefix: '88811', bank: 'GoPay' },
    ovo:       { nama: 'OVO',                        kategori: 'E-Wallet',  vaPrefix: '88812', bank: 'OVO' },
    dana:      { nama: 'DANA',                       kategori: 'E-Wallet',  vaPrefix: '88813', bank: 'DANA' },
    shopeepay: { nama: 'ShopeePay',                  kategori: 'E-Wallet',  vaPrefix: '88814', bank: 'ShopeePay' },
};

// Nomor VA unik deterministik: prefix metode + 10 digit dari ID transaksi
function nomorVA(methodKey, transactionId) {
    const meta = PAY_METHODS[methodKey] || PAY_METHODS.bca;
    let digits = String(transactionId).replace(/\D/g, '').slice(-10).padStart(10, '0');
    return meta.vaPrefix + digits;
}

// QRIS statis default yayasan (bisa diganti lewat form Pengaturan admin).
const DEFAULT_QRIS_IMAGE =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" fill="#ffffff"/>
  <g fill="#0f172a">
    <rect x="16" y="16" width="56" height="56"/><rect x="28" y="28" width="32" height="32" fill="#fff"/><rect x="36" y="36" width="16" height="16"/>
    <rect x="168" y="16" width="56" height="56"/><rect x="180" y="28" width="32" height="32" fill="#fff"/><rect x="188" y="36" width="16" height="16"/>
    <rect x="16" y="168" width="56" height="56"/><rect x="28" y="180" width="32" height="32" fill="#fff"/><rect x="36" y="188" width="16" height="16"/>
    <rect x="88" y="16" width="8" height="8"/><rect x="104" y="16" width="8" height="8"/><rect x="120" y="24" width="8" height="8"/><rect x="136" y="16" width="8" height="8"/>
    <rect x="88" y="32" width="8" height="8"/><rect x="112" y="40" width="8" height="8"/><rect x="128" y="32" width="8" height="8"/><rect x="144" y="40" width="8" height="8"/>
    <rect x="96" y="56" width="8" height="8"/><rect x="120" y="56" width="8" height="8"/><rect x="136" y="64" width="8" height="8"/>
    <rect x="16" y="88" width="8" height="8"/><rect x="32" y="96" width="8" height="8"/><rect x="48" y="88" width="8" height="8"/><rect x="64" y="96" width="8" height="8"/>
    <rect x="88" y="88" width="16" height="16"/><rect x="112" y="88" width="8" height="8"/><rect x="128" y="96" width="16" height="16"/><rect x="152" y="88" width="8" height="8"/>
    <rect x="176" y="88" width="8" height="8"/><rect x="192" y="96" width="8" height="8"/><rect x="208" y="88" width="8" height="8"/><rect x="216" y="104" width="8" height="8"/>
    <rect x="16" y="112" width="8" height="8"/><rect x="40" y="120" width="8" height="8"/><rect x="56" y="112" width="8" height="8"/><rect x="72" y="128" width="8" height="8"/>
    <rect x="96" y="120" width="8" height="8"/><rect x="120" y="128" width="8" height="8"/><rect x="144" y="120" width="8" height="8"/><rect x="168" y="128" width="8" height="8"/>
    <rect x="184" y="112" width="8" height="8"/><rect x="200" y="120" width="8" height="8"/><rect x="216" y="128" width="8" height="8"/>
    <rect x="16" y="144" width="8" height="8"/><rect x="32" y="152" width="8" height="8"/><rect x="56" y="144" width="8" height="8"/><rect x="72" y="152" width="8" height="8"/>
    <rect x="96" y="152" width="8" height="8"/><rect x="112" y="144" width="8" height="8"/><rect x="136" y="152" width="8" height="8"/><rect x="152" y="144" width="8" height="8"/>
    <rect x="176" y="152" width="8" height="8"/><rect x="200" y="144" width="8" height="8"/><rect x="216" y="152" width="8" height="8"/>
    <rect x="88" y="168" width="8" height="8"/><rect x="104" y="176" width="8" height="8"/><rect x="120" y="168" width="16" height="16"/><rect x="144" y="176" width="8" height="8"/>
    <rect x="168" y="168" width="8" height="8"/><rect x="192" y="176" width="8" height="8"/><rect x="208" y="168" width="8" height="8"/>
    <rect x="88" y="192" width="8" height="8"/><rect x="112" y="200" width="8" height="8"/><rect x="136" y="192" width="8" height="8"/><rect x="160" y="208" width="8" height="8"/>
    <rect x="176" y="192" width="16" height="16"/><rect x="208" y="200" width="8" height="8"/>
    <rect x="96" y="216" width="8" height="8"/><rect x="120" y="216" width="8" height="8"/><rect x="144" y="224" width="8" height="8"/><rect x="192" y="216" width="8" height="8"/>
  </g>
  <text x="120" y="136" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#059669">QRIS</text>
</svg>`);

// ---------- 4. STATUS DONASI ----------
const STATUS_LABEL = {
    menunggu:  { teks: 'Menunggu Pembayaran', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    verifikasi:{ teks: 'Menunggu Verifikasi',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    success:   { teks: 'Terkonfirmasi',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    gagal:     { teks: 'Gagal / Kadaluarsa',   cls: 'bg-red-100 text-red-600 border-red-200' },
};

// ---------- 5. TOAST NOTIFICATION ----------
function ensureToastContainer() {
    let c = document.getElementById('toastContainer');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toastContainer';
        c.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none';
        document.body.appendChild(c);
    }
    return c;
}
function showToast(message, type = 'success') {
    const colors = {
        success: 'bg-emerald-600', error: 'bg-red-500', info: 'bg-gray-800', warn: 'bg-amber-500'
    };
    const icons = {
        success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warn: 'fa-triangle-exclamation'
    };
    const t = document.createElement('div');
    t.className = `toast-in pointer-events-auto ${colors[type] || colors.info} text-white text-sm font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2 max-w-[90vw]`;
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    ensureToastContainer().appendChild(t);
    setTimeout(() => { t.style.transition = 'all .4s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, 3200);
    setTimeout(() => t.remove(), 3700);
}

// ---------- 6. GENERATOR KODE TRANSAKSI ----------
function generateInvoiceCode() {
    const d = new Date();
    const ymd = d.getFullYear().toString() +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `DB-${ymd}-${rand}`;
}
