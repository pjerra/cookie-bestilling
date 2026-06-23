/**
 * Milla's Chunky Cookies – cookie-bestilling backend (Google Apps Script)
 * =========================================================================
 * Gir nettsiden delt status (åpen/stengt), automatisk utsolgt-grense,
 * bestillingslagring, venteliste og bildegalleri – alt styrt fra regnearket
 * og en Google Drive-mappe.
 *
 * OPPSETT (gjøres én gang – se README.md for klikk-for-klikk):
 *   1. Lim hele denne fila inn i Apps Script-editoren (Extensions → Apps Script).
 *   2. Fyll inn BILDE_MAPPE_ID og VARSEL_EPOST under.
 *   3. Kjør funksjonen settUppRegneark() én gang (lager arkfanene automatisk).
 *   4. Deploy → New deployment → Web app → "Execute as: Me",
 *      "Who has access: Anyone". Kopier web-app-URL-en inn i index.html (CONFIG).
 * ========================================================================= */

// ============== KONFIG (fyll inn) ==============
const SHEET_ID = '';          // La stå TOM hvis du åpnet Apps Script fra regnearket (Utvidelser → Apps Script). Ellers: lim inn regnearkets ID eller hele URL-en.
const BILDE_MAPPE_ID = '';    // <-- ID-en til Google Drive-mappen med bilder (delt "alle med lenken kan se").
const VARSEL_EPOST = '';      // <-- e-post som varsles ved ny bestilling. Tom = ingen varsling.

const ARK = {
  innstillinger: 'Innstillinger',
  innhold: 'Innhold',
  bestillinger: 'Bestillinger',
  venteliste: 'Venteliste',
};

// =========================================================================
//  WEB-APP ENDEPUNKTER
// =========================================================================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'images') return jsonOut(listImages());
  return jsonOut(buildStatus());
}

function doPost(e) {
  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, reason: 'Ugyldig forespørsel.' });
  }
  if (data.website) return jsonOut({ ok: true }); // honeypot – ignorer bots stille
  if (data.action === 'order') return handleOrder(data);
  if (data.action === 'waitlist') return handleWaitlist(data);
  return jsonOut({ ok: false, reason: 'Ukjent handling.' });
}

// =========================================================================
//  STATUS
// =========================================================================
function buildStatus() {
  const s = getSettings();
  const innhold = getContent();
  const cap = parseInt(s.maks_pakker, 10) || 0;
  const ordered = sumOrdered();
  const remaining = cap > 0 ? Math.max(0, cap - ordered) : null;
  let status = normalizeStatus(s.status);

  // Automatisk utsolgt når grensen er nådd (selv om hun har satt "åpen").
  if (status === 'BESTILLING_ÅPEN' && remaining !== null && remaining <= 0) {
    status = 'UTSOLGT';
  }

  return {
    status: status,
    capacity: cap || null,
    remaining: remaining,
    ordered: ordered,
    pris: parseInt(s.pris_per_pakke, 10) || 149,
    neste_batch: s.neste_batch || '',
    vipps: s.vipps_nummer || '',
    hentested: s.hentested || '',
    hentetid: s.hentetid || '',
    innhold: innhold,
  };
}

function normalizeStatus(raw) {
  const v = (raw || '').toString().trim().toUpperCase();
  if (v.indexOf('DIREKTE') > -1 || v === 'LIVE') return 'DIREKTESALG';
  if (v.indexOf('UTSOLGT') > -1 || v.indexOf('SOLD') > -1) return 'UTSOLGT';
  if (v.indexOf('ÅPEN') > -1 || v.indexOf('APEN') > -1 || v.indexOf('OPEN') > -1 || v === 'JA' || v === 'TRUE') return 'BESTILLING_ÅPEN';
  return 'BESTILLING_STENGT';
}

