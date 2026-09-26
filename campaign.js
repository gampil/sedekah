// ============================================================
//  campaign.js — Halaman detail program donasi (campaign)
//  URL: campaign.html?id=<key-program>
// ============================================================
(function () {
    const params = new URLSearchParams(location.search);
    const programId = params.get('id');

    const el = (id) => document.getElementById(id);
    let allDonatur = [];
    let shownCount = 5;

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Deskripsi boleh HTML sederhana dari admin; sanitasi ringan:
    function sanitizeHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = String(html || '');
        tmp.querySelectorAll('script,iframe,object,embed,link,style').forEach(n => n.remove());
        tmp.querySelectorAll('*').forEach(n => {
            [...n.attributes].forEach(a => {
                if (/^on/i.test(a.name) || (a.name === 'href' && /^javascript:/i.test(a.value))) n.removeAttribute(a.name);
            });
        });
        return tmp.innerHTML;
    }

    function initialNama(n) {
        return (n && n.trim() ? n.trim()[0] : '?').toUpperCase();
    }

    function renderDonaturList() {
        const list = el('donaturList');
        list.innerHTML = '';
        if (!allDonatur.length) {
            list.innerHTML = `<p class="text-gray-400 text-sm italic">Belum ada donasi pada program ini. Jadilah yang pertama berbagi!</p>`;
            el('btnMoreDonatur').classList.add('hidden');
            return;
        }
        allDonatur.slice(0, shownCount).forEach(d => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-4';
            row.innerHTML = `
                <div class="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center shrink-0">${initialNama(d.donatur)}</div>
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-800 text-sm truncate">${escapeHtml(d.donatur)} ${d.anonim ? '<span class="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 ml-1">Anonim</span>' : ''}</p>
                    <p class="text-xs text-gray-400">${escapeHtml(d.pesan || '') || '&nbsp;'}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="font-bold text-emerald-600 text-sm">${rupiah(d.nominal)}</p>
                    <p class="text-[11px] text-gray-400">${waktuRelatif(d.timestamp)}</p>
                </div>`;
            list.appendChild(row);
        });
        const btn = el('btnMoreDonatur');
        if (allDonatur.length > shownCount) {
            btn.classList.remove('hidden');
            btn.innerHTML = `Lihat Donatur Lainnya <i class="fa-solid fa-chevron-down ml-1"></i>`;
        } else if (shownCount > 5) {
            btn.classList.remove('hidden');
            btn.innerHTML = `Tutup <i class="fa-solid fa-chevron-up ml-1"></i>`;
        } else {
            btn.classList.add('hidden');
        }
    }

    el('btnMoreDonatur').addEventListener('click', () => {
        if (shownCount >= allDonatur.length && allDonatur.length > 5) shownCount = 5;
        else shownCount += 10;
        renderDonaturList();
    });

    if (!programId) {
        el('pageLoading').classList.add('hidden');
        el('pageNotFound').classList.remove('hidden');
        return;
    }

    // ---- Realtime: data program ----
    db.ref('program/' + programId).on('value', snap => {
        const data = snap.val();
        if (!data) {
            el('pageLoading').classList.add('hidden');
            el('pageNotFound').classList.remove('hidden');
            return;
        }
        el('pageLoading').classList.add('hidden');
        el('pageNotFound').classList.add('hidden');
        el('pageContent').classList.remove('hidden');

        document.title = `${data.nama} | SedekahBerkah`;
        el('crumbNama').textContent = data.nama;
        el('detailKategori').textContent = data.kategori || 'Umum';
        el('detailJudul').textContent = data.nama;
        el('detailGambar').src = data.gambar || 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';
        el('detailDeskripsi').innerHTML = sanitizeHtml(data.deskripsi) || '<p class="italic text-gray-400">Belum ada deskripsi program.</p>';
        el('detailDeadline').textContent = data.deadline ? tanggalSingkat(data.deadline) : 'Sepanjang masa';

        const terkumpul = data.terkumpul || 0;
        const target = data.target || 0;
        const persen = target > 0 ? Math.min(100, (terkumpul / target) * 100) : 0;

        el('boxTerkumpul').textContent = rupiah(terkumpul);
        el('boxTarget').textContent = rupiah(target);
        el('boxProgress').style.width = persen + '%';
        el('boxPersen').textContent = persen.toFixed(0);
        el('boxHari').textContent = data.deadline ? Math.max(0, Math.ceil((data.deadline - Date.now()) / 86400000)) : '∞';

        // Link donasi membawa id program
        el('boxDonasiBtn').href = 'donasi.html?program=' + encodeURIComponent(programId);
        el('navDonasiBtn').href = 'donasi.html?program=' + encodeURIComponent(programId);
    });

    // ---- Realtime: donatur (hanya yang success/verifikasi) ----
    db.ref('donasi').orderByChild('programId').equalTo(programId).on('value', snap => {
        const arr = [];
        snap.forEach(c => {
            const d = c.val();
            if (d.status === 'success' || d.status === 'verifikasi') {
                arr.push(Object.assign({ key: c.key }, d));
            }
        });
        arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        allDonatur = arr;
        el('donaturTotal').textContent = arr.length;
        el('detailDonaturCount').textContent = arr.length;
        el('boxDonatur').textContent = arr.length;
        renderDonaturList();
    });

    // ---- Realtime: update penyaluran program ini ----
    db.ref('penyaluran').orderByChild('programId').equalTo(programId).on('value', snap => {
        const wrap = el('penyaluranList');
        wrap.innerHTML = '';
        const arr = [];
        snap.forEach(c => arr.push(Object.assign({ key: c.key }, c.val())));
        arr.sort((a, b) => (b.tanggal || b.createdAt || 0) - (a.tanggal || a.createdAt || 0));
        el('boxPenyaluran').textContent = arr.length;

        if (!arr.length) {
            wrap.innerHTML = `<p class="text-gray-400 text-sm italic">Belum ada update penyaluran untuk program ini.</p>`;
            return;
        }
        arr.forEach(u => {
            const card = document.createElement('div');
            card.className = 'border-l-4 border-emerald-500 pl-5 relative';
            card.innerHTML = `
                <span class="absolute -left-[9px] top-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-white shadow"></span>
                <p class="text-xs font-semibold text-emerald-600 mb-1"><i class="fa-regular fa-calendar mr-1"></i>${tanggalSingkat(u.tanggal || u.createdAt)}</p>
                <h4 class="font-bold text-gray-800">${escapeHtml(u.judul)}</h4>
                ${u.gambar ? `<img src="${escapeHtml(u.gambar)}" alt="${escapeHtml(u.judul)}" class="rounded-xl my-3 max-h-72 w-full object-cover shadow-sm" loading="lazy">` : ''}
                <p class="text-gray-600 text-sm leading-relaxed whitespace-pre-line">${escapeHtml(u.cerita || '')}</p>
                ${u.lokasi ? `<p class="text-xs text-gray-400 mt-2"><i class="fa-solid fa-location-dot mr-1"></i>${escapeHtml(u.lokasi)}</p>` : ''}`;
            wrap.appendChild(card);
        });
    });
})();
