import { SchoolExpense, SchoolInfo, Triwulan, BarangEkstraItem } from '../types';
import { expensesToSheetRows, generateSummarySheetRows, sheetRowsToExpenses } from '../utils/googleSheetsFormatter';
import { 
  buildPanelAdminSheetRows, 
  buildRekapanDinasSheetRows, 
  buildBelanjaPersediaanSheetRows, 
  buildBelanjaPemeliharaanSheetRows, 
  buildBarangEkstraSheetRows,
  buildAkunAplikasiSheetRows,
  parseMasterSheetsMap,
  ParseMasterDatabaseResult
} from '../utils/databaseSpreadsheet';
import { loadUptSchools } from '../data/schoolData';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface SheetMetadata {
  id: string;
  title: string;
  sheets: Array<{
    sheetId: number;
    title: string;
  }>;
  spreadsheetUrl: string;
}

/**
 * List spreadsheets from the user's Google Drive.
 */
export async function listSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=20&fields=files(id, name, modifiedTime, webViewLink)`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal mengambil daftar spreadsheet dari Google Drive: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Fetch spreadsheet metadata including sheet tabs.
 */
export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string): Promise<SheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title))`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal mengakses Google Spreadsheet (${spreadsheetId}): ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return {
    id: data.spreadsheetId,
    title: data.properties?.title || 'BOSP Spreadsheet',
    sheets: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
    })),
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
}

/**
 * Creates a brand new Google Spreadsheet configured specifically for BOSP.
 * Tabs: 6 Master Database Sheets + 'Ringkasan Pagu', 'Semua Belanja', 'TW1', 'TW2', 'TW3', 'TW4'.
 */
export async function createBospSpreadsheet(
  accessToken: string,
  schoolInfo: SchoolInfo,
  expenses: SchoolExpense[],
  barangEkstraItems: BarangEkstraItem[] = []
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const title = `DATABASE BOSP - ${schoolInfo.namaSekolah} - TA ${schoolInfo.tahunAnggaran}`;

  const requestBody = {
    properties: {
      title,
    },
    sheets: [
      { properties: { title: '1_PANEL_ADMIN_UPT', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: '2_REKAPAN_SE_DINAS', gridProperties: { frozenRowCount: 3 } } },
      { properties: { title: '3_BELANJA_PERSEDIAAN', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: '4_BELANJA_PEMELIHARAAN', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: '5_BARANG_EKSTRA', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: '6_AKUN_APLIKASI', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Ringkasan Pagu', gridProperties: { frozenRowCount: 7 } } },
      { properties: { title: 'Semua Belanja', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW1', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW2', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW3', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'TW4', gridProperties: { frozenRowCount: 1 } } },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat Google Spreadsheet baru: ${createRes.status} ${errText}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Populate data into the newly created spreadsheet
  await syncExpensesToSpreadsheet(accessToken, spreadsheetId, schoolInfo, expenses, barangEkstraItems);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Pushes/Syncs all expenses, admin panel, rekap se dinas, accounts, and database sheets into the specified Google Spreadsheet.
 */
export async function syncExpensesToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  schoolInfo: SchoolInfo,
  expenses: SchoolExpense[],
  barangEkstraItems: BarangEkstraItem[] = []
): Promise<{ updatedCells: number }> {
  const meta = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const existingTabTitles = meta.sheets.map((s) => s.title);

  const requiredTabs = [
    '1_PANEL_ADMIN_UPT',
    '2_REKAPAN_SE_DINAS',
    '3_BELANJA_PERSEDIAAN',
    '4_BELANJA_PEMELIHARAAN',
    '5_BARANG_EKSTRA',
    '6_AKUN_APLIKASI',
    'Ringkasan Pagu',
    'Semua Belanja',
    'TW1',
    'TW2',
    'TW3',
    'TW4'
  ];
  const missingTabs = requiredTabs.filter((tab) => !existingTabTitles.includes(tab));

  if (missingTabs.length > 0) {
    const addSheetRequests = missingTabs.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            frozenRowCount: title === 'Ringkasan Pagu' ? 7 : title === '2_REKAPAN_SE_DINAS' ? 3 : 1,
          },
        },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: addSheetRequests }),
    });
  }

  const masterSchools = loadUptSchools();

  const panelAdminRows = buildPanelAdminSheetRows(masterSchools, expenses, schoolInfo);
  const rekapDinasRows = buildRekapanDinasSheetRows(masterSchools, expenses, schoolInfo);
  const persediaanRows = buildBelanjaPersediaanSheetRows(expenses, schoolInfo);
  const pemeliharaanRows = buildBelanjaPemeliharaanSheetRows(expenses, schoolInfo);
  const barangEkstraRows = buildBarangEkstraSheetRows(barangEkstraItems, schoolInfo);
  const akunRows = buildAkunAplikasiSheetRows(masterSchools);

  const summaryRows = generateSummarySheetRows(schoolInfo, expenses);
  const allExpenseRows = expensesToSheetRows(expenses);

  const quarters: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];
  const dataPayload: Array<{ range: string; values: (string | number)[][] }> = [
    {
      range: `'1_PANEL_ADMIN_UPT'!A1:Q${Math.max(panelAdminRows.length, 50)}`,
      values: panelAdminRows,
    },
    {
      range: `'2_REKAPAN_SE_DINAS'!A1:ZZ${Math.max(rekapDinasRows.length, 50)}`,
      values: rekapDinasRows,
    },
    {
      range: `'3_BELANJA_PERSEDIAAN'!A1:AD${Math.max(persediaanRows.length, 100)}`,
      values: persediaanRows,
    },
    {
      range: `'4_BELANJA_PEMELIHARAAN'!A1:U${Math.max(pemeliharaanRows.length, 100)}`,
      values: pemeliharaanRows,
    },
    {
      range: `'5_BARANG_EKSTRA'!A1:P${Math.max(barangEkstraRows.length, 100)}`,
      values: barangEkstraRows,
    },
    {
      range: `'6_AKUN_APLIKASI'!A1:P${Math.max(akunRows.length, 100)}`,
      values: akunRows,
    },
    {
      range: `'Ringkasan Pagu'!A1:Z50`,
      values: summaryRows,
    },
    {
      range: `'Semua Belanja'!A1:U${Math.max(allExpenseRows.length, 100)}`,
      values: allExpenseRows,
    },
  ];

  quarters.forEach((tw) => {
    const twExpenses = expenses.filter((e) => e.triwulan === tw);
    const twRows = expensesToSheetRows(twExpenses);
    dataPayload.push({
      range: `'${tw}'!A1:U${Math.max(twRows.length, 100)}`,
      values: twRows,
    });
  });

  const batchUpdateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: dataPayload,
    }),
  });

  if (!batchUpdateRes.ok) {
    const errText = await batchUpdateRes.text();
    throw new Error(`Gagal menyinkronkan data ke Google Sheets: ${batchUpdateRes.status} ${errText}`);
  }

  const result = await batchUpdateRes.json();
  return { updatedCells: result.totalUpdatedCells || 0 };
}

