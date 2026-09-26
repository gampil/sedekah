// ============================================================
//  bayar.js — Halaman pembayaran (simulasi payment gateway)
//  bayar.html?id=<key-transaksi>
//
//  Alur status: menunggu -> (e-wallet/QRIS: success langsung,
//  VA bank: verifikasi dulu oleh admin) -> success
//  Saat success, /program/<id>/terkumpul bertambah atomik.
// ============================================================
(function () {
    const el = (id) => document.getElementById(id);
    const params = new URLSearchParams(location.search);
    const transId = params.get('id');

    let currentStatus = null;
    let countdownTimer = null;

    // ---------- Kalkulator nominal unik (anti salah transfer) ----------
    function kodeUnik(invoice) {
        let h = 0;
        for (const c of String(invoice)) h = (h * 31 + c.charCodeAt(0)) % 1000;
        return h / 1000; // misal 0,472 -> Rp 100.472
    }
    function totalBayar(nominal, invoice) {
        return Math.round((nominal + kodeUnik(invoice)) * 1000) / 1000;
    }

    // ---------- Update progres program secara atomik ----------
    function incrementProgram(programId, nominal) {
        const ref = db.ref('program/' + programId + '/terkumpul');
        return ref.transaction(current => (current || 0) + nominal);
    }

    // ---------- Render sesuai status ----------
    function show(viewId) {
        ['pageLoading', 'pageNotFound', 'viewBayar', 'viewSukses', 'viewVerifikasi']
            .forEach(v => el(v).classList.add('hidden'));
        el(viewId).classList.remove('hidden');
        if (viewId === 'viewBayar') el('viewBayar').classList.add('grid');
    }

    function setStatusBadge(status) {
        const badge = el('payStatus');
        const s = STATUS_LABEL[status] || STATUS_LABEL.menunggu;
        badge.textContent = s.teks;
        badge.className = 'font-semibold px-2.5 py-0.5 rounded-full text-xs border ' + s.cls;
    }

    const INSTRUCTIONS = {
        qris: [
            'Buka aplikasi mobile banking atau e-wallet apa pun (GoPay, DANA, OVO, ShopeePay, dll).',
            'Pilih menu <b>Scan / Bayar QRIS</b>.',
            `Scan QR code di samping, atau masukkan nomor <b>QRIS statis Yayasan Sedekah Berkah</b>.`,
            'Pastikan nama merchant <b>SED EKAH BER KAH</b> muncul, lalu masukkan <b>total persis</b> yang tertera.',
            'Selesaikan pembayaran, lalu klik tombol <b>"Saya Sudah Bayar"</b>.'
        ],
        va: [
            'Buka m-banking / ATM bank yang dipilih.',
            'Pilih menu <b>Transfer > Virtual Account</b>.',
            'Masukkan nomor Virtual Account yang tertera di samping.',
            'System akan menampilkan nama <b>Yayasan Sedekah Berkah</b> dan jumlah tagihan.',
            'Transfer <b>persis sampai digit terakhir</b> (kode unik otomatis), lalu konfirmasi.'
        ],
        wallet: [
            'Buka aplikasi e-wallet yang dipilih.',
            'Pilih menu <b>Kirim / Transfer uang</b>.',
            'Masukkan nomor Virtual Account / tujuan di samping.',
            'Masukkan <b>total persis</b> termasuk kode uniknya.',
            'Selesaikan pembayaran lalu klik <b>"Saya Sudah Bayar"</b>.'
        ]
    };

    function renderPembayaran(key, t) {
        const meta = PAY_METHODS[t.metode] || PAY_METHODS.bca;
        const isQris = t.metode === 'qris';
        const isWallet = ['gopay', 'ovo', 'dana', 'shopeepay'].includes(t.metode);
        const total = totalBayar(t.nominal, t.invoice || key);

        el('payTotal').textContent = rupiah(total);
        el('payInvoice').textContent = t.invoice || key;
        el('payProgram').textContent = t.programNama || '-';
        el('payDonatur').textContent = t.donatur || '-';
        el('payMetode').textContent = meta.nama;
        el('linkKembaliProgram').href = 'campaign.html?id=' + encodeURIComponent(t.programId || '');
        setStatusBadge(t.status);

        el('payMethodName').textContent = meta.nama;
        if (isQris) {
            el('payMethodCat').textContent = 'Scan QRIS dari aplikasi bank/e-wallet apa pun';
            el('payBadgeIcon').innerHTML = '<i class="fa-solid fa-qrcode"></i>';
            el('qrWrap').classList.remove('hidden');
            el('vaWrap').classList.add('hidden');
            db.ref('pengaturan/qrisImage').once('value').then(s => {
                el('qrisImg').src = s.val() || DEFAULT_QRIS_IMAGE;
            });
            el('codeLabel').textContent = 'QR Code Pembayaran';
            el('payInstructions').innerHTML = INSTRUCTIONS.qris.map(i => `<li>${i}</li>`).join('');
        } else {
            el('qrWrap').classList.add('hidden');
            el('vaWrap').classList.remove('hidden');
            el('codeLabel').textContent = isWallet ? 'Nomor Tujuan' : 'Nomor Virtual Account';
            el('vaNumber').textContent = nomorVA(t.metode, key);
            el('vaAccountName').textContent = 'Yayasan Sedekah Berkah';
            el('payBadgeIcon').innerHTML = isWallet ? '<i class="fa-solid fa-wallet"></i>' : '<i class="fa-solid fa-building-columns"></i>';
            el('payMethodCat').textContent = isWallet ? 'Transfer via aplikasi ' + meta.nama : 'Transfer via ' + meta.bank + ' Virtual Account';
            el('payInstructions').innerHTML = (isWallet ? INSTRUCTIONS.wallet : INSTRUCTIONS.va).map(i => `<li>${i}</li>`).join('');
        }

        el('btnCopyVa').onclick = () => {
            navigator.clipboard.writeText(el('vaNumber').textContent)
                .then(() => showToast('Nomor berhasil disalin!', 'success'))
                .catch(() => showToast('Gagal menyalin, salin manual ya.', 'warn'));
        };

        // Tombol "Saya Sudah Bayar"
        el('btnSudahBayar').onclick = () => {
            const btn = el('btnSudahBayar');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memverifikasi...';

            if (isQris || isWallet) {
                // Simulasi auto-callback payment gateway -> langsung success
                setTimeout(() => {
                    db.ref('donasi/' + key).update({
                        status: 'success',
                        paidAt: firebase.database.ServerValue.TIMESTAMP,
                        totalBayar: total
                    })
                    .then(() => incrementProgram(t.programId, t.nominal))
                    .then(() => showToast('Pembayaran terkonfirmasi. Terima kasih!', 'success'))
                    .catch(err => { btn.disabled = false; btn.innerHTML = 'Coba Lagi'; showToast('Error: ' + err.message, 'error'); });
                }, 1800);
            } else {
                // VA bank -> perlu rekonsiliasi manual oleh admin
                db.ref('donasi/' + key).update({
                    status: 'verifikasi',
                    claimedPaidAt: firebase.database.ServerValue.TIMESTAMP,
                    totalBayar: total
                })
                .then(() => showToast('Laporan diterima. Menunggu verifikasi admin.', 'info'))
                .catch(err => showToast('Error: ' + err.message, 'error'));
            }
        };

        startCountdown(t.timestamp || Date.now());
    }

    function renderSukses(t) {
        el('okInvoice').textContent = t.invoice || '-';
        el('okProgram').textContent = t.programNama || '-';
        el('okNominal').textContent = rupiah(t.nominal);
        el('okMetode').textContent = (PAY_METHODS[t.metode] || {}).nama || t.metode;
        el('okWaktu').textContent = waktuLengkap(t.paidAt || t.claimedPaidAt || t.timestamp);
        el('okDonatur').textContent = t.anonim ? 'Hamba Allah' : (t.donatur || '-');
        el('okEmail').textContent = t.email || '-';
    }

    function renderVerifikasi(t) {
        el('verInvoice').textContent = t.invoice || '-';
        el('verMetode').textContent = (PAY_METHODS[t.metode] || {}).nama || t.metode;
        el('verProgram').textContent = t.programNama || '-';
        el('verNominal').textContent = rupiah(t.nominal);
    }

    // ---------- Countdown 24 jam ----------
    function startCountdown(createdTs) {
        clearInterval(countdownTimer);
        const batas = (createdTs || Date.now()) + 24 * 3600 * 1000;
        function tick() {
            let sisa = batas - Date.now();
            if (sisa <= 0) { el('countdown').textContent = '00:00:00'; clearInterval(countdownTimer); return; }
            const h = String(Math.floor(sisa / 3600000)).padStart(2, '0');
            const m = String(Math.floor(sisa % 3600000 / 60000)).padStart(2, '0');
            const s = String(Math.floor(sisa % 60000 / 1000)).padStart(2, '0');
            el('countdown').textContent = `${h}:${m}:${s}`;
        }
        tick();
        countdownTimer = setInterval(tick, 1000);
    }

    // ---------- Init ----------
    if (!transId) { show('pageNotFound'); return; }

    db.ref('donasi/' + transId).on('value', snap => {
        const t = snap.val();
        if (!t) { show('pageNotFound'); return; }

        // Jika berubah menjadi success & halaman dibuka dari link bayar, tampilkan sukses setelah singkat
        if (t.status === 'success') {
            if (currentStatus !== 'success') {
                show('viewSukses');
                renderSukses(t);
                currentStatus = 'success';
            }
            return;
        }
        if (t.status === 'verifikasi') {
            show('viewVerifikasi');
            renderVerifikasi(t);
            currentStatus = 'verifikasi';
            return;
        }
        if (t.status === 'gagal') {
            show('pageNotFound');
            el('pageNotFound').querySelector('h2').textContent = 'Transaksi Kadaluarsa / Gagal';
            currentStatus = 'gagal';
            return;
        }
        // menunggu
        show('viewBayar');
        renderPembayaran(transId, t);
        currentStatus = 'menunggu';
    });
})();
