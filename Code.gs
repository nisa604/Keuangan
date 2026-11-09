/**
 * Aplikasi keuangan sederhana
 * - Menerima transaksi dari halaman web dan menyimpannya ke Google Sheet
 * - Setiap tanggal 25 mengirim laporan ke email
 *
 * Pasang di: Google Sheet > Ekstensi > Apps Script (script harus terikat ke Sheet).
 */

const CONFIG = {
  TOKEN: 'GANTI_DENGAN_KATA_SANDI_PANJANG', // bebas, minimal 16 karakter; sama dengan yang diisi di halaman web
  EMAIL_TO: '',                             // kosong = email akun Google kamu
  SHEET: 'Transaksi',
  CUTOFF_DAY: 25                            // periode laporan: tanggal 26 bulan lalu s.d. tanggal 25
};

/* ---------- Jalankan SEKALI: buat sheet + jadwal tanggal 25 ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'Dicatat']);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('dd/MM/yyyy');
    sh.getRange('D:D').setNumberFormat('#,##0');
  }
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'sendMonthlyReport'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendMonthlyReport')
    .timeBased().onMonthDay(CONFIG.CUTOFF_DAY).atHour(8).create();
}

/* ---------- Web app: terima transaksi ---------- */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== CONFIG.TOKEN) return json_({ ok: false, error: 'Kata sandi salah' });

    const nominal = Number(d.nominal);
    const jenisValid = d.jenis === 'Pemasukan' || d.jenis === 'Pengeluaran';
    if (!d.tanggal || !jenisValid || !d.kategori || !(nominal > 0)) {
      return json_({ ok: false, error: 'Data belum lengkap' });
    }

    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET);
    const p = String(d.tanggal).split('-').map(Number);
    const tgl = new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
    sh.appendRow([
      tgl,
      d.jenis,
      String(d.kategori).slice(0, 50),
      nominal,
      String(d.catatan || '').slice(0, 200),
      new Date()
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- Web app: ringkasan periode berjalan ---------- */
function doGet(e) {
  if (!e.parameter || e.parameter.token !== CONFIG.TOKEN) {
    return json_({ ok: false, error: 'Kata sandi salah' });
  }
  const period = currentPeriod_(new Date());
  const rows = readRows_();
  const inPeriod = rows.filter(function (r) { return r.tanggal >= period.start && r.tanggal <= period.end; });
  const s = summarize_(inPeriod);
  const recent = rows.slice(-10).reverse().map(function (r) {
    return {
      tanggal: Utilities.formatDate(r.tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      jenis: r.jenis, kategori: r.kategori, nominal: r.nominal, catatan: r.catatan
    };
  });
  return json_({
    ok: true,
    periode: periodLabel_(period),
    masuk: s.masuk, keluar: s.keluar, saldo: s.saldo,
    recent: recent
  });
}

/* ---------- Laporan email (dipicu tanggal 25, bisa juga dijalankan manual untuk tes) ---------- */
function sendMonthlyReport() {
  const period = currentPeriod_(new Date());
  const rows = readRows_().filter(function (r) { return r.tanggal >= period.start && r.tanggal <= period.end; });
  const s = summarize_(rows);
  const label = periodLabel_(period);

  const catRows = s.kategori.map(function (k) {
    const pct = s.keluar > 0 ? Math.round(k.total / s.keluar * 100) : 0;
    return '<tr><td style="padding:6px 0">' + esc_(k.nama) + '</td>' +
      '<td style="padding:6px 0;text-align:right">' + rp_(k.total) + '</td>' +
      '<td style="padding:6px 0;text-align:right;color:#666">' + pct + '%</td></tr>';
  }).join('');

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:520px;color:#13201C">' +
    '<h2 style="margin:0 0 4px">Laporan keuangan</h2>' +
    '<p style="margin:0 0 16px;color:#5C6B66">' + esc_(label) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' +
    '<tr><td style="padding:6px 0">Pemasukan</td><td style="text-align:right;color:#0B7A62"><b>' + rp_(s.masuk) + '</b></td></tr>' +
    '<tr><td style="padding:6px 0">Pengeluaran</td><td style="text-align:right;color:#B3254B"><b>' + rp_(s.keluar) + '</b></td></tr>' +
    '<tr style="border-top:1px solid #ccc"><td style="padding:8px 0"><b>Saldo periode ini</b></td><td style="text-align:right"><b>' + rp_(s.saldo) + '</b></td></tr>' +
    '</table>' +
    '<h3 style="margin:0 0 6px">Pengeluaran per kategori</h3>' +
    (catRows ? '<table style="width:100%;border-collapse:collapse">' + catRows + '</table>'
             : '<p style="color:#666">Belum ada pengeluaran di periode ini.</p>') +
    '<p style="margin-top:20px;color:#666;font-size:12px">' + rows.length + ' transaksi tercatat.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: CONFIG.EMAIL_TO || Session.getEffectiveUser().getEmail(),
    subject: 'Laporan keuangan ' + label,
    htmlBody: html
  });
}

/* ---------- Pembantu ---------- */
// Periode berakhir di tanggal CUTOFF_DAY: tgl 26 bulan sebelumnya s.d. tgl 25 (23:59:59).
function currentPeriod_(ref) {
  const y = ref.getFullYear(), m = ref.getMonth(), c = CONFIG.CUTOFF_DAY;
  if (ref.getDate() <= c) {
    return { start: new Date(y, m - 1, c + 1, 0, 0, 0), end: new Date(y, m, c, 23, 59, 59) };
  }
  return { start: new Date(y, m, c + 1, 0, 0, 0), end: new Date(y, m + 1, c, 23, 59, 59) };
}

function periodLabel_(p) {
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(p.start, tz, 'd MMM yyyy') + ' - ' + Utilities.formatDate(p.end, tz, 'd MMM yyyy');
}

function readRows_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues()
    .map(function (v) {
      return { tanggal: v[0], jenis: v[1], kategori: v[2], nominal: Number(v[3]) || 0, catatan: v[4] };
    })
    .filter(function (r) { return r.tanggal instanceof Date && !isNaN(r.tanggal); });
}

function summarize_(rows) {
  let masuk = 0, keluar = 0;
  const perKat = {};
  rows.forEach(function (r) {
    if (r.jenis === 'Pemasukan') masuk += r.nominal;
    else if (r.jenis === 'Pengeluaran') {
      keluar += r.nominal;
      perKat[r.kategori] = (perKat[r.kategori] || 0) + r.nominal;
    }
  });
  const kategori = Object.keys(perKat)
    .map(function (n) { return { nama: n, total: perKat[n] }; })
    .sort(function (a, b) { return b.total - a.total; });
  return { masuk: masuk, keluar: keluar, saldo: masuk - keluar, kategori: kategori };
}

function rp_(n) {
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
