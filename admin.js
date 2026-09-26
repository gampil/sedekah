// ============================================================
//  admin.js — Admin Dashboard (Firebase Auth + RTDB)
//  Halaman: Dashboard, Kelola Program, Transaksi Donasi,
//           Penyaluran & Update, Pengaturan
// ============================================================
(function () {
    const el = id => document.getElementById(id);
    const auth = firebase.auth();

    let programCache = {};   // key -> data program
    let transaksiCache = {}; // key -> data transaksi
    let filterStatusAktif = 'semua';
    let chartHarian = null, chartMetode = null;

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ================= MODAL HELPERS =================
    function openModal(modalId, contentId) {
        const m = el(modalId), c = el(contentId);
        m.classList.remove('hidden'); m.classList.add('flex');
        requestAnimationFrame(() => { m.classList.remove('opacity-0'); c.classList.remove('scale-95'); });
    }
    function closeModal(modalId, contentId) {
        const m = el(modalId), c = el(contentId);
        m.classList.add('opacity-0'); c.classList.add('scale-95');
        setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 200);
    }

    // ================= AUTH / LOGIN =================
    function enterApp(user) {
        el('loginScreen').classList.add('hidden');
        el('adminEmailLabel').textContent = user.email || 'Administrator';
        bindRealtime();
    }

    auth.onAuthStateChanged(user => {
        if (user) enterApp(user);
        else el('loginScreen').classList.remove('hidden');
    });

    el('loginForm').addEventListener('submit', e => {
        e.preventDefault();
        const btn = el('btnLogin');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memeriksa...';
        el('loginError').classList.add('hidden');
        auth.signInWithEmailAndPassword(el('loginEmail').value.trim(), el('loginPassword').value)
            .catch(err => {
                console.error(err);
                const msgs = {
                    'auth/invalid-login-credentials': 'Email atau kata sandi salah.',
                    'auth/wrong-password': 'Email atau kata sandi salah.',
                    'auth/user-not-found': 'Akun tidak ditemukan. Buat dulu di Firebase Console → Authentication → Users.',
                    'auth/invalid-email': 'Format email tidak valid.',
                    'auth/network-request-failed': 'Koneksi ke Firebase gagal. Periksa internet/CORS.',
                    'auth/configuration-not-found': 'Aktifkan Sign-in method Email/Password di Firebase Console → Authentication.'
                };
                el('loginErrorMsg').textContent = msgs[err.code] || err.message;
                el('loginError').classList.remove('hidden');
            })
            .finally(() => { btn.disabled = false; btn.textContent = 'Masuk ke Dashboard'; });
    });

    el('btnLogout').addEventListener('click', () => {
        auth.signOut().then(() => location.reload());
    });

    // ================= NAVIGATION =================
    const PAGE_TITLES = {
        dashboard: 'Dashboard', program: 'Kelola Program Donasi',
        transaksi: 'Transaksi Donasi', penyaluran: 'Penyaluran & Update', pengaturan: 'Pengaturan'
    };
    function showPage(page) {
        document.querySelectorAll('.admin-page').forEach(s => s.classList.add('hidden'));
        el('page-' + page).classList.remove('hidden');
        el('pageTitle').textContent = PAGE_TITLES[page] || 'Admin';
        document.querySelectorAll('.nav-btn').forEach(b => {
            const active = b.dataset.page === page;
            b.classList.toggle('bg-emerald-50', active);
            b.classList.toggle('text-emerald-600', active);
            b.classList.toggle('text-gray-600', !active);
        });
        el('mobileDrawer').classList.add('hidden');
        if (page === 'dashboard') renderCharts();
    }
    document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
    document.querySelector('.goto-transaksi').addEventListener('click', () => showPage('transaksi'));
    el('btnMobileMenu').addEventListener('click', () => el('mobileDrawer').classList.toggle('hidden'));

    // ================= REALTIME BINDINGS =================
    function bindRealtime() {
        db.ref('program').on('value', snap => {
            programCache = snap.val() || {};
            renderTableProgram();
            fillSelectPenyaluran();
            renderStats();
            renderCharts();
        });

        db.ref('donasi').on('value', snap => {
            transaksiCache = snap.val() || {};
            renderTableTransaksi();
            renderAktivitas();
            renderStats();
            renderCharts();
            updateBadge();
        });

        db.ref('penyaluran').on('value', snap => {
            renderPenyaluranCards(snap.val() || {});
        });

        db.ref('pengaturan').on('value', snap => {
            const p = snap.val() || {};
            el('previewQris').src = p.qrisImage || DEFAULT_QRIS_IMAGE;
            el('setBankName').value = p.bankName || '';
            el('setBankNumber').value = p.bankNumber || '';
            el('setBankHolder').value = p.bankHolder || '';
        });
    }

    function allTransaksi() {
        return Object.entries(transaksiCache).map(([k, t]) => Object.assign({ key: k }, t));
    }

    // ================= DASHBOARD STATS =================
    function renderStats() {
        const terkumpul = Object.values(programCache).reduce((a, p) => a + (p.terkumpul || 0), 0);
        const now = new Date();
        const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const bulanIni = allTransaksi().filter(t => t.status === 'success' && (t.paidAt || t.timestamp) >= awalBulan)
            .reduce((a, t) => a + (t.nominal || 0), 0);
        const donaturSukses = allTransaksi().filter(t => t.status === 'success');
        const perluVerif = allTransaksi().filter(t => t.status === 'verifikasi').length;

        el('statTerkumpul').textContent = rupiah(terkumpul);
        el('statBulanIni').textContent = rupiah(bulanIni);
        el('statDonatur').textContent = donaturSukses.length;
        el('statVerifikasi').textContent = perluVerif;
    }

    function updateBadge() {
        const n = allTransaksi().filter(t => t.status === 'verifikasi').length;
        const badge = el('badgeVerifikasi');
        badge.textContent = n;
        badge.classList.toggle('hidden', n === 0);
    }

    function renderAktivitas() {
        const arr = allTransaksi().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 8);
        const wrap = el('aktivitasList');
        if (!arr.length) {
            wrap.innerHTML = '<p class="p-8 text-center text-gray-400 text-sm italic">Belum ada transaksi donasi.</p>';
            return;
        }
        wrap.innerHTML = arr.map(t => {
            const s = STATUS_LABEL[t.status] || STATUS_LABEL.menunggu;
            return `
            <div class="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50">
                <div class="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-heart text-xs"></i></div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(t.donatur || 'Anonim')} <span class="text-gray-400 font-normal">→ ${escapeHtml(t.programNama || '-')}</span></p>
                    <p class="text-xs text-gray-400">${waktuRelatif(t.timestamp)} • ${escapeHtml((PAY_METHODS[t.metode] || {}).nama || t.metode || '')}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-sm font-bold text-gray-800">${rupiah(t.nominal)}</p>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}">${s.teks}</span>
                </div>
            </div>`;
        }).join('');
    }

    // ================= CHARTS =================
    function renderCharts() {
        if (!window.Chart || el('page-dashboard').classList.contains('hidden')) return;
        const sukses = allTransaksi().filter(t => t.status === 'success');

        // --- Bar: 30 hari terakhir ---
        const days = [], labels = [], data = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
            days.push({ start: d.getTime(), next: d.getTime() + 86400000 });
            labels.push(d.getDate() + '/' + (d.getMonth() + 1));
        }
        days.forEach(({ start, next }) => {
            data.push(sukses.filter(t => { const w = t.paidAt || t.timestamp; return w >= start && w < next; })
                .reduce((a, t) => a + (t.nominal || 0), 0));
        });
        if (chartHarian) chartHarian.destroy();
        chartHarian = new Chart(el('chartDonasiHarian'), {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Nominal', data, backgroundColor: '#10b981', borderRadius: 4, maxBarThickness: 14 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => rupiah(ctx.raw) } } },
                scales: { y: { ticks: { callback: v => 'Rp' + (v >= 1e6 ? (v / 1e6) + 'jt' : (v / 1000) + 'rb') }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } }
            }
        });

        // --- Doughnut: per metode ---
        const perMetode = {};
        sukses.forEach(t => { const m = (PAY_METHODS[t.metode] || {}).nama || t.metode || 'Lainnya'; perMetode[m] = (perMetode[m] || 0) + (t.nominal || 0); });
        const warna = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1'];
        const hasData = Object.keys(perMetode).length > 0;
        if (chartMetode) chartMetode.destroy();
        chartMetode = new Chart(el('chartMetode'), {
            type: 'doughnut',
            data: {
                labels: hasData ? Object.keys(perMetode) : ['Belum ada data'],
                datasets: [{ data: hasData ? Object.values(perMetode) : [1], backgroundColor: hasData ? warna : ['#e2e8f0'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + rupiah(ctx.raw) } } } }
        });
    }

    // ================= TABEL PROGRAM =================
    el('cariProgram').addEventListener('input', renderTableProgram);

    function renderTableProgram() {
        const q = el('cariProgram').value.toLowerCase();
        const tbody = el('tableBody');
        const rows = Object.entries(programCache).filter(([, p]) => String(p.nama || '').toLowerCase().includes(q));
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-gray-400 text-sm">Tidak ada program.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(([key, p], i) => {
            const persen = p.target > 0 ? Math.min(100, (p.terkumpul || 0) / p.target * 100) : 0;
            return `
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td class="p-4 text-center text-gray-500 text-sm">${i + 1}</td>
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <img src="${escapeHtml(p.gambar || '')}" onerror="this.src='https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=100'" class="w-12 h-12 rounded-lg object-cover bg-gray-200">
                        <div>
                            <p class="font-semibold text-gray-800 text-sm">${escapeHtml(p.nama)}</p>
                            <div class="flex items-center gap-2 mt-1">
                                <div class="w-24 bg-gray-100 rounded-full h-1.5"><div class="bg-emerald-500 h-1.5 rounded-full" style="width:${persen}%"></div></div>
                                <span class="text-[10px] text-gray-400">${persen.toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="p-4"><span class="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">${escapeHtml(p.kategori || '-')}</span></td>
                <td class="p-4 text-right font-medium text-gray-700 text-sm">${angkaRupiah(p.target)}</td>
                <td class="p-4 text-right font-bold text-emerald-600 text-sm">${angkaRupiah(p.terkumpul)}</td>
                <td class="p-4">
                    <div class="flex justify-center gap-2">
                        <button data-edit="${key}" title="Edit" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"><i class="fa-solid fa-pen-to-square text-sm"></i></button>
                        <a href="campaign.html?id=${encodeURIComponent(key)}" target="_blank" title="Lihat halaman publik" class="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition flex items-center justify-center"><i class="fa-solid fa-eye text-sm"></i></a>
                        <button data-hapus="${key}" title="Hapus" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition"><i class="fa-solid fa-trash-can text-sm"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => bukaFormProgram(b.dataset.edit));
        tbody.querySelectorAll('[data-hapus]').forEach(b => b.onclick = () => hapusProgram(b.dataset.hapus));
    }

    el('btnTambah').addEventListener('click', () => bukaFormProgram(null));

    function bukaFormProgram(key) {
        el('programForm').reset();
        el('programId').value = key || '';
        el('modalTitle').textContent = key ? 'Edit Program' : 'Tambah Program Baru';
        if (key) {
            const p = programCache[key];
            el('namaProgram').value = p.nama || '';
            el('kategori').value = p.kategori || 'Pendidikan';
            el('targetDonasi').value = p.target || '';
            el('gambarProgram').value = p.gambar || '';
            el('deskripsi').value = p.deskripsi || '';
            if (p.deadline) el('deadlineProgram').value = new Date(p.deadline).toISOString().split('T')[0];
        }
        openModal('modalForm', 'modalContent');
    }

    el('btnCloseModal').addEventListener('click', () => closeModal('modalForm', 'modalContent'));

    el('programForm').addEventListener('submit', e => {
        e.preventDefault();
        const key = el('programId').value;
        const lama = key ? programCache[key] : null;
        const data = {
            nama: el('namaProgram').value.trim(),
            kategori: el('kategori').value,
            target: parseInt(el('targetDonasi').value, 10) || 0,
            terkumpul: lama ? (lama.terkumpul || 0) : 0,
            gambar: el('gambarProgram').value.trim() || 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
            deskripsi: el('deskripsi').value.trim(),
            deadline: el('deadlineProgram').value ? new Date(el('deadlineProgram').value + 'T23:59:59').getTime() : (lama && lama.deadline) || (Date.now() + 60 * 86400000),
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };

        const promise = key
            ? db.ref('program/' + key).update(data)
            : db.ref('program').push(Object.assign({ createdAt: Date.now() }, data));
        promise.then(() => { showToast(key ? 'Program berhasil diperbarui!' : 'Program baru berhasil ditambahkan!'); closeModal('modalForm', 'modalContent'); })
               .catch(err => showToast('Gagal menyimpan: ' + err.message, 'error'));
    });

    function hapusProgram(key) {
        const p = programCache[key];
        if (!confirm(`Hapus program "${p.nama}"?\n\nUpdate penyaluran milik program ini juga akan dihapus.`)) return;
        db.ref('penyaluran').once('value').then(snap => {
            const updates = {};
            updates['program/' + key] = null;
            snap.forEach(c => { if (c.val().programId === key) updates['penyaluran/' + c.key] = null; });
            return db.ref().update(updates);
        }).then(() => showToast('Program dan data terkait berhasil dihapus.'))
          .catch(err => showToast('Gagal menghapus: ' + err.message, 'error'));
    }

    // ================= TRANSAKSI =================
    el('cariTransaksi').addEventListener('input', renderTableTransaksi);
    document.querySelectorAll('#filterStatus .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            filterStatusAktif = chip.dataset.status;
            document.querySelectorAll('#filterStatus .filter-chip').forEach(c => {
                c.classList.remove('bg-emerald-500', 'text-white');
                c.classList.add('bg-white', 'text-gray-600', 'border', 'border-gray-200');
            });
            chip.classList.add('bg-emerald-500', 'text-white');
            chip.classList.remove('bg-white', 'text-gray-600');
            renderTableTransaksi();
        });
    });

    function filteredTransaksi() {
        const q = el('cariTransaksi').value.toLowerCase();
        return allTransaksi()
            .filter(t => filterStatusAktif === 'semua' || t.status === filterStatusAktif)
            .filter(t => !q || [t.invoice, t.donatur, t.email, t.programNama].some(v => String(v || '').toLowerCase().includes(q)))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    function aksiHtml(t) {
        switch (t.status) {
            case 'menunggu': return `
                <button data-ver="${t.key}" class="btn-mini bg-amber-50 text-amber-600 hover:bg-amber-100" title="Tandai perlu verifikasi"><i class="fa-solid fa-hourglass-start"></i></button>
                <button data-ok="${t.key}" class="btn-mini bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Konfirmasi lunas"><i class="fa-solid fa-check"></i></button>
                <button data-no="${t.key}" class="btn-mini bg-red-50 text-red-500 hover:bg-red-100" title="Tandai gagal"><i class="fa-solid fa-xmark"></i></button>`;
            case 'verifikasi': return `
                <button data-ok="${t.key}" class="btn-mini bg-emerald-500 text-white hover:bg-emerald-600" title="Setujui & konfirmasi dana masuk"><i class="fa-solid fa-check-double"></i></button>
                <button data-no="${t.key}" class="btn-mini bg-red-50 text-red-500 hover:bg-red-100" title="Tolak"><i class="fa-solid fa-ban"></i></button>`;
            default: return `<span class="text-[10px] text-gray-400">selesai</span>`;
        }
    }

    function renderTableTransaksi() {
        const tbody = el('tableTransaksi');
        const rows = filteredTransaksi();
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-12 text-center text-gray-400 text-sm">Tidak ada transaksi pada filter ini.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(t => {
            const s = STATUS_LABEL[t.status] || STATUS_LABEL.menunggu;
            return `
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td class="p-4 font-mono text-xs text-gray-500">${escapeHtml(t.invoice || t.key)}</td>
                <td class="p-4">
                    <p class="font-semibold text-gray-800 text-sm">${escapeHtml(t.donatur || '-')}${t.anonim ? ' <i class="fa-solid fa-user-secret text-gray-300 text-xs" title="Anonim"></i>' : ''}</p>
                    <p class="text-xs text-gray-400">${escapeHtml(t.email || '')}</p>
                </td>
                <td class="p-4 text-sm text-gray-600 max-w-[180px] truncate">${escapeHtml(t.programNama || '-')}</td>
                <td class="p-4 font-bold text-emerald-600 text-sm whitespace-nowrap">${rupiah(t.nominal)}</td>
                <td class="p-4 text-sm text-gray-600">${escapeHtml((PAY_METHODS[t.metode] || {}).nama || t.metode || '-')}</td>
                <td class="p-4 text-xs text-gray-500 whitespace-nowrap">${tanggalSingkat(t.timestamp)}</td>
                <td class="p-4 text-center"><span class="text-[10px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${s.cls}">${s.teks}</span></td>
                <td class="p-4"><div class="flex justify-center gap-1.5 items-center">
                    <button data-detail="${t.key}" class="btn-mini bg-gray-100 text-gray-600 hover:bg-gray-200" title="Detail"><i class="fa-solid fa-circle-info"></i></button>
                    ${aksiHtml(t)}
                </div></td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => ubahStatus(b.dataset.ok, 'success'));
        tbody.querySelectorAll('[data-no]').forEach(b => b.onclick = () => ubahStatus(b.dataset.no, 'gagal'));
        tbody.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => ubahStatus(b.dataset.ver, 'verifikasi'));
        tbody.querySelectorAll('[data-detail]').forEach(b => b.onclick = () => bukaDetail(b.dataset.detail));
    }

    // Transisi status + efek ke progres program (idempotent)
    function ubahStatus(key, statusBaru) {
        const t = transaksiCache[key]; if (!t) return;
        const lama = t.status;
        if (lama === statusBaru) return;

        const updates = {
            status: statusBaru,
            statusUpdatedAt: firebase.database.ServerValue.TIMESTAMP,
            verifiedBy: auth.currentUser ? auth.currentUser.email : 'admin'
        };
        if (statusBaru === 'success') updates.paidAt = firebase.database.ServerValue.TIMESTAMP;

        const write = {};
        write['donasi/' + key] = updates;
        // hanya sekali menambah/mengurangi progres
        if (lama !== 'success' && statusBaru === 'success') {
            const cur = (programCache[t.programId] && programCache[t.programId].terkumpul) || 0;
            write['program/' + t.programId + '/terkumpul'] = cur + (t.nominal || 0);
        } else if (lama === 'success' && statusBaru !== 'success') {
            const cur = (programCache[t.programId] && programCache[t.programId].terkumpul) || 0;
            write['program/' + t.programId + '/terkumpul'] = Math.max(0, cur - (t.nominal || 0));
        }

        db.ref().update(write)
            .then(() => showToast('Status diubah menjadi ' + ((STATUS_LABEL[statusBaru] || {}).teks) + '.'))
            .catch(err => showToast('Gagal mengubah status: ' + err.message, 'error'));
    }

    function bukaDetail(key) {
        const t = transaksiCache[key]; if (!t) return;
        const s = STATUS_LABEL[t.status] || STATUS_LABEL.menunggu;
        const baris = (l, v) => `<div class="flex justify-between gap-4 border-b border-gray-50 pb-2"><span class="text-gray-500">${l}</span><span class="font-semibold text-gray-800 text-right break-all">${v}</span></div>`;
        el('detailBody').innerHTML = `
            ${baris('Invoice', `<span class="font-mono">${escapeHtml(t.invoice || key)}</span>`)}
            ${baris('Status', `<span class="px-2 py-0.5 rounded-full text-[10px] border ${s.cls}">${s.teks}</span>`)}
            ${baris('Program', escapeHtml(t.programNama || '-'))}
            ${baris('Nominal', rupiah(t.nominal))}
            ${t.totalBayar ? baris('Total Transfer', rupiah(t.totalBayar)) : ''}
            ${baris('Metode', escapeHtml((PAY_METHODS[t.metode] || {}).nama || t.metode || '-'))}
            ${baris('Donatur', escapeHtml(t.donatur || '-') + (t.anonim ? ' (Anonim)' : ''))}
            ${baris('Email', escapeHtml(t.email || '-'))}
            ${baris('No. HP', escapeHtml(t.telepon || '-'))}
            ${baris('Dibuat', waktuLengkap(t.timestamp))}
            ${t.paidAt ? baris('Dibayar', waktuLengkap(t.paidAt)) : ''}
            ${t.verifiedBy ? baris('Diverifikasi oleh', escapeHtml(t.verifiedBy)) : ''}
            ${t.pesan ? `<div class="pt-1"><p class="text-gray-500 mb-1">Pesan / Doa:</p><p class="bg-emerald-50 border border-emerald-100 rounded-xl p-3 italic text-gray-700">"${escapeHtml(t.pesan)}"</p></div>` : ''}`;
        openModal('modalDetail', 'modalDetailContent');
    }
    el('btnCloseDetail').addEventListener('click', () => closeModal('modalDetail', 'modalDetailContent'));

    // ---- Export CSV ----
    el('btnExportCsv').addEventListener('click', () => {
        const rows = filteredTransaksi();
        if (!rows.length) { showToast('Tidak ada data untuk diekspor.', 'warn'); return; }
        const head = ['Invoice', 'Tanggal', 'Donatur', 'Email', 'Telepon', 'Program', 'Nominal', 'Metode', 'Status'];
        // helper: bersihkan nilai -> string CSV aman (tanpa template literal / regex agar kompatibel semua browser)
        function csvCell(v) {
            var s = (v === null || v === undefined) ? '' : String(v);
            s = s.split('"').join('""');
            return '"' + s + '"';
        }
        var csvLines = [head.map(csvCell).join(';')];
        rows.forEach(function (t) {
            var cells = [
                t.invoice || t.key,
                new Date(t.timestamp).toLocaleDateString('id-ID'),
                t.donatur, t.email, t.telepon || '',
                t.programNama, t.nominal,
                (PAY_METHODS[t.metode] || {}).nama || t.metode,
                t.status
            ];
            csvLines.push(cells.map(csvCell).join(';'));
        });
        const csv = csvLines.join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'transaksi-donasi-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        showToast('CSV berhasil diunduh.');
    });

    // ================= PENYALURAN =================
    function fillSelectPenyaluran() {
        const sel = el('penyaluranProgram');
        const prev = sel.value;
        sel.innerHTML = Object.entries(programCache).map(([k, p]) => `<option value="${k}">${escapeHtml(p.nama)}</option>`).join('');
        if (prev && programCache[prev]) sel.value = prev;
    }

    el('btnTambahPenyaluran').addEventListener('click', () => {
        el('penyaluranForm').reset();
        el('penyaluranId').value = '';
        el('penyaluranModalTitle').textContent = 'Tambah Update Penyaluran';
        el('penyaluranTanggal').value = new Date().toISOString().split('T')[0];
        fillSelectPenyaluran();
        openModal('modalPenyaluran', 'modalPenyaluranContent');
    });
    el('btnClosePenyaluran').addEventListener('click', () => closeModal('modalPenyaluran', 'modalPenyaluranContent'));

    el('penyaluranForm').addEventListener('submit', e => {
        e.preventDefault();
        const key = el('penyaluranId').value;
        const data = {
            programId: el('penyaluranProgram').value,
            programNama: (programCache[el('penyaluranProgram').value] || {}).nama || '',
            judul: el('penyaluranJudul').value.trim(),
            tanggal: el('penyaluranTanggal').value ? new Date(el('penyaluranTanggal').value + 'T12:00:00').getTime() : Date.now(),
            jumlah: parseInt(el('penyaluranJumlah').value, 10) || 0,
            lokasi: el('penyaluranLokasi').value.trim(),
            gambar: el('penyaluranGambar').value.trim(),
            cerita: el('penyaluranCerita').value.trim(),
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        const p = key ? db.ref('penyaluran/' + key).update(data) : db.ref('penyaluran').push(data);
        p.then(() => { showToast('Update penyaluran tersimpan & tampil di halaman publik.'); closeModal('modalPenyaluran', 'modalPenyaluranContent'); })
         .catch(err => showToast('Gagal menyimpan: ' + err.message, 'error'));
    });

    function renderPenyaluranCards(map) {
        const wrap = el('penyaluranCards');
        const arr = Object.entries(map).sort((a, b) => (b[1].tanggal || 0) - (a[1].tanggal || 0));
        if (!arr.length) {
            wrap.innerHTML = '<div class="col-span-full bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm"><i class="fa-solid fa-box-open text-3xl mb-3 block text-gray-300"></i>Belum ada update penyaluran. Klik "Tambah Update".</div>';
            return;
        }
        wrap.innerHTML = arr.map(([key, u]) => `
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                ${u.gambar ? `<img src="${escapeHtml(u.gambar)}" onerror="this.remove()" class="h-40 w-full object-cover">` : '<div class="h-40 bg-emerald-50 flex items-center justify-center text-emerald-300"><i class="fa-solid fa-image text-3xl"></i></div>'}
                <div class="p-5 flex-1 flex flex-col">
                    <span class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">${escapeHtml(u.programNama || '')} • ${tanggalSingkat(u.tanggal)}</span>
                    <h4 class="font-bold text-gray-800 text-sm mb-1">${escapeHtml(u.judul)}</h4>
                    ${u.jumlah ? `<p class="text-xs font-semibold text-gray-600 mb-1"><i class="fa-solid fa-money-bill-transfer text-emerald-500 mr-1"></i>${rupiah(u.jumlah)}</p>` : ''}
                    ${u.lokasi ? `<p class="text-xs text-gray-400 mb-2"><i class="fa-solid fa-location-dot mr-1"></i>${escapeHtml(u.lokasi)}</p>` : ''}
                    <p class="text-xs text-gray-500 line-clamp-3 flex-1">${escapeHtml(u.cerita || '')}</p>
                    <div class="flex gap-2 mt-4">
                        <button data-pedit="${key}" class="flex-1 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 py-2 rounded-lg transition"><i class="fa-solid fa-pen-to-square mr-1"></i>Edit</button>
                        <button data-pdel="${key}" class="flex-1 text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 py-2 rounded-lg transition"><i class="fa-solid fa-trash-can mr-1"></i>Hapus</button>
                    </div>
                </div>
            </div>`).join('');

        wrap.querySelectorAll('[data-pedit]').forEach(b => b.onclick = () => {
            const u = map[b.dataset.pedit];
            el('penyaluranId').value = b.dataset.pedit;
            el('penyaluranModalTitle').textContent = 'Edit Update Penyaluran';
            fillSelectPenyaluran();
            el('penyaluranProgram').value = u.programId;
            el('penyaluranJudul').value = u.judul;
            el('penyaluranTanggal').value = new Date(u.tanggal).toISOString().split('T')[0];
            el('penyaluranJumlah').value = u.jumlah || '';
            el('penyaluranLokasi').value = u.lokasi || '';
            el('penyaluranGambar').value = u.gambar || '';
            el('penyaluranCerita').value = u.cerita || '';
            openModal('modalPenyaluran', 'modalPenyaluranContent');
        });
        wrap.querySelectorAll('[data-pdel]').forEach(b => b.onclick = () => {
            if (!confirm('Hapus update penyaluran ini?')) return;
            db.ref('penyaluran/' + b.dataset.pdel).remove()
                .then(() => showToast('Update dihapus.'))
                .catch(err => showToast('Gagal menghapus: ' + err.message, 'error'));
        });
    }

    // ================= PENGATURAN =================
    let qrisDataUrl = null;
    el('uploadQris').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 700 * 1024) { showToast('Ukuran gambar maksimal ~700KB (limit RTDB). Kompres dulu ya.', 'warn'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => { qrisDataUrl = reader.result; el('previewQris').src = qrisDataUrl; };
        reader.readAsDataURL(f);
    });

    el('btnSimpanQris').addEventListener('click', () => {
        if (!qrisDataUrl) { showToast('Pilih file gambar QRIS terlebih dahulu.', 'warn'); return; }
        db.ref('pengaturan/qrisImage').set(qrisDataUrl)
            .then(() => { showToast('QRIS berhasil disimpan!'); qrisDataUrl = null; })
            .catch(err => showToast('Gagal menyimpan: ' + err.message, 'error'));
    });

    el('btnSimpanBank').addEventListener('click', () => {
        db.ref('pengaturan').update({
            bankName: el('setBankName').value.trim(),
            bankNumber: el('setBankNumber').value.trim(),
            bankHolder: el('setBankHolder').value.trim()
        }).then(() => showToast('Pengaturan rekening tersimpan.'))
          .catch(err => showToast('Gagal: ' + err.message, 'error'));
    });

    // Close modal saat klik latar
    [['modalForm', 'modalContent'], ['modalDetail', 'modalDetailContent'], ['modalPenyaluran', 'modalPenyaluranContent']]
        .forEach(([m, c]) => el(m).addEventListener('click', e => { if (e.target.id === m) closeModal(m, c); }));
})();
