// ============================================================
//  donasi.js — Alur transaksi donasi publik (Create Order)
//  donasi.html?program=<id>  ->  simpan ke /donasi  ->  bayar.html?id=<key>
// ============================================================
(function () {
    const el = (id) => document.getElementById(id);
    const params = new URLSearchParams(location.search);
    const preselect = params.get('program');

    let programCache = {}; // id -> data

    // ---------- Parse & format nominal ----------
    function parseNominal(str) {
        const digits = String(str).replace(/\D/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }
    function formatInput(v) {
        const n = parseNominal(v);
        el('nominalInput').value = n ? new Intl.NumberFormat('id-ID').format(n) : '';
        updateRingkasan();
    }
    function updateRingkasan() {
        const n = parseNominal(el('nominalInput').value);
        el('sumNominal').textContent = rupiah(n);
        el('sumTotal').textContent = rupiah(n);
    }

    el('nominalInput').addEventListener('input', (e) => formatInput(e.target.value));

    document.querySelectorAll('.nominal-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.nominal-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            el('nominalInput').value = new Intl.NumberFormat('id-ID').format(parseInt(chip.dataset.nominal, 10));
            updateRingkasan();
        });
    });

    // ---------- Load program list (realtime) ----------
    db.ref('program').on('value', snap => {
        const select = el('pilihProgram');
        const prev = select.value;
        select.innerHTML = '<option value="">-- Pilih program --</option>';
        programCache = {};
        if (snap.exists()) {
            snap.forEach(c => {
                const d = c.val(); d.key = c.key;
                programCache[c.key] = d;
                const opt = document.createElement('option');
                opt.value = c.key;
                opt.textContent = `${d.nama} (${d.kategori || 'Umum'})`;
                select.appendChild(opt);
            });
        }
        select.value = prev || preselect || '';
        onProgramChange();
    });

    function onProgramChange() {
        const id = el('pilihProgram').value;
        const p = programCache[id];
        const box = el('ringkasanProgram');
        if (!p) { box.classList.add('hidden'); box.classList.remove('flex'); el('sumProgram').textContent = 'Belum dipilih'; return; }
        box.classList.remove('hidden'); box.classList.add('flex');
        el('rpGambar').src = p.gambar || 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80';
        el('rpNama').textContent = p.nama;
        el('rpTerkumpul').textContent = rupiah(p.terkumpul || 0);
        el('rpTarget').textContent = rupiah(p.target || 0);
        const persen = p.target > 0 ? Math.min(100, (p.terkumpul || 0) / p.target * 100) : 0;
        el('rpBar').style.width = persen + '%';
        el('sumProgram').textContent = p.nama;
    }
    el('pilihProgram').addEventListener('change', onProgramChange);

    // ---------- Submit: buat transaksi baru ----------
    el('donasiForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const id = el('pilihProgram').value;
        const nominal = parseNominal(el('nominalInput').value);
        const metodeEl = document.querySelector('input[name="metode"]:checked');

        if (!id) { showToast('Silakan pilih program donasi terlebih dahulu.', 'warn'); return; }
        if (nominal < 10000) { showToast('Nominal donasi minimal Rp 10.000.', 'warn'); return; }
        if (!metodeEl) { showToast('Pilih metode pembayaran.', 'warn'); return; }

        const btn = el('btnLanjut');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memproses...';

        const transaksi = {
            programId: id,
            programNama: programCache[id].nama,
            nominal: nominal,
            donatur: el('namaDonatur').value.trim(),
            email: el('emailDonatur').value.trim(),
            telepon: el('hpDonatur').value.trim(),
            anonim: el('anonim').checked,
            pesan: el('pesanDonatur').value.trim(),
            metode: metodeEl.value,
            status: 'menunggu',
            invoice: generateInvoiceCode(),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        db.ref('donasi').push(transaksi)
            .then(ref => { location.href = 'bayar.html?id=' + ref.key; })
            .catch(err => {
                console.error(err);
                btn.disabled = false;
                btn.innerHTML = 'Lanjutkan Pembayaran <i class="fa-solid fa-arrow-right ml-1"></i>';
                showToast('Gagal menyimpan transaksi: ' + err.message, 'error');
            });
    });

    updateRingkasan();
})();
