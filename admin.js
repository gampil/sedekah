// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
// GANTI object firebaseConfig ini dengan konfigurasi dari Firebase Console Anda
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB9D9e0-_wUEkzuwfek-0gpfOEqFSbJssE",
  authDomain: "sedekah-003.firebaseapp.com",
  projectId: "sedekah-003",
  storageBucket: "sedekah-003.firebasestorage.app",
  messagingSenderId: "761180083609",
  appId: "1:761180083609:web:99d8ef58d157ba34692f08",
  measurementId: "G-NY2MSH0C6P"
};

// Inisialisasi Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();


// ==========================================
// 2. INISIALISASI ELEMEN DOM
// ==========================================
const tableBody = document.getElementById('tableBody');
const modalForm = document.getElementById('modalForm');
const modalContent = document.getElementById('modalContent');
const btnTambah = document.getElementById('btnTambah');
const btnCloseModal = document.getElementById('btnCloseModal');
const programForm = document.getElementById('programForm');
const modalTitle = document.getElementById('modalTitle');

// Input Fields Form
const inputId = document.getElementById('programId');
const inputNama = document.getElementById('namaProgram');
const inputKategori = document.getElementById('kategori');
const inputTarget = document.getElementById('targetDonasi');
const inputDeskripsi = document.getElementById('deskripsi');


// ==========================================
// 3. LOGIKA MODAL (ANIMASI BUKA/TUTUP)
// ==========================================
function openModal(isEdit = false) {
    modalForm.classList.remove('hidden');
    modalForm.classList.add('flex');
    
    // Delay sedikit untuk memicu reflow agar animasi transisi CSS berjalan
    setTimeout(() => {
        modalForm.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);

    // Jika bukan mode edit (tambah baru), kosongkan form
    if (!isEdit) {
        modalTitle.innerText = "Tambah Program Baru";
        programForm.reset();
        inputId.value = '';
    }
}

function closeModal() {
    modalForm.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    
    // Tunggu animasi selesai baru di-hide
    setTimeout(() => {
        modalForm.classList.add('hidden');
        modalForm.classList.remove('flex');
    }, 300);
}

// Event Listeners Modal
btnTambah.addEventListener('click', () => openModal(false));
btnCloseModal.addEventListener('click', closeModal);


// ==========================================
// 4. READ (Menampilkan Data ke Tabel Real-time)
// ==========================================
function loadData() {
    // on('value') membuat tabel otomatis update jika ada perubahan di database
    db.ref('program').on('value', (snapshot) => {
        tableBody.innerHTML = ''; 
        let no = 1;

        if (!snapshot.exists()) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-8 text-center text-gray-500">
                        <i class="fa-solid fa-folder-open text-3xl mb-3 text-gray-300"></i>
                        <p class="text-sm">Belum ada data program. Silakan tambah data baru.</p>
                    </td>
                </tr>
            `;
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            // Format angka ke format Rupiah
            const formatTarget = new Intl.NumberFormat('id-ID').format(data.target || 0);
            const formatTerkumpul = new Intl.NumberFormat('id-ID').format(data.terkumpul || 0);
            
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-100 hover:bg-emerald-50/50 transition-colors";
            
            tr.innerHTML = `
                <td class="p-4 text-center text-gray-600">${no++}</td>
                <td class="p-4 font-medium text-gray-800">${data.nama}</td>
                <td class="p-4">
                    <span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold border border-gray-200">
                        ${data.kategori}
                    </span>
                </td>
                <td class="p-4 text-right text-gray-600">${formatTarget}</td>
                <td class="p-4 text-right font-medium text-emerald-600">${formatTerkumpul}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="editProgram('${id}')" class="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-500 text-blue-500 hover:text-white transition-colors flex items-center justify-center tooltip" title="Edit Data">
                            <i class="fa-solid fa-pen-to-square text-sm"></i>
                        </button>
                        <button onclick="hapusProgram('${id}')" class="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-colors flex items-center justify-center tooltip" title="Hapus Data">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    });
}


// ==========================================
// 5. CREATE & UPDATE (Simpan Data Form)
// ==========================================
programForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = inputId.value;
    const programData = {
        nama: inputNama.value,
        kategori: inputKategori.value,
        target: parseInt(inputTarget.value),
        deskripsi: inputDeskripsi.value,
    };

    if (id) {
        // Proses UPDATE Data Lama
        db.ref('program/' + id).update(programData)
            .then(() => {
                alert('Data program berhasil diperbarui!');
                closeModal();
            })
            .catch((error) => console.error("Error Update:", error));
    } else {
        // Proses CREATE Data Baru
        programData.terkumpul = 0; // Default dana awal selalu 0
        db.ref('program').push(programData)
            .then(() => {
                alert('Program baru berhasil ditambahkan!');
                closeModal();
            })
            .catch((error) => console.error("Error Create:", error));
    }
});


// ==========================================
// 6. FUNGSI EDIT (Tarik data ke form)
// ==========================================
window.editProgram = function(id) {
    db.ref('program/' + id).once('value').then((snapshot) => {
        const data = snapshot.val();
        
        inputId.value = id;
        inputNama.value = data.nama;
        inputKategori.value = data.kategori;
        inputTarget.value = data.target;
        inputDeskripsi.value = data.deskripsi || '';

        modalTitle.innerText = "Edit Data Program";
        openModal(true);
    });
};


// ==========================================
// 7. FUNGSI HAPUS (Delete)
// ==========================================
window.hapusProgram = function(id) {
    if (confirm("Apakah Anda yakin ingin menghapus program ini? Data yang terhapus tidak dapat dikembalikan.")) {
        db.ref('program/' + id).remove()
            .then(() => {
                // Notifikasi sukses (bisa diganti dengan custom Toast Notification)
                console.log('Data berhasil dihapus');
            })
            .catch((error) => console.error("Error Delete:", error));
    }
};

// ==========================================
// JALANKAN SAAT HALAMAN DIMUAT
// ==========================================
loadData();