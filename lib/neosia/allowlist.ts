// The one source of truth for the NEOSIA module (docs/NEOSIA.md, project
// rules 12 to 15): hosts, endpoint paths, the fields kept and the fields
// dropped. Plain data with no imports, because the page-world capture
// script (entrypoints/neosia-main.ts) bundles it and must stay
// dependency-free. Tested in tests/neosia-allowlist.test.ts.

/** The NEOSIA app's pages: where the two content scripts run. */
export const NEOSIA_APP_ORIGIN = 'https://neosia.unhas.ac.id';
export const NEOSIA_APP_MATCH = 'https://neosia.unhas.ac.id/*';
/** The only host whose responses are ever looked at. */
export const NEOSIA_API_HOST = 'api.neosia.unhas.ac.id';

/** optional_host_permissions in the manifest; asked for together with "scripting". */
export const NEOSIA_HOST_PERMISSIONS = [NEOSIA_APP_MATCH, `https://${NEOSIA_API_HOST}/*`] as const;

/** Message type from the page-world script to the bridge. A new version means a new baseline. */
export const CAPTURE_TYPE = 'sulo:capture:v1';
export const CAPTURE_SCHEMA_VERSION = 1;

/**
 * Largest capture message the bridge and the service worker accept, in
 * characters of its JSON (256 KiB). The largest projection expected, every
 * class on offer in kelas_kuliah_tersedia, is far below it.
 */
export const MAX_MESSAGE_CHARS = 262_144;
/** Responses longer than this (characters) are not parsed at all (unknown_shape). */
export const MAX_RESPONSE_CHARS = 8_000_000;
/** Projection limits: list items, string length, nesting. */
export const MAX_ITEMS = 400;
export const MAX_STRING = 200;
export const MAX_DEPTH = 8;

/**
 * Never read: a response from these paths is skipped before it is parsed.
 * survey_url is never read either: no projection names it.
 */
export const NEVER_READ_PATHS = ['mahasiswa/mahasiswa', 'pengunduran-diri-semester'] as const;

/**
 * Fields that never leave the page, wherever they appear. No projection may
 * name them (tested), and the projector skips them even if one did.
 */
export const DROPPED_FIELDS = [
  'mahasiswa',
  'nim',
  'nik',
  'nisn',
  'nip',
  'nidn',
  'nuptk',
  'nilai_angka',
  'total_nilai',
  'nominal',
  'jumlah',
  'jumlah_bayar',
  'tagihan',
  'biaya',
  'bank',
  'nama_bank',
  'no_rekening',
  'virtual_account',
  'alamat',
  'tanggal_lahir',
  'tempat_lahir',
  'email',
  'no_hp',
  'hp',
  'telepon',
  'kontak',
  'nama_ibu',
  'survey_url',
  'token',
  'jalur_penelitian',
  'is_jalur_penelitian',
] as const;

/**
 * A projection: which keys of a response are kept.
 * - 'v': a primitive (string, number, boolean, null); objects are dropped
 * - [spec]: a list, each item projected with spec
 * - { key: spec }: an object; unnamed keys are dropped. Two special keys:
 *   '*' projects every key that is a plain number or short code (semester maps),
 *   '$v' also keeps the value itself when it is a primitive (a room as text or object).
 */
export type FieldSpec = 'v' | readonly [FieldSpec] | { readonly [key: string]: FieldSpec };

const MATA_KULIAH = { kode: 'v', nama: 'v', sks: 'v' } as const;
const SEMESTER = { kode: 'v', nama: 'v', jenis: 'v', tahun_ajaran: 'v', id_semester: 'v' } as const;
const JADWAL = [{ day_of_week: 'v', start_time: 'v', end_time: 'v', ruang: { $v: 'v', nama: 'v', kode: 'v' } }] as const;
/** Lecturer names only; their NIP, NIDN and NUPTK are dropped. */
const DOSEN = [{ nama: 'v', gelar_depan: 'v', gelar_belakang: 'v' }] as const;
const KELAS = { kode: 'v', nama: 'v', nama_kelas: 'v', sks: 'v', sifat: 'v', mata_kuliah: MATA_KULIAH, jadwal_kuliahs: JADWAL, dosens: DOSEN } as const;
const NILAI = { kode: 'v', nama: 'v', sks: 'v', nilai_huruf: 'v', id_semester: 'v', is_used: 'v', is_alih_kredit: 'v', is_manual: 'v', mata_kuliah: MATA_KULIAH } as const;
const DOSEN_NAMA = { nama: 'v', gelar_depan: 'v', gelar_belakang: 'v' } as const;