// =========================================================================
//  BESTILLING
// =========================================================================
function handleOrder(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // hindrer at to samtidige bestillinger sniker seg forbi grensen
  } catch (e) {
    return jsonOut({ ok: false, reason: 'Mange bestiller akkurat nå – prøv igjen om et øyeblikk.' });
  }
  try {
    const s = getSettings();
    const status = normalizeStatus(s.status);
    const cap = parseInt(s.maks_pakker, 10) || 0;
    const ordered = sumOrdered();
    const remaining = cap > 0 ? Math.max(0, cap - ordered) : null;
    const pris = parseInt(s.pris_per_pakke, 10) || 149;
    const antall = Math.max(1, parseInt(data.antall, 10) || 1);

    if (status !== 'BESTILLING_ÅPEN') {
      return jsonOut({ ok: false, reason: 'Bestillingen er dessverre stengt akkurat nå.' });
    }
    if (remaining !== null && remaining <= 0) {
      return jsonOut({ ok: false, reason: 'Akkurat utsolgt! Sett deg på ventelisten 🔔' });
    }
    if (remaining !== null && antall > remaining) {
      return jsonOut({ ok: false, reason: 'Bare ' + remaining + ' pakker igjen. Juster antallet og prøv igjen.' });
    }

    const navn = (data.navn || '').toString().trim().slice(0, 80);
    const telefon = (data.telefon || '').toString().trim().slice(0, 30);
    const kommentar = (data.kommentar || '').toString().trim().slice(0, 300);
    if (!navn || !telefon) {
      return jsonOut({ ok: false, reason: 'Fyll ut navn og telefon.' });
    }

    book().getSheetByName(ARK.bestillinger).appendRow([new Date(), navn, telefon, antall, kommentar, 'Ny']);
    notify(navn, telefon, antall, kommentar);

    return jsonOut({ ok: true, total: antall * pris, vipps: s.vipps_nummer || '', antall: antall });
  } finally {
    lock.releaseLock();
  }
}

function handleWaitlist(data) {
  const navn = (data.navn || '').toString().trim().slice(0, 80);
  const kontakt = (data.kontakt || '').toString().trim().slice(0, 120);
  if (!navn || !kontakt) {
    return jsonOut({ ok: false, reason: 'Fyll ut navn og kontakt.' });
  }
  book().getSheetByName(ARK.venteliste).appendRow([new Date(), navn, kontakt]);
  return jsonOut({ ok: true });
}

function notify(navn, telefon, antall, kommentar) {
  if (!VARSEL_EPOST) return;
  try {
    MailApp.sendEmail({
      to: VARSEL_EPOST,
      subject: '🍪 Ny bestilling: ' + antall + ' pakke(r) – ' + navn,
      body: 'Navn: ' + navn + '\nTelefon: ' + telefon + '\nAntall pakker: ' + antall +
        '\nKommentar: ' + (kommentar || '-') + '\n\nSe regnearket for full oversikt.',
    });
  } catch (e) {
    // svelg feil – bestillingen skal lagres selv om e-post feiler
  }
}

// =========================================================================
//  BILDER (Google Drive-mappe)
// =========================================================================
function listImages() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('images');
  if (hit) return JSON.parse(hit);

  const out = [];
  if (BILDE_MAPPE_ID) {
    try {
      const files = DriveApp.getFolderById(BILDE_MAPPE_ID).getFiles();
      while (files.hasNext()) {
        const f = files.next();
        if ((f.getMimeType() || '').indexOf('image/') !== 0) continue;
        out.push({
          url: 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1200',
          caption: cleanCaption(f.getName()),
          name: f.getName(),
        });
      }
    } catch (e) {
      // ugyldig mappe-ID e.l. – returner tom liste
    }
  }
  out.sort(function (a, b) { return a.name.localeCompare(b.name, 'no'); });
  cache.put('images', JSON.stringify(out), 120); // 2 min cache for fart/kvote
  return out;
}

function cleanCaption(filename) {
  const base = (filename || '').replace(/\.[^.]+$/, '');
  // Ikke vis bildetekst for typiske kamera-/skjermdumpnavn
  if (/^(img[_-]?\d|dsc[_-]?\d|pxl[_-]?\d|photo|bilde|screenshot|skjermbilde|\d{6,})/i.test(base)) return '';
  return base.replace(/[_-]+/g, ' ').trim();
}

// =========================================================================
//  HJELPEFUNKSJONER
// =========================================================================
function book() {
  if (!SHEET_ID) return SpreadsheetApp.getActiveSpreadsheet();
  // Godta både ren ID og full URL (henter ut ID-en fra .../d/<ID>/edit)
  const m = String(SHEET_ID).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return SpreadsheetApp.openById(m ? m[1] : SHEET_ID);
}

function kv(sheetName) {
  const sh = book().getSheetByName(sheetName);
  const obj = {};
  if (!sh) return obj;
  const rows = sh.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    const k = (rows[i][0] || '').toString().trim();
    if (k && k.toLowerCase() !== 'nøkkel') obj[k] = rows[i][1] !== undefined ? rows[i][1] : '';
  }
  return obj;
}

function getSettings() { return kv(ARK.innstillinger); }
function getContent() { return kv(ARK.innhold); }

