// ==========================================
// 1. KONFIGURASI FIREBASE (SAMAKAN DENGAN ADMIN)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyB9D9e0-_wUEkzuwfek-0gpfOEqFSbJssE",
  authDomain: "sedekah-003.firebaseapp.com",
  projectId: "sedekah-003",
  storageBucket: "sedekah-003.firebasestorage.app",
  messagingSenderId: "761180083609",
  appId: "1:761180083609:web:99d8ef58d157ba34692f08",
  measurementId: "G-NY2MSH0C6P"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

document.addEventListener('DOMContentLoaded', function() {
    
    // --- AOS & UI ELEMENTS ---
    if (typeof AOS !== 'undefined') AOS.init({ once: true, offset: 50, duration: 800 });

    // --- RENDER DATA DARI FIREBASE ---
    const programGrid = document.getElementById('programGrid');
    
    db.ref('program').on('value', (snapshot) => {
        programGrid.innerHTML = '';
        let totalDana = 0;
        let countProgram = 0;

        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const data = child.val();
                countProgram++;
                totalDana += (data.terkumpul || 0);

                const progress = data.target > 0 ? (data.terkumpul / data.target) * 100 : 0;
                
                const card = document.createElement('div');
                card.className = "bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group";
                card.innerHTML = `
                    <div class="relative h-56 overflow-hidden bg-gray-200">
                        <img src="https://images.unsplash.com/photo-1542810634-71277d95dcbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Program" class="w-full h-full object-cover">
                        <div class="absolute top-4 left-4 bg-white px-3 py-1 text-xs font-semibold text-emerald-600 rounded-full shadow-sm">${data.kategori}</div>
                    </div>
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2 line-clamp-2">${data.nama}</h3>
                        <p class="text-gray-500 text-sm mb-4 line-clamp-2">${data.deskripsi || ''}</p>
                        <div class="mb-4">
                            <div class="flex justify-between text-sm mb-1 font-medium">
                                <span class="text-emerald-600">Rp ${data.terkumpul?.toLocaleString('id-ID') || 0}</span>
                                <span class="text-gray-500">${progress.toFixed(0)}%</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div class="bg-emerald-500 h-2 rounded-full" style="width: ${progress}%"></div>
                            </div>
                        </div>
                        <button class="w-full bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 font-semibold py-3 rounded-xl transition-colors">Donasi Sekarang</button>
                    </div>
                `;
                programGrid.appendChild(card);
            });
        }
        
        // Update statistik di Hero section secara otomatis
        const statDana = document.getElementById('stat-dana');
        const statProgram = document.getElementById('stat-program');
        if(statDana) statDana.setAttribute('data-target', (totalDana / 1000000).toFixed(1));
        if(statProgram) statProgram.setAttribute('data-target', countProgram);
    });

    // --- FUNGSI LAIN (Counter, Navbar, Chart) ---
    // (Tambahkan fungsi Counter dan Chart dari kode sebelumnya di sini)
    // ...
});