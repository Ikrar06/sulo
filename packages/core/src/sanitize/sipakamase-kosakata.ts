// Word lists for the Sipakamase page sanitizer (sanitize/sipakamase.ts).
//
// Two lists, both allowlists:
// - SAFE_CELLS: whole values a table cell or a form field may keep (statuses,
//   activity bases and kinds, MKPK course names). Activity kinds and course
//   names come from the official MKPK rubric (Rubrik Penilaian MKPK, 3rd ed.).
// - DICTIONARY: single words that may stay in running text (headings, labels,
//   buttons, rule text) and in script strings. Everything else is masked.
//
// Neither list holds a person's name, and words that double as common given
// names (Fajar, Putri, Satria, Sinta, Hasanuddin ...) are left out on purpose:
// losing a word in a fixture is cheap, keeping a name is not.

const MKPK_COURSES = [
  'Komunikasi dan Kerjasama', 'Manajemen Kegiatan', 'Strategi Negosiasi', 'Pembelajaran Aktif', 'Komunikasi Digital',
  'Empati Sosial', 'Keberagaman Budaya', 'Pengembangan Masyarakat', 'Kewirausahaan Rintisan', 'Kepemimpinan Inovatif',
  'Pengambilan Keputusan', 'Pemecahan Masalah', 'Etika Profesi', 'Berfikir Kritis dan Kreatif', 'Berpikir Kritis dan Kreatif',
  'Kreativitas Solutif', 'Inovasi dan Pemikiran Desain', 'Pengembangan Talenta', 'Literasi dan Presentasi Ilmiah',
  'Magang/Praktek Kerja', 'Studi/Proyek Independen', 'Riset Mandiri', 'Pengembangan Kreativitas dan Inovasi',
  'Kepemimpinan dan Karakter Bela Negara', 'Kemaslahatan Benua Maritim Indonesia (BMI)', 'Pengembangan dan Penguatan Kewirausahaan',
  'Praktek Dunia Usaha/Dunia Industri', 'Pengembangan Karakter Humanis', 'Komunikasi dan Interaksi Sosial',
];

const BASES = [
  'Kompetisi', 'Kewirausahaan', 'Keorganisasian', 'Kepesertaan', 'Pengabdian Masyarakat', 'Magang/Studi Independen',
  'Magang', 'Studi Independen', 'Publikasi Ilmiah', 'Pengembangan Minat dan Bakat', 'Minat dan Bakat',
];