function sumOrdered() {
  const sh = book().getSheetByName(ARK.bestillinger);
  if (!sh) return 0;
  const data = sh.getDataRange().getValues();
  let sum = 0;
  for (let i = 1; i < data.length; i++) {
    const v = parseInt(data[i][3], 10); // kolonne D = antall_pakker
    if (!isNaN(v)) sum += v;
  }
  return sum;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
//  ENGANGS-OPPSETT  – kjør denne én gang fra editoren
// =========================================================================
function settUppRegneark() {
  const ss = book();

  // --- Innstillinger ---
  const innst = ensureSheet(ss, ARK.innstillinger, ['Nøkkel', 'Verdi']);
  seedKeyValues(innst, [
    ['status', 'BESTILLING_STENGT'],   // BESTILLING_ÅPEN | BESTILLING_STENGT | DIREKTESALG | UTSOLGT
    ['maks_pakker', 60],
    ['pris_per_pakke', 149],
    ['neste_batch', 'Neste parti kommer snart!'],
    ['vipps_nummer', '123 45 678'],
    ['hentested', 'Hentested oppgis ved bestilling'],
    ['hentetid', 'Etter avtale'],
  ]);

  // --- Innhold (all tekst på siden) ---
  const innhold = ensureSheet(ss, ARK.innhold, ['Nøkkel', 'Verdi']);
  seedKeyValues(innhold, [
    ['firmanavn', "Milla's Chunky Cookies"],
    ['slagord', 'Ferske, hjemmebakte cookies – bakt med kjærlighet, i små partier.'],
    ['produkt_beskrivelse', 'Hver cookie er bakt for hånd hjemme, i små partier, med gode råvarer og mye kjærlighet. Vi baker bare et begrenset antall om gangen – derfor selges det ofte ut. Sikre deg dine mens du kan!'],
    ['direktesalg_tekst', 'Vi har ferske cookies klare for direktesalg. Først til mølla!'],
    ['facebook_url', 'https://www.facebook.com/share/18V1gV2x8j/'],
  ]);

  // --- Bestillinger ---
  ensureSheet(ss, ARK.bestillinger, ['Tidspunkt', 'Navn', 'Telefon', 'Antall pakker', 'Kommentar', 'Status']);

  // --- Venteliste ---
  ensureSheet(ss, ARK.venteliste, ['Tidspunkt', 'Navn', 'Kontakt']);

  // --- Bakeliste (lettlest oversikt, oppdateres automatisk) ---
  lagBakeliste(ss);

  SpreadsheetApp.getActiveSpreadsheet().toast('Oppsett ferdig! Fanene er klare.', "Milla's Chunky Cookies", 5);
}

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function seedKeyValues(sheet, pairs) {
  // legg bare til nøkler som ikke finnes fra før (overskriver ikke hennes endringer)
  const existing = {};
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const k = (data[i][0] || '').toString().trim();
    if (k) existing[k] = true;
  }
  pairs.forEach(function (p) {
    if (!existing[p[0]]) sheet.appendRow(p);
  });
}

// =========================================================================
//  BAKELISTE  – lettlest oversikt over bestillinger (oppdateres automatisk)
//  Kan kjøres direkte fra editoren, eller blir laget av settUppRegneark().
// =========================================================================
function lagBakeliste(ss) {
  ss = ss || book();
  let sh = ss.getSheetByName('Bakeliste');
  if (!sh) sh = ss.insertSheet('Bakeliste');
  sh.clear();

  sh.getRange('A1').setValue('🍪 BAKELISTE').setFontSize(16).setFontWeight('bold');
  sh.getRange('A2').setValue('Pakker å bake:').setFontWeight('bold');
  sh.getRange('B2').setFormula('=SUM(Bestillinger!D2:D)');
  sh.getRange('A3').setValue('Cookies totalt:').setFontWeight('bold');
  sh.getRange('B3').setFormula('=SUM(Bestillinger!D2:D)*2');
  sh.getRange('A4').setValue('Antall bestillinger:').setFontWeight('bold');
  sh.getRange('B4').setFormula('=COUNTA(Bestillinger!B2:B)');

  sh.getRange('A6:D6')
    .setValues([['Navn', 'Antall pakker', 'Telefon', 'Kommentar']])
    .setFontWeight('bold').setBackground('#F4E9D8');
  sh.getRange('A7').setFormula(
    '=IFERROR(QUERY(Bestillinger!A2:F, "select B, D, C, E where B is not null order by A"), "Ingen bestillinger ennå")'
  );

  sh.setColumnWidth(1, 170);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 280);
  sh.setFrozenRows(6);
}
