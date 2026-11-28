// "Lihat data terakhir" (iPhone, owner's decision of 26 Nov 2026, C2): below a required update the user may
// look at the data kept on the phone, read-only, with no request of any kind to anywhere: no sync, no keeper,
// no NEOSIA visit, no Sipakamase read, no public data. Reminders already scheduled still come. There is no
// way back to normal use without updating: the flag lives for this run only, and the next start shows the
// required-update screen again. Every path that could send something asks here first.
let readOnly = false;

export const isReadOnly = (): boolean => readOnly;

export function enterReadOnly(): void {
  readOnly = true;
}
