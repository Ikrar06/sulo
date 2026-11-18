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

/**
 * optional_host_permissions in the manifest; asked for together with
 * "scripting". Only the app's pages: the scripts read responses the app
 * requested itself, so the API host needs no permission (and Sulo never
 * requests it).
 */
export const NEOSIA_HOST_PERMISSIONS = [NEOSIA_APP_MATCH] as const;

/** Message type from the page-world script to the bridge. A new version means a new baseline. */
export const CAPTURE_TYPE = 'sulo:capture:v1';
/**
 * Bumped whenever a projection changes. Snapshots of another version are
 * ignored until NEOSIA is opened again (M7.1 fix: transcripts captured with
 * the pre-observation projection had no course names and read as empty).
 * 2: allowlist locked to the observation (18 Nov 2026), semesters[].id added.
 */
export const CAPTURE_SCHEMA_VERSION = 2;

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
 * name them (tested), and the projector skips them even if one did. Taken
 * from the owner's observation of 18 Nov 2026 (docs/sumber/neosia-observasi.md).
 */
export const DROPPED_FIELDS = [
  'mahasiswa',
  'identitas',
  'nama_mahasiswa',
  'nim',
  'nik',
  'nisn',
  'nip',
  'nidn',
  'nuptk',
  'id_user',
  'jalan',
  'rt',
  'rw',
  'dusun',
  'kelurahan',
  'kode_pos',
  'id_wilayah',
  'tempat_lahir',
  'tanggal_lahir',
  'jenis_kelamin',
  'id_agama',
  'whatsapp',
  'spp',
  'alamat',
  'email',
  'no_hp',
  'hp',
  'telepon',
  'nomor_telepon',
  'fax',
  'kontak',
  'nama_ibu',
  'nilai_angka',
  'total_nilai',
  'nominal',
  'tagihan',
  'biaya',
  'bank',
  'sumber_biaya',
  'no_rekening',
  'virtual_account',
  'survey_url',
  'token',
  'is_research_track',
  'jalur_penelitian',
  'is_jalur_penelitian',
] as const;

/**
 * A projection: which keys of a response are kept.
 * - 'v': a primitive (string, number, boolean, null); objects are dropped
 * - [spec]: a list, each item projected with spec
 * - { key: spec }: an object; unnamed keys are dropped. Two special keys:
 *   '*' projects every key that is a plain number or short code (semester maps),
 *   '$v' also keeps the value itself when it is a primitive.
 * - { $sum: 'a.b.c' }: a number computed on the page, the sum of every
 *   number at that path from the parent object (lists are walked), e.g.
 *   credits from mata_kuliah.mata_kuliah_jumlah_skses[].jumlah_sks.
 */
export type SumSpec = { readonly $sum: string };
export type FieldSpec = 'v' | SumSpec | readonly [FieldSpec] | { readonly [key: string]: FieldSpec };

export const isSumSpec = (spec: FieldSpec): spec is SumSpec => typeof spec === 'object' && !Array.isArray(spec) && typeof (spec as { $sum?: unknown }).$sum === 'string';

const SEMESTER = { kode: 'v', jenis: 'v', tahun: 'v', tahun_ajaran: 'v', is_active: 'v' } as const;
const MATA_KULIAH = { kode: 'v', nama_resmi: 'v', nama_singkat: 'v', sifat: 'v', semester: 'v', mata_kuliah_sifat: { nama: 'v' } } as const;
const SKS_SUM = { $sum: 'mata_kuliah.mata_kuliah_jumlah_skses.jumlah_sks' } as const;
/** Days and times, the room's code and name; capacity, phone, notes and ids are dropped. */
const JADWAL = [{ day_of_week: 'v', start_time: 'v', end_time: 'v', ruang: { kode: 'v', nama: 'v' } }] as const;
/** One class: its name ("A"), whether it was cancelled, the course, credits, meetings and lecturer names only. */
const KELAS = { nama: 'v', is_batal: 'v', sks: SKS_SUM, mata_kuliah: MATA_KULIAH, jadwal_kuliahs: JADWAL, dosens: [{ nama: 'v' }] } as const;
const INDEKS_PRESTASI = { semester_tahun_ajaran: 'v', indeks_prestasi_semester: 'v', indeks_prestasi_kumulatif: 'v', jumlah_sks: 'v' } as const;

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
  | 'check_survey_status';

export interface Endpoint {
  id: EndpointId;
  /** The full path from the API root (query ignored); up to two id segments may follow. */
  path: string;
  spec: FieldSpec;
}

/**
 * Locked to the owner's observation of 18 Nov 2026. The academic advisor
 * endpoint was never seen and is not listed (docs/NEOSIA.md, "ditunda").
 */
