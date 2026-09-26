// ============================================================
//  main.js — Halaman Beranda (data realtime dari Firebase)
// ============================================================

// ---------- Helper ----------
function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
function sisaHari(deadline) {
    if (!deadline) return '—';
    const d = Math.ceil((deadline - Date.now()) / 86400000);
    return d > 0 ? d + ' Hari Lagi' : 'Sudah Berakhir';
}

// ---------- Render Grid Program (id="programGrid") ----------
function renderPrograms(data) {
    const container = document.getElementById('programGrid');
    if (!container) return;
    container.innerHTML = '';

    const programs = Object.entries(data || {});
    if (!programs.length) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-400">
                <i class="fa-solid fa-database text-4xl mb-3 text-gray-300"></i>
                <p>Belum ada program donasi. Hubungi admin untuk menambah program baru.</p>
            </div>`;
        return;
    }

    // urutkan terbaru dulu
    programs.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    programs.forEach(([key, p]) => {
        const persen = p.target > 0 ? Math.min(100, (p.terkumpul || 0) / p.target * 100) : 0;
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col group';
        card.innerHTML = `
            <div class="relative h-48 overflow-hidden bg-gray-200">
                <img src="${escapeHtml(p.gambar || '')}" onerror="this.src='https://images.unsplash.com/photo-1542810634-71277d95dcbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'" alt="${escapeHtml(p.nama)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">${escapeHtml(p.kategori || 'Umum')}</span>
                <span class="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow"><i class="fa-regular fa-clock text-emerald-500 mr-1"></i>${sisaHari(p.deadline)}</span>
            </div>
            <div class="p-6 flex flex-col flex-1">
                <h3 class="text-lg font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">${escapeHtml(p.nama)}</h3>
                <p class="text-gray-500 text-sm mb-4 line-clamp-2 flex-1">${escapeHtml((p.deskripsi || '').replace(/<[^>]*>/g, ' ').trim() || 'Bantu wujudkan program kebaikan ini.')}</p>
                <div class="mb-4">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="font-bold text-emerald-600">${rupiah(p.terkumpul)}</span>
                        <span class="text-gray-400 text-xs">Target ${rupiah(p.target)}</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                        <div class="bg-emerald-500 h-2 rounded-full transition-all duration-700" style="width:${persen}%"></div>
                    </div>
                </div>
                <div class="flex gap-3">
                    <a href="campaign.html?id=${encodeURIComponent(key)}" class="flex-1 text-center border border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-medium py-2.5 rounded-lg transition-colors text-sm">Selengkapnya</a>
                    <a href="donasi.html?program=${encodeURIComponent(key)}" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-center font-medium py-2.5 rounded-lg transition-colors shadow-md shadow-emerald-500/20 text-sm">Donasi</a>
                </div>
            </div>`;
        container.appendChild(card);
    });
}

// ---------- Render Aktivitas Donasi (realtime) ----------
function renderAktivitas(map) {
    const wrap = document.getElementById('listDonasiTerbaru');
    if (!wrap) return;
    const arr = Object.values(map || {})
        .filter(t => t.status === 'success')
        .sort((a, b) => (b.paidAt || b.timestamp || 0) - (a.paidAt || a.timestamp || 0))
        .slice(0, 12);

    if (!arr.length) {
        wrap.innerHTML = `<li class="px-6 py-4 text-sm text-gray-400 italic">Belum ada donasi terkonfirmasi. Jadilah yang pertama!</li>`;
        return;
    }
    wrap.innerHTML = arr.map(t => `
        <li class="px-6 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
            <div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <i class="fa-solid fa-hand-holding-heart text-emerald-600"></i>
            </div>
            <div class="min-w-0">
                <p class="text-gray-800 font-medium text-sm truncate"><span class="font-bold">${t.anonim ? 'Hamba Allah' : escapeHtml(t.donatur || 'Donatur')}</span> mendonasikan <span class="text-emerald-600 font-bold">${rupiah(t.nominal)}</span></p>
                <p class="text-gray-500 text-xs mt-1 truncate">untuk <a href="campaign.html?id=${encodeURIComponent(t.programId)}" class="underline decoration-emerald-300 hover:text-emerald-600">${escapeHtml(t.programNama || 'program')}</a> • ${waktuRelatif(t.paidAt || t.timestamp)}</p>
            </div>
        </li>`).join('');
}

// ---------- Render Timeline Transparansi ----------
function renderTransparansi(map) {
    const wrap = document.getElementById('timelinePenyaluran');
    if (!wrap) return;
    const arr = Object.entries(map || {}).sort((a, b) => ((b[1].tanggal || b[1].createdAt) || 0) - ((a[1].tanggal || a[1].createdAt) || 0)).slice(0, 6);

    if (!arr.length) {
        wrap.innerHTML = `<p class="text-gray-400 text-sm italic col-span-full">Belum ada laporan penyaluran.</p>`;
        return;
    }
    wrap.innerHTML = arr.map(([key, u]) => `
        <article class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
            <div class="h-48 bg-gray-200 relative">
                <img src="${escapeHtml(u.gambar || 'https://images.unsplash.com/photo-1593113642977-4305be476ff3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')}" onerror="this.src='https://images.unsplash.com/photo-1593113642977-4305be476ff3?w=800'" alt="${escapeHtml(u.judul)}" class="w-full h-full object-cover">
                <div class="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">${tanggalSingkat(u.tanggal || u.createdAt)}</div>
            </div>
            <div class="p-6">
                <h4 class="font-bold text-gray-800 mb-2">${escapeHtml(u.judul)}</h4>
                <p class="text-gray-500 text-sm line-clamp-3 leading-relaxed">${escapeHtml(u.cerita || '')}</p>
                <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs">
                    <span class="text-gray-400"><i class="fa-solid fa-location-dot text-red-400 mr-1"></i>${escapeHtml(u.lokasi || '-')}</span>
                    <a href="campaign.html?id=${encodeURIComponent(u.programId || '')}" class="text-emerald-600 font-bold hover:text-emerald-700 hover:underline">Lihat Program →</a>
                </div>
            </div>
        </article>`).join('');
}

// ---------- Statistik hero realtime ----------
function updateStatistik(programs, donasiMap) {
    const totalTerkumpul = Object.values(programs || {}).reduce((a, p) => a + (p.terkumpul || 0), 0);
    const jmlProgram = Object.keys(programs || {}).length;
    const jmlDonatur = Object.values(donasiMap || {}).filter(t => t.status === 'success').length;
    const setStat = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = val; };
    setStat('statTerkumpul', angkaRupiah(totalTerkumpul));
    setStat('statProgram', jmlProgram);
    setStat('statDonatur', jmlDonatur);
    setStat('statProgramStrip', jmlProgram);
    setStat('statDonaturStrip', jmlDonatur);
}

// ---------- Chart Transparansi realtime (donasi per kategori program) ----------
let pieChartInst = null, barChartInst = null;
function renderCharts(programs, donasiMap) {
    const byCat = {};
    Object.values(donasiMap || {}).forEach(t => {
        if (t.status !== 'success') return;
        const p = (programs || {})[t.programId];
        const cat = (p && p.kategori) || t.programKategori || 'Lainnya';
        byCat[cat] = (byCat[cat] || 0) + (t.nominal || 0);
    });
    const labels = Object.keys(byCat), data = Object.values(byCat);
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

    const pieEl = document.getElementById('pieChart');
    if (pieEl && window.Chart) {
        if (pieChartInst) pieChartInst.destroy();
        pieChartInst = new Chart(pieEl, {
            type: 'doughnut',
            data: { labels: labels.length ? labels : ['Belum ada data'], datasets: [{ data: data.length ? data : [1], backgroundColor: data.length ? colors.slice(0, labels.length) : ['#e5e7eb'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Bar 6 bulan terakhir
    const months = [], sums = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toLocaleDateString('id-ID', { month: 'short' }));
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
        const start = d.getTime();
        sums.push(Object.values(donasiMap || {}).filter(t => t.status === 'success' && (t.paidAt || t.timestamp || 0) >= start && (t.paidAt || t.timestamp || 0) < end)
            .reduce((a, t) => a + (t.nominal || 0), 0) / 1e6);
    }
    const barEl = document.getElementById('barChart');
    if (barEl && window.Chart) {
        if (barChartInst) barChartInst.destroy();
        barChartInst = new Chart(barEl, {
            type: 'bar',
            data: { labels: months, datasets: [{ label: 'Juta Rp', data: sums, backgroundColor: '#10b981', borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
        });
    }
}

// ---------- Ringkasan keuangan realtime (Total Pemasukan / Penyaluran / Saldo) ----------
function renderRingkasanKeuangan(donasiMap, programs) {
    const pemasukan = Object.values(programs || {}).reduce((a, p) => a + (p.terkumpul || 0), 0);
    const setNum = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = rupiah(val); };
    setNum('finPemasukan', pemasukan);
    setNum('finPenyaluran', window.__totalPenyaluran || 0);
    setNum('finSaldo', Math.max(0, pemasukan - (window.__totalPenyaluran || 0)));
}

// ---------- Seed data awal (sekali saja, saat DB masih kosong) ----------
const SEED_PROGRAMS = {
    "pendidikan-01": { nama: "Beasiswa Tahfidz Quran", kategori: "Pendidikan", target: 150000000, terkumpul: 87500000,
        gambar: "https://images.unsplash.com/photo-1609599006353-e67907673205?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        deskripsi: "<p>Program beasiswa penuh bagi <strong>50 santri penghafal Al-Quran</strong> dari keluarga dhuafa di seluruh Indonesia.</p><p>Dana mencakup biaya asrama, konsumsi harian, mushaf, dan tunjangan guru pembimbing selama satu tahun penuh.</p>",
        deadline: Date.now() + 45 * 86400000, createdAt: Date.now() - 90 * 86400000 },
    "kemanusiaan-01": { nama: "Aksi Kemanusiaan Gempa Cianjur", kategori: "Kemanusiaan", target: 500000000, terkumpul: 320000000,
        gambar: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        deskripsi: "<p>Pembangunan kembali <strong>12 unit rumah warga</strong> terdampak gempa serta penyaluran logistik tanggap darurat untuk 300 KK.</p>",
        deadline: Date.now() + 15 * 86400000, createdAt: Date.now() - 120 * 86400000 },
    "infrastruktur-01": { nama: "Pembangunan Sumur Bersih Desa Terpencil", kategori: "Infrastruktur", target: 75000000, terkumpul: 42000000,
        gambar: "https://images.unsplash.com/photo-1541544537156-762768606603?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        deskripsi: "<p>Membangun infrastruktur air bersih di <strong>5 titik desa</strong> yang selama ini harus berjalan kaki berkilo-kilo meter untuk mendapatkan air layak minum.</p>",
        deadline: Date.now() + 60 * 86400000, createdAt: Date.now() - 60 * 86400000 }
};
const SEED_PENYALURAN = [
    { programKey: "kemanusiaan-01", judul: "Distribusi Bantuan Logistik", tanggal: Date.now() - 3 * 86400000, lokasi: "Cianjur, Jawa Barat",
        cerita: "Alhamdulillah, tim relawan telah menyalurkan 500 paket sembako kepada warga terdampak.",
        gambar: "https://images.unsplash.com/photo-1593113642977-4305be476ff3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", jumlah: 50000000 },
    { programKey: "pendidikan-01", judul: "Gedung Asrama Putri Rampung", tanggal: Date.now() - 10 * 86400000, lokasi: "Pesantren Al-Hidayah, Solo",
        cerita: "Progres pembangunan asrama putri telah mencapai 100% dan siap dihuni oleh 20 santriwati baru.",
        gambar: "https://images.unsplash.com/photo-1518406110532-cc1e2f7e2d2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", jumlah: 120000000 }
];

async function seedJikaKosong() {
    try {
        const snap = await db.ref('program').once('value');
        if (snap.exists()) return;
        const updates = {};
        Object.entries(SEED_PROGRAMS).forEach(([k, v]) => { updates['program/' + k] = v; });
        SEED_PENYALURAN.forEach(u => {
            const key = 'penyaluran-' + Math.random().toString(36).slice(2, 8);
            updates['penyaluran/' + key] = {
                programId: u.programKey, programNama: SEED_PROGRAMS[u.programKey].nama,
                judul: u.judul, tanggal: u.tanggal, lokasi: u.lokasi, cerita: u.cerita,
                gambar: u.gambar, jumlah: u.jumlah, createdAt: u.tanggal
            };
        });
        await db.ref().update(updates);
        console.info('[SedekahBerkah] Data contoh berhasil dibuat.');
    } catch (err) {
        console.warn('[SedekahBerkah] Tidak bisa membuat data contoh:', err.message);
    }
}

// ---------- Init Realtime Listeners ----------
document.addEventListener('DOMContentLoaded', () => {
    let programsCache = {}, donasiCache = {};
    const refreshStats = () => updateStatistik(programsCache, donasiCache);

    db.ref('program').on('value', snap => {
        programsCache = snap.val() || {};
        renderPrograms(programsCache);
        refreshStats();
    });
    db.ref('donasi').on('value', snap => {
        donasiCache = snap.val() || {};
        renderAktivitas(donasiCache);
        refreshStats();
        renderCharts(programsCache, donasiCache);
        renderRingkasanKeuangan(donasiCache, programsCache);
    });
    db.ref('penyaluran').on('value', snap => {
        const map = snap.val() || {};
        window.__totalPenyaluran = Object.values(map).reduce((a, u) => a + (u.jumlah || 0), 0);
        renderTransparansi(map);
        renderRingkasanKeuangan(donasiCache, programsCache);
    });

    // Buat data contoh bila database masih kosong
    seedJikaKosong();

    // Counter animasi statDonasi tetap jalan sebagai pemanis hero
    const counterEl = document.getElementById('statDonasi');
    if (counterEl) {
        const targetNumber = parseInt(counterEl.getAttribute('data-target'), 10) || 0;
        let current = 0;
        const increment = targetNumber / 60;
        const timer = setInterval(() => {
            current += increment;
            if (current >= targetNumber) { clearInterval(timer); current = targetNumber; }
            counterEl.textContent = Math.floor(current).toLocaleString('id-ID');
        }, 20);
    }
});