export type EndpointId =
  | 'belanja_krs'
  | 'checkJadwalBelanjaKRS'
  | 'kelas_kuliah_tersedia'
  | 'max_sks'
  | 'dashboard'
  | 'prodi_semester/active'
  | 'getTranskripMahasiswa'
  | 'indeks_prestasi/current'
  | 'mahasiswa/semester'
  | 'kartu_hasil_studi/semester'
  | 'getCurrentPenasihatAkademik'
  | 'getStatusPembayaran'
  | 'check_survey_status';

export interface Endpoint {
  id: EndpointId;
  /** Path segments matched anywhere in the URL path (query ignored); up to two id segments may follow. */
  path: string;
  spec: FieldSpec;
  /**
   * Field names seen in the November observation (brief section 2.2) or
   * still a guess. Until the owner's dev-build check confirms them, features
   * built on a guessed endpoint say "Belum ada data dari NEOSIA".
   */
  verified: boolean;
}

export const ENDPOINTS: readonly Endpoint[] = [
  {
    id: 'belanja_krs',
    path: 'belanja_krs',
    // The response's `mahasiswa` object (national ID, address, birth date, contacts) is never named, so it never leaves the page.
    spec: { kartu_rencana_studi: { is_approved: 'v', is_locked: 'v', semester: SEMESTER, kelas_kuliahs: [KELAS] }, semester: SEMESTER },
    verified: true,
  },
  {
    id: 'checkJadwalBelanjaKRS',
    path: 'checkJadwalBelanjaKRS',
    // `message` is free text from the server and is not kept.
    spec: { status: 'v', prodiSemesterJadwalKrses: [{ tanggal_mulai: 'v', tanggal_berakhir: 'v', semester_tipe_jadwal: { name: 'v', caption: 'v' } }] },
    verified: true,
  },
  {
    id: 'kelas_kuliah_tersedia',
    path: 'kelas_kuliah_tersedia',
    // Capacity is kept with its capture time only; Sulo never watches it (project rule 13).
    spec: { semesters: { '*': [{ ...KELAS, max_participant: 'v' }] } },
    verified: true,
  },
  {
    id: 'max_sks',
    path: 'max_sks',
    spec: { max_sks: 'v', current_sks: { total: 'v', available: 'v' }, context: { current_semester: 'v', rules_applied: [{ $v: 'v', kode: 'v', nama: 'v', name: 'v' }] } },
    verified: true,
  },
  {
    id: 'dashboard',
    path: 'dashboard',
    spec: { indeks_prestasi: { ipk: 'v', jumlah_sks_dilulusi: 'v' }, masa_studi: { maksimal: 'v', sisa: 'v' } },
    verified: true,
  },
  { id: 'prodi_semester/active', path: 'prodi_semester/active', spec: { semester: SEMESTER, ...SEMESTER }, verified: true },
  {
    id: 'getTranskripMahasiswa',
    path: 'getTranskripMahasiswa',
    spec: { transkrip: [NILAI], current_indeks_prestasi: { ipk: 'v', ips: 'v', jumlah_sks: 'v' } },
    verified: true,
  },
  { id: 'indeks_prestasi/current', path: 'indeks_prestasi/current', spec: { ips: 'v', ipk: 'v', jumlah_sks: 'v', id_semester: 'v' }, verified: false },
  { id: 'mahasiswa/semester', path: 'mahasiswa/semester', spec: [{ ...SEMESTER, ips: 'v', ipk: 'v' }], verified: false },
  { id: 'kartu_hasil_studi/semester', path: 'kartu_hasil_studi/semester', spec: { kartu_hasil_studi: [NILAI], ips: 'v', ipk: 'v' }, verified: false },
  // The advisor's name only; the response's NIP is dropped.
  { id: 'getCurrentPenasihatAkademik', path: 'getCurrentPenasihatAkademik', spec: { ...DOSEN_NAMA, dosen: DOSEN_NAMA }, verified: false },
  // Paid or not, as a label; amounts and the bank are dropped.
  { id: 'getStatusPembayaran', path: 'getStatusPembayaran', spec: { status: 'v', status_pembayaran: 'v', is_lunas: 'v', lunas: 'v' }, verified: false },
  { id: 'check_survey_status', path: 'check_survey_status', spec: { is_filled: 'v' }, verified: true },
];

/** Wrapper keys a response may put its payload under. */
export const UNWRAP_KEYS = ['data', 'result', 'results'] as const;
