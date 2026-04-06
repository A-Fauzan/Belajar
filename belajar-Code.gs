// ╔══════════════════════════════════════════════════════════╗
// ║  Tracker Belajar 16 Minggu — Python/GIS/Data            ║
// ║  Google Apps Script API                                  ║
// ╚══════════════════════════════════════════════════════════╝

const SPREADSHEET_ID = "ISI_ID_GOOGLE_SHEET_KAMU";
const SECRET_KEY     = "belajar-fauzan-itb-rahasia";
const SHEET_SESI     = "sesi";
const SHEET_KURIKULUM= "kurikulum";

const KURIKULUM_DEFAULT = [
  [1,"Pandas Dasar","Pandas, DataFrame, read_csv, filtering, groupby"],
  [2,"Pandas Lanjutan","Merge, pivot, apply, lambda, handling missing data"],
  [3,"Visualisasi Data","Seaborn, Matplotlib, plot types, styling"],
  [4,"GeoPandas Dasar","GeoDataFrame, shapefile, CRS, spatial join"],
  [5,"GeoPandas Lanjutan","Buffer, overlay, dissolve, clip, spatial analysis"],
  [6,"Folium & Web Map","Interactive map, markers, choropleth, plugins"],
  [7,"SQL Spatial","PostGIS, spatial query, ST_functions, QGIS DB"],
  [8,"Review & Mini Project","Integrasi Weeks 1-7, mini project portfolio"],
  [9,"Python Scripting GIS","ArcPy / PyQGIS, automation, batch processing"],
  [10,"API & Web Scraping","requests, BeautifulSoup, REST API, JSON parsing"],
  [11,"Raster Processing","rasterio, numpy, band math, zonal statistics"],
  [12,"Machine Learning GIS","scikit-learn, clustering spatial, klasifikasi lahan"],
  [13,"Dashboard Streamlit","Streamlit app, deploy, interaktif visualisasi"],
  [14,"Freelance Portfolio","GitHub Pages, README, dokumentasi project"],
  [15,"Studi Kasus Nyata","End-to-end project dari data mentah ke produk"],
  [16,"Final Project","Freelance-ready portfolio project, presentasi"],
];

function doGet(e) {
  const p        = (e && e.parameter) ? e.parameter : {};
  const action   = p.action   || "ping";
  const callback = p.callback || "";

  if (action !== "ping" && p.key !== SECRET_KEY)
    return respond({ error:"Unauthorized" }, callback);

  let result;
  try {
    if      (action === "ping")            result = { status:"ok" };
    else if (action === "get_kurikulum")   result = getKurikulum();
    else if (action === "get_sesi")        result = getSesi();
    else if (action === "add_sesi")        result = addSesi(p);
    else if (action === "delete_sesi")     result = deleteSesi(p.id);
    else if (action === "get_stats")       result = getStats();
    else result = { error:"Unknown action" };
  } catch(err) {
    result = { error:err.message };
  }
  return respond(result, callback);
}

function doPost(e) { return doGet(e); }

// ── KURIKULUM ─────────────────────────────────────────────────

function getKurikulum() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_KURIKULUM);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_KURIKULUM);
    sheet.appendRow(["minggu","judul","topik"]);
    sheet.getRange(1,1,1,3).setFontWeight("bold");
    sheet.getRange(2,1,KURIKULUM_DEFAULT.length,3).setValues(KURIKULUM_DEFAULT);
  }
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2,1,last-1,3).getValues()
    .filter(r=>r[0])
    .map(r=>({ minggu:Number(r[0]), judul:r[1], topik:r[2] }));
}

// ── SESI BELAJAR ──────────────────────────────────────────────

function getSesiSheet() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_SESI);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SESI);
    sheet.appendRow(["id","tanggal","minggu","slot","durasi_menit","topik_bahasan","catatan","mood"]);
    sheet.getRange(1,1,1,8).setFontWeight("bold");
  }
  return sheet;
}

function getSesi() {
  const sheet = getSesiSheet();
  const last  = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2,1,last-1,8).getValues()
    .filter(r=>r[0])
    .map(r=>({
      id:Number(r[0]), tanggal:tglStr(r[1]),
      minggu:Number(r[2]), slot:r[3],
      durasi_menit:Number(r[4]), topik_bahasan:r[5],
      catatan:r[6], mood:r[7]
    })).sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal));
}

function addSesi(p) {
  const sheet = getSesiSheet();
  const last  = sheet.getLastRow();
  const ids   = last < 2 ? [] : sheet.getRange(2,1,last-1,1).getValues().flat().map(Number).filter(n=>n>0);
  const newId = ids.length ? Math.max(...ids)+1 : 1;
  const today = p.tanggal || fmtDate(new Date());
  sheet.appendRow([newId, today, Number(p.minggu)||1,
    p.slot||"pagi", Number(p.durasi_menit)||30,
    p.topik_bahasan||"", p.catatan||"", p.mood||"semangat"]);
  return { success:true, id:newId };
}

function deleteSesi(id) {
  const sheet = getSesiSheet();
  const last  = sheet.getLastRow();
  if (last < 2) return { error:"Tidak ada data" };
  const ids = sheet.getRange(2,1,last-1,1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === Number(id)) { sheet.deleteRow(i+2); return {success:true}; }
  }
  return { error:"ID tidak ditemukan" };
}

function getStats() {
  const sesi = getSesi();
  const totalMenit  = sesi.reduce((s,r)=>s+r.durasi_menit,0);
  const totalSesi   = sesi.length;
  const byMinggu    = {};
  sesi.forEach(r=>{ byMinggu[r.minggu]=(byMinggu[r.minggu]||0)+r.durasi_menit; });

  // Streak — hitung hari berturut-turut
  const dates = [...new Set(sesi.map(r=>r.tanggal))].sort().reverse();
  let streak = 0;
  const today = fmtDate(new Date());
  for (let i = 0; i < dates.length; i++) {
    const d  = new Date(dates[i]);
    const t  = new Date(today);
    const diff = Math.round((t - d) / 86400000);
    if (diff === i || diff === i+1) streak++;
    else break;
  }

  // Progress per minggu (selesai = ada sesi)
  const mingguSelesai = Object.keys(byMinggu).map(Number);

  return {
    total_menit: totalMenit, total_sesi: totalSesi,
    streak_hari: streak, minggu_aktif: mingguSelesai,
    by_minggu: byMinggu, total_jam: Math.round(totalMenit/60*10)/10
  };
}

function tglStr(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v,"Asia/Jakarta","yyyy-MM-dd");
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10);
  return s.substring(0,10);
}
function fmtDate(d) { return Utilities.formatDate(d,"Asia/Jakarta","yyyy-MM-dd"); }
function respond(data, callback) {
  const json = JSON.stringify(data);
  const out  = callback ? callback+"("+json+")" : json;
  return ContentService.createTextOutput(out)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