const ACTIVITY_KINDS = [
  'Olimpiade Nasional MIPA (ONMIPA)', 'National University Debate Competition (NUDC)', 'Kompetisi Debat Mahasiswa Indonesia (KDMI)',
  'Pemilihan Mahasiswa Berprestasi (PILMAPRES)', 'Program Kreativitas Mahasiswa (PKM)', 'Pekan Ilmiah Mahasiswa Nasional (PIMNAS)',
  'Kontes Robot Indonesia (KRI)', 'Kontes Mobil Hemat Energi (KMHE)', 'Kontes Kapal Indonesia (KKI)', 'Kompetisi Jembatan Indonesia (KJI)',
  'Kompetisi Bangunan Gedung Indonesia (KBGI)', 'Kontes Robot Terbang Indonesia (KRTI)', 'Lomba Inovasi Digital Mahasiswa (LIDM)',
  'Program Penguatan Kapasitas Organisasi Mahasiswa (PPK ORMAWA)', "Musabaqah Tilawatil Qur'an (MTQ)",
  'Pagelaran Mahasiswa Nasional Bidang Teknologi Informasi dan Komunikasi (GEMASTIK)',
  'Kompetisi Mahasiswa Nasional Bidang Ilmu Bisnis, Manajemen dan Keuangan (KBMK)', 'Kompetisi Kemaritiman Mahasiswa Nasional (KKMN)',
  'Pekan Olahraga Provinsi (PORPROV)', 'Pekan Olahraga Mahasiswa Nasional (POMNAS)', 'Pekan Olahraga Nasional (PON)',
  'Pekan Seni Mahasiswa Nasional (PEKSIMINAS)', 'Pekan Seni Mahasiswa Daerah (PEKSIMIDA)', 'Lomba Paduan Suara Mahasiswa (LPSM)',
  'Pesta Paduan Suara Grejawi (PESPARAWI)', 'Lomba Mandiri', 'Lomba Mandiri Bidang Penalaran', 'Lomba Mandiri Bidang Seni dan Olahraga',
  'Pentas Seni (PENSI)', 'Unhas Freshmen Talent Competition (UFTC)', 'Kepesertaan Lomba Belmawa', 'Kepesertaan Lomba Belmawa dan Puspresnas',
  'Program Mahasiswa Wirausaha (PMW)', 'Program Pembinaan Mahasiswa Wirausaha (P2MW)', 'Wirausaha Mandiri',
  'Pelatihan', 'Sertifikasi Kompetensi', 'Pelatihan Terprogram', 'Lokakarya', 'Seminar', 'Konferensi Ilmiah', 'Kuliah Umum',
  'Kredensial Mikro', 'Pertukaran Mahasiswa', 'Short Course', 'Gerakan Unhas Mengkaji dan Shalat Berjamaah (GUMSB)',
  'Volunteer Event Terprogram', 'Volunteer Event Insidental', 'Volunteer Berketerampilan Khusus (Terprogram)',
  'Volunteer Berketerampilan Khusus (Insidental)', 'Pemberdayaan Masyarakat Terprogram', 'Bakti Sosial', 'Kegiatan Kemanusiaan',
  'Teknologi Tepat Guna', 'Menulis Opini', 'Karya Cipta', 'Karya Monumental', 'Menjadi Duta', 'Talent Academy',
  'Asisten Praktikum/Penelitian/Pengabdian', 'Mentor Kompetisi', 'Mentor Event Terprogram', 'Mentor MKPK', 'Master of Ceremony',
  'Content Creator', 'Satria Data',
];

const STATUSES = [
  'Terlaksana', 'Terencana', 'Selesai', 'Direncanakan', 'Diajukan', 'Diverifikasi', 'Terverifikasi', 'Belum Diverifikasi',
  'Menunggu', 'Menunggu Verifikasi', 'Disetujui', 'Ditolak', 'Revisi', 'Perlu Revisi', 'Direvisi', 'Proses', 'Diproses', 'Draft',
  'Dikirim', 'Terkirim', 'Belum Dikirim', 'Dikonversi', 'Belum Dikonversi', 'Diklaim', 'Belum Diklaim', 'Lulus', 'Belum Lulus',
  'Tidak Lulus', 'Valid', 'Tidak Valid', 'Aktif', 'Tidak Aktif', 'Reguler', 'MKPK', 'MBKM', 'MKPK/MBKM', 'RKL', 'Ya', 'Tidak',
  'Ada', 'Tidak Ada', 'Belum', 'Sudah', 'Belum Ada', 'Ganjil', 'Genap', 'Antara',
];

// Field labels and messages that sit in cells of key-value layouts and empty tables.
const LABELS = [
  'No', 'No.', 'Nomor', 'NIM', 'Nama', 'Nama Mahasiswa', 'Program Studi', 'Prodi', 'Fakultas', 'Email', 'E-mail', 'Nomor HP', 'No. HP',
  'No HP', 'Telepon', 'Angkatan', 'Semester', 'Basis', 'Kegiatan', 'Jenis Kegiatan', 'Nama Kegiatan', 'Pendamping Kegiatan',
  'Pendamping', 'Verifikator', 'Nilai', 'Nilai Di Neosia', 'Status', 'Aksi', 'Kode', 'Nama MK', 'SKS', 'Jenis MK', 'Mata Kuliah',
  'Matakuliah', 'Jumlah', 'Total', 'Keterangan', 'Catatan', 'Detail', 'Hapus', 'Edit', 'Ubah', 'Lihat', 'Unduh', 'Cetak', 'Klaim',
  'Konversi', 'Simpan', 'Batal', 'Kirim', 'Tambah', 'Pilih', 'Tutup', 'Belum ada data', 'Tidak ada data', 'Data tidak ditemukan',
  'Data kosong', 'No data available in table', 'No matching records found', 'Tidak ada data yang tersedia pada tabel ini',
  'Tidak ditemukan data yang sesuai', 'Loading...', 'Memuat...', 'Sedang memproses...',
];