export const ENDPOINTS: readonly Endpoint[] = [
  {
    id: 'belanja_krs',
    path: 'api/mahasiswa/belanja_krs',
    // kartu_rencana_studi.mahasiswa (identity, address, birth date, contacts) is never named.
    spec: { kartu_rencana_studi: { is_approved: 'v', is_locked: 'v', is_current: 'v', prodi_semester: { semester: { kode: 'v', jenis: 'v', tahun_ajaran: 'v' } }, kelas_kuliahs: [KELAS] } },
  },
  {
    id: 'max_sks',
    path: 'api/mahasiswa/belanja_krs/max_sks',
    spec: {
      max_sks: 'v',
      limits: { total: 'v', face_to_face: 'v', non_face_to_face: 'v' },
      current_sks: { total: 'v', face_to_face: 'v', non_face_to_face: 'v', available: 'v' },
      context: { student_level: 'v', current_semester: 'v', rules_applied: ['v'] },
    },
  },
  {
    id: 'checkJadwalBelanjaKRS',
    path: 'api/mahasiswa/belanja_krs/checkJadwalBelanjaKRS',
    // Several windows (filling in, changes); `message` is free server text and not kept.
    spec: { status: 'v', prodiSemesterJadwalKrses: [{ tanggal_mulai: 'v', tanggal_berakhir: 'v', semester_tipe_jadwal: { name: 'v', caption: 'v' } }] },
  },
  {
    id: 'kelas_kuliah_tersedia',
    path: 'api/mahasiswa/belanja_krs/kelas_kuliah_tersedia',
    // Kept with its capture time for the future schedule planner. Never
    // compared, watched or notified (project rule 13). {n} is the curriculum semester.
    spec: {
      semesters: {
        '*': [{ ...KELAS, peserta_disetujui_count: 'v', peserta_belum_disetujui_count: 'v', max_participant: 'v', mata_kuliah: { ...MATA_KULIAH, mata_kuliah_prasyarats: [{ kode: 'v' }] } }],
      },
    },
  },
  {
    id: 'prodi_semester/active',
    path: 'api/mahasiswa/prodi_semester/active',
    spec: { activeProdiSemester: { is_active: 'v', semester: SEMESTER } },
  },
  {
    id: 'dashboard',
    path: 'api/mahasiswa/dashboard',
    // identitas (name, student number, programme) is never named.
    spec: { indeks_prestasi: { ipk: 'v', jumlah_sks_dilulusi: 'v' }, masa_studi: { maksimal: 'v', sisa: 'v' }, pembayaran: { sudah_bayar: 'v' } },
  },
  {
    id: 'getTranskripMahasiswa',
    path: 'api/mahasiswa/transkrip/getTranskripMahasiswa',
    spec: {
      transkrip: [{ kode_mata_kuliah: 'v', nama_mata_kuliah: 'v', sks: 'v', nilai_huruf: 'v', id_semester: 'v', is_used: 'v', is_alih_kredit: 'v', is_manual: 'v', is_locked: 'v' }],
      current_indeks_prestasi: INDEKS_PRESTASI,
    },
  },
  { id: 'indeks_prestasi/current', path: 'api/mahasiswa/indeks_prestasi/current', spec: { currentIndeksPrestasi: INDEKS_PRESTASI } },
  {
    id: 'kartu_hasil_studi/semester',
    path: 'api/mahasiswa/kartu_hasil_studi/semester',
    // indeks_prestasi is kept only when it is an object of this shape (observed without keys).
    spec: { kartu_hasil_studi: [{ nilai_huruf: 'v', source: 'v', sks: SKS_SUM, mata_kuliah: { kode: 'v', nama_resmi: 'v' } }], indeks_prestasi: INDEKS_PRESTASI },
  },
  // semesters[].id is the semester's own id (what transcript rows point to with id_semester), never a person's.
  { id: 'mahasiswa/semester', path: 'api/mahasiswa/semester', spec: { semesters: [{ id: 'v', ...SEMESTER }] } },
  // is_filled only: survey_url is never named.
  { id: 'check_survey_status', path: 'api/mahasiswa/check_survey_status', spec: { is_filled: 'v' } },
];

/**
 * Seen in the owner's observation but not projected yet ("observasi"): only
 * development builds read these, to list their key names (never values).
 * Other builds do not read them at all. Once the key names are known, the
 * academic advisor's projection keeps the name and titles only.
 */
export const OBSERVE_ONLY: readonly { id: string; path: string }[] = [{ id: 'getCurrentPenasihatAkademik', path: 'api/mahasiswa/penasihat_akademik/getCurrentPenasihatAkademik' }];

/** Wrapper keys a response may put its payload under. */
export const UNWRAP_KEYS = ['data', 'result', 'results'] as const;