/**
 * Fetches all master database tabs ('1_PANEL_ADMIN_UPT', '2_REKAPAN_SE_DINAS', '3_BELANJA_PERSEDIAAN',
 * '4_BELANJA_PEMELIHARAAN', '5_BARANG_EKSTRA', '6_AKUN_APLIKASI', and 'Semua Belanja') from Google Spreadsheet.
 */
export async function fetchMasterDatabaseFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  schoolInfo: SchoolInfo
): Promise<ParseMasterDatabaseResult> {
  const meta = await getSpreadsheetDetails(accessToken, spreadsheetId);
  if (!meta.sheets || meta.sheets.length === 0) {
    throw new Error('Spreadsheet tidak memiliki lembar sheet yang valid.');
  }

  const rangesParams = meta.sheets
    .map((s) => `ranges=${encodeURIComponent(`'${s.title}'!A1:ZZ1000`)}`)
    .join('&');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParams}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membaca data dari Google Sheets: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const valueRanges: Array<{ range: string; values?: any[][] }> = data.valueRanges || [];
  const sheetsMap: Record<string, any[][]> = {};

  valueRanges.forEach((vr, idx) => {
    const sheetTitle = meta.sheets[idx]?.title || vr.range.split('!')[0].replace(/^'|'$/g, '');
    sheetsMap[sheetTitle] = vr.values || [];
  });

  const parsed = parseMasterSheetsMap(sheetsMap, schoolInfo);

  // If no expenses were found in 3_BELANJA_PERSEDIAAN / 4_BELANJA_PEMELIHARAAN, check 'Semua Belanja'
  if (parsed.importedExpenses.length === 0) {
    const semuaBelanjaRows = sheetsMap['Semua Belanja'] || sheetsMap[meta.sheets[0].title] || [];
    const fallbackExpenses = sheetRowsToExpenses(semuaBelanjaRows);
    if (fallbackExpenses.length > 0) {
      parsed.importedExpenses = fallbackExpenses;
      parsed.persediaanCount = fallbackExpenses.length;
    }
  }

  return parsed;
}

/**
 * Legacy helper for importing expenses from Google Spreadsheet.
 */
export async function fetchExpensesFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  schoolInfo?: SchoolInfo
): Promise<SchoolExpense[]> {
  if (schoolInfo) {
    const res = await fetchMasterDatabaseFromSpreadsheet(accessToken, spreadsheetId, schoolInfo);
    return res.importedExpenses;
  }
  const meta = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const targetTab = meta.sheets.find((s) => s.title === 'Semua Belanja') || meta.sheets[0];

  if (!targetTab) {
    throw new Error('Spreadsheet tidak memiliki lembar sheet yang valid.');
  }

  const range = `'${targetTab.title}'!A1:U1000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membaca data dari Google Sheets: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const rows = data.values || [];
  return sheetRowsToExpenses(rows);
}