/** Case, spacing and punctuation do not matter when a value is compared with the lists. */
export const normalize = (s: string): string => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{N}/'+&]+/gu, ' ').trim();

/** "Olimpiade Nasional MIPA (ONMIPA)" also allows the long form and the short form on their own. */
function withForms(entries: readonly string[]): string[] {
  return entries.flatMap((e) => {
    const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(e);
    return m ? [e, m[1]!, m[2]!] : [e];
  });
}

const BASIS_FORMS = BASES.flatMap((b) => [b, `Berbasis ${b}`, `Kegiatan Berbasis ${b}`, `Kegiatan ${b}`]);

export const SAFE_CELLS: ReadonlySet<string> = new Set(
  [...MKPK_COURSES, ...BASIS_FORMS, ...withForms(ACTIVITY_KINDS), ...STATUSES, ...LABELS].map(normalize),
);

/** A whole cell value that may stay as it is. */
export const isSafeCell = (value: string): boolean => SAFE_CELLS.has(normalize(value));

// Words that recur in the MKPK rubric (4 times or more), read through by hand.
const RUBRIC_WORDS = `
abdidaya academy activity ada adalah administrasi agar ajang akademik akan akhir aktif aktivitas akun anggota artikel asisten atas atau
award babak bagi bahan bahasa baik bakat bakti balik bangunan bela belajar belmawa belum bem bentuk berbadan berbagai berbasis berdasarkan
bereputasi berhak berhasil berikut berita berjamaah berkelanjutan berketerampilan berkomunikasi berkontribusi berpikir berprestasi bersama
bersertifikat bertujuan bidang big bisnis book budaya bukti bulan bulanan butir cakupan capaian catatan ceremony competition content course
creator cv daerah dalam dan dana dapat dari daring data debat debate delegasi dengan departemen desa desain deskripsi di diadakan diakui
didaftarkan didapat digital digunakan diimplementasikan diklaim dikonversi dilaksanakan dilakukan diperoleh dirancang direkognisi direktorat
diri disain diselenggarakan diskusi ditandatangani diterbitkan dll dokumen dokumentasi dosen dpl draft dunia durasi duta edukasi emas empati
energi evaluasi event fakultas fasilitator feedback file final finalis finalisasi freshmen gagasan gedung gemastik gerakan gumsb guna hal
hanya hari harus hasil hemat hingga hki honorable hours hukum huruf ide ii iii ilmiah ilmu independen indikator individu indonesia industri
informasi ini inovasi inovatif insidental instansi instruktur interaksi internal internasional intra itu ix jabatan jam jawab jejak jejaring
jembatan jenis jika juara juga jumlah juri jurnal kampus kanal kapal kapasitas kaprodi karakter karena kartu karya kasus kategori kbgi kbmk
kdmi ke kebutuhan kegiatan kehadiran keikutsertaan keilmuan kelompok kemahasiswaan kemajuan kemampuan kemampuannya kemanusiaan kemaritiman
kendaraan keorganisasian kepada kepanitiaan kepemimpinan kepengurusan kepesertaan keputusan kerja kerjasama keseluruhan ketentuan
keterampilan keterangan ketua keuangan kewirausahaan khusus kji kki kkmn kkn kluster kmhe kmi kode koefisien komentar kompetensi kompetisi
komprehensif komunikasi konferensi koni konsep konsultasi konten kontes konversi koordinasi kreatif kreativitas kredensial kri kriteria
kritis krti kuliah kurang laboratorium lain lainnya lanjut lapangan laporan latihan layar lebih legalitas lembaga lengkap level lidm lihat
lingkungan lingkup link literasi literatur log logbook lokakarya lokal lolos lomba lpsm luar luaran lulus lulusan luring magang mahasiswa
maka makalah maksimal mampu managerial manajemen mandiri masa masalah masing massa master masyarakat mata materi material maupun medali
media melaksanakan melakukan melalui meliputi memahami membangun membantu memberikan membuat memenangkan memenuhi memiliki memperoleh
mempersiapkan mempresentasikan menambah mencakup mendaftar mendapat mendapatkan mendorong mendukung mengembangkan menggagas menggunakan
menghadapi menghasilkan mengidentifikasi mengikuti mengimplementasikan mengkaji mengklaim meningkatkan menit menjadi menjalankan mention
mentor menulis menumbuhkembangkan menyelesaikan menyusun meraih merekognisi merujuk merupakan mewakili mikro minat minimal mipa mitra mkpk
mobil monumental mtq mtqm multicultural multidisiplin musabaqah mutu namun narasumber nasional naskah national negara negeri negosiasi nilai
no non nudc nyata observasi of olahraga oleh olimpiade onmipa onsite opini orang organisasi orientasi ormawa pada paduan pakar partisipasi
peer pekan peksimida peksiminas pelaksana pelaksanaan pelatih pelatihan peluang pemahaman pematangan pembekalan pembelajaran pembentukan
pemberdayaan pembicara pembimbing pembimbingan pembinaan pembuatan pemecahan pemerintah pemikiran pemilihan penalaran penanganan pendaftaran
pendalaman pendamping pendampingan pendanaan pendekatan pendidikan pendukung penelitian pengabdian pengakuan pengalaman pengali pengambilan
pengembangan pengenalan pengetahuan penggalian penggunaan penghargaan penguatan penilaian peningkatan penjajakan penjaringan pensi pentas
penugasan penulis penyelenggara penyempurnaan penyetaraan penyiapan penyisihan penyusunan perak perakitan peran perbaikan perencanaan
performa perguruan perhitungan periode permasalahan persen persentasi persiapan persyaratan pertama pertandingan pertemuan pertukaran
perunggu perwakilan peserta pesparawi pesta pihak pilmapres pimnas pimpinan pkm platform pmw pomnas pon porprov portofolio positif poster
potensi ppk ppko praktek praktik praktikum presensi presentasi presenter prestasi prodi produk produksi profesi profesional professional
program proposal proses prototipe prototype provinsi proyek publikasi pusat puspresnas regional rekaman rekognisi relevan resmi review
rintisan riset robot ruang rubrik rumah salah sama satu screen screenshoot sebagai sebuah secara sehingga selain selama seleksi selesai
seluruh semifinal seminar seni seorang seperti serta sertifikasi sertifikat sesi sesuai setelah setiap setingkat shalat short simulasi
singkat sistem sk skala skill skor sks soft sosial sosialisasi statistics strategi studi suara suasana suatu sub subaktivitas subkegiatan
submit substansi subtotal sudah surat syarat tabel tahap tahapan tahun talent talenta tambahan tangkapan tantangan teknik teknologi telah
tentang tepat terbaik terbang terbit terdapat terekam terhadap terjadi terkait termasuk terpenuhi terprogram tersebut tetapi tidak
tilawatil tim tinggi tingkat total transkrip tuan tugas tujuan tutor uftc ujian umpan umum unhas universitas university unsur untuk upaya
upload usaha usulan utama video viii visitasi volume volunteer wasit wawasan wilayah wirausaha workshop yaitu yang
`;

// Function words and the words an academic system's interface is made of.
const INTERFACE_WORDS = `
adanya ajaran ajukan akses aksi alamat alasan alokasi alur anda angkatan angka antara apa apabila apakah aplikasi aturan awal bagaimana bagian
bahwa banyak bantuan baris baru batal batalkan batas bawah beberapa belum benar beranda berakhir berapa berhasil berikutnya berkas berlaku
besar biasa bila bisa boleh buka bukan cara cari cetak contoh daftar dahulu datang demikian depan detail dialokasikan diajukan dibatalkan
diberikan dibuat dibuka diganti dihapus diisi dikirim dikirimkan dilihat dilulusi dimana diminta diperbarui diperiksa diperlukan
diprogram diprogramkan direncanakan direvisi diproses disetujui disimpan ditampilkan ditolak ditutup diubah diunggah diverifikasi dua dulu
edit email empat enam entri format gagal gambar ganjil ganti genap halaman harap hapus hp ia identitas informasi ingin isi isian jadwal
jangan jawaban judul kali kami kamu kapan kata kecil kedua keluar kembali kemudian kenapa kesalahan ketiga ketika khs kirim kita klaim klik
kolom konfirmasi kosong kps krs kurikulum lagi lalu lama lampiran langkah langsung lanjutkan lima lokasi maaf mana manual masih masuk masukkan
matakuliah mau mbkm melihat memilih meminta memproses memuat menambah menambahkan mencetak mengajukan mengalokasikan mengapa mengenai
mengirim mengisi menghapus mengubah mengunduh mengunggah menu menunggu menyimpan mereka minggu misalnya mk mohon mulai nama neosia nim nip
nomor notifikasi otomatis pa paling panduan para password pembaruan pemberitahuan pencarian pengajuan pengaturan pengguna pengisian
penting per perhatian peringatan perlu perubahan pertanyaan petunjuk pilih pilihan poin profil rekap rekapitulasi reguler rencana revisi
rincian riwayat rkl saat saja sampai sandi saya sebagian sebelum sebelumnya sebentar sedang sedangkan sedikit sejak sekarang selamat
selanjutnya sembilan sembunyikan semester semua sendiri sepuluh sikola silahkan silakan simpan sipakamase skpi status sukses supaya tahap
tambah tambahkan tampilkan tanggal tanpa tanya tapi tautan tekan telepon tema tempat tenggat terakhir terencana terima terkirim terlaksana
terverifikasi tiap tiga tipe tujuh tunggu tutup ubah ukuran unduh unggah uraian urutan valid validasi verifikasi verifikator versi wajib
waktu ya yakin yakni dibuang komentar sintetis teks centang dialog folder form formulir ikon jendela kb kotak maks mb panah tanda tombol
`;

// English interface words and the vocabulary of markup, styles and scripts.
const TECH_WORDS = `
a about accept action active add admin adminlte ajax alert align all an and animation app append application apps are area aria array as
asset assets async at attr auto autocomplete awesome back backdrop background badge bar base before begin between bg blank block body bold
bootstrap border bordered bottom box br breadcrumb btn bundle button by cache call callback cancel caption card cdn cell center change
charset check checkbox checked child children class clear click close code col collapse color cols column columns com common complete
config confirm console const container contents control controller cookie copy copyright core count create css csrf current custom danger
dark dashboard datatable datatables date day default defer delete description destroy device dialog disabled dismiss display dist div do
document dom done down download dropdown each edit element else empty en enable end entries equiv error es even exit expanded false fa fab
fade fail far fas field fields filter filtered find first fixed flex float fluid focus font fonts footer for form found from full function
get github google gray green grid group h handler has hash head header height help hidden hide home horizontal host hover href html http
https i icon icons id if image images img in index info init initial inline inner input is item items javascript jpeg jpg jquery js json
key keydown keyup label lang language large last layout left length let lg li lib libs light line link list load loaded loader loading
local location lock login logo logout lte main margin matching max maximum md me media menu message meta method min mm modal mode model
module more ms msg muted name nav navbar navigation net new next no none noopener noreferrer normal not null number of off offset ok on
only open option options or order org out outline overflow padding page pagination panel param params parent path pdf php placeholder
please plugin plugins png pointer popover position post prepend prev preventdefault previous primary processing progress prop public push
px query radio readonly ready record records red ref refresh rel reload remove replace request required reserved reset response
responsive result results return right rights role root row rows save scale script scroll search secondary section select selected self
send server session set settings show showing shown sidebar sign size sm small sort source span src stack start state static step store
string striped style success sure svg swal sweetalert tab tabindex table target tbody td template text textarea th the thead theme themes
then this time timeout timer title to toggle token tooltip top total tr transition true type ul undefined up update url urlencoded use
user utf util utils val value var vendor vendors version vertical view viewport visible wait warning was web white widget width window
with wrap wrapper www x xl xs y yes you your zero
abbr absolute address arial article aside audio autofocus blockquote canvas capitalize cellpadding cellspacing cite colgroup colspan cursor
dashed decoration del details embed enctype example family fieldset figcaption figure helvetica iframe important inherit ins invalid italic
kbd legend lowercase mark meter multipart multiple noscript novalidate nowrap object onchange onclick onsubmit opacity optgroup output
picture radius relative roboto rowspan samp sans serif shadow solid strong stylesheet sub summary sup tfoot track transform underline
uppercase valign video wbr weight
`;

// Everyday Indonesian the pages' rule text and forms are likely to use. No given names.
const GENERAL_WORDS = `
agama agenda akibat akhirnya apalagi artinya asli bahkan balas balasan beasiswa beban beda bebas benar berarti berbeda berjalan berjumlah
berkaitan berlangsung bersangkutan bertanya betul biasanya biaya biodata bobot buruk capai cek cepat cukup cuti darah dekan demi diagram
dianjurkan dibolehkan dicek dihitung dihubungi diizinkan dijadwalkan dijawab dijelaskan dijumlahkan dikonfirmasi dikumpulkan dikunci
dikurangi dilampirkan dilangsungkan dilaporkan dilarang dilengkapi dimohon dimulai diperbaiki diperbolehkan dipilih diploma direktorat
disarankan diselesaikan disertakan disertasi ditambah diterima diulang divalidasi ekuivalen ekuivalensi fisik foto gelar golongan grafik
gratis habis hendak hendaknya herregistrasi hitung hubungan hubungi hybrid ijazah indeks ipk ips izin jarang jelas jenjang jurusan
kadaluarsa kadang kaitan kalender kanan kecuali kedaluwarsa kekurangan kelamin kelas kelebihan kelengkapan kelulusan kesesuaian
ketersediaan kiri kontak kota kredit kritik kumulatif kunci kunjungi lahir laki lambat lambatnya lampirkan lengkapi lewat macam maksimum
maksud masukan mekanisme melampirkan melaporkan melengkapi melewati memasukkan membalas membuka memeriksa memperbaiki memperbarui
memvalidasi memverifikasi mencapai mencukupi menekan menerima mengecek menghitung menghubungi mengklik mengonfirmasi mengonversi mengulang
mengumpulkan mengunjungi menjawab menjelaskan menolak menutup menyertakan menyetujui merencanakan meskipun metode minimum muka mungkin
nonaktif offline online operator opsional panggilan pascasarjana pasti pembaharuan pembatasan pembayaran pembukaan pemeriksaan pencapaian
penasihat penerimaan pengumpulan pengumuman pengurangan penjadwalan penjelasan penolakan penutupan penyelesaian percakapan perbarui
perbedaan perempuan perihal periksa peringkat perkembangan perkuliahan permanen pernah persetujuan pertengahan pesan piagam pindai pkl pos
posisi pria pribadi progres prosedur pukul ragam rangkuman realisasi registrasi rektor ruangan salinan samping saran sarjana scan sebab
sebaiknya sebanyak sebesar segera seharusnya sejenis sekolah sekurang selalu selambat seluruhnya sementara semestinya senilai serupa
sertakan setara setidaknya sedikitnya sering sisa skripsi strata subjek subkategori tampilan target tatap tengah tentu teralokasi
terbatas terbuka tercapai terealisasi terhapus terhitung terjawab terkunci terlambat terpilih tersedia tersimpan tersisa tertutup tesis
tetap topik ukt ulang unduhan unggahan virtual wakil walaupun wanita wisuda yudisium
`;

// Sipakamase's own route and menu names, from the owner's notes (docs/mkpk).
const SITE_WORDS = 'caktifitasmahasiswa caktifitas ckonversimhs cklaim cqa cskpi rekappoin rekappoinmbkm qa terencana p2mw k23';

const words = (list: string): string[] => list.split(/\s+/).filter(Boolean);

/** Every word of the safe values is a safe word too. */
const fromCells = [...MKPK_COURSES, ...BASIS_FORMS, ...ACTIVITY_KINDS, ...STATUSES, ...LABELS]
  .flatMap((e) => e.toLowerCase().split(/[^\p{L}\p{N}]+/u))
  // "Satria Data" is safe as a whole cell, but Satria on its own is a given name.
  .filter((w) => w.length >= 2 && w !== 'satria' && !/^\d+$/.test(w));

export const DICTIONARY: ReadonlySet<string> = new Set([...words(RUBRIC_WORDS), ...words(INTERFACE_WORDS), ...words(TECH_WORDS), ...words(GENERAL_WORDS), ...words(SITE_WORDS), ...fromCells]);
