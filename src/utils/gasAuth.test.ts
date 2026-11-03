import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGasResponse, DEFAULT_GAS_URL, GAS_CODE_TEMPLATE } from './gasAuth';

test('DEFAULT_GAS_URL is set to the unified Master Database Apps Script endpoint', () => {
  assert.equal(
    DEFAULT_GAS_URL,
    'https://script.google.com/macros/s/AKfycbwf4HgF7IVU7Hthn_fqlruBTdEwOvkcP6BEE5YXCvLSCKVFtGNtsBtIirJk8a39q4AV/exec'
  );
});

test('GAS_CODE_TEMPLATE defines 6_AKUN_APLIKASI columns with Kolom F as NAMA UPT', () => {
  assert.ok(GAS_CODE_TEMPLATE.includes('6_AKUN_APLIKASI'));
  assert.ok(GAS_CODE_TEMPLATE.includes('Kolom A: ID'));
  assert.ok(GAS_CODE_TEMPLATE.includes('Kolom B: Nama'));
  assert.ok(GAS_CODE_TEMPLATE.includes('Kolom C: Username'));
  assert.ok(GAS_CODE_TEMPLATE.includes('Kolom D: Password'));
  assert.ok(GAS_CODE_TEMPLATE.includes('Kolom E: Role'));
  assert.ok(GAS_CODE_TEMPLATE.includes('Kolom F: NAMA UPT'));
  assert.ok(GAS_CODE_TEMPLATE.includes('Kolom G: Waktu_Dibuat'));
});

test('parseGasResponse handles successful JSON response from Google Apps Script and validates NAMA UPT', () => {
  const jsonSuccess = JSON.stringify({
    status: 'success',
    user: {
      id: 'usr-123',
      name: 'PRISILIA DEBORA MANGKANG, S.Pd',
      username: 'smpn2touluaan',
      role: 'Operator BOSP',
      namaUpt: 'SMP NEGERI 2 TOULUAAN',
      createdAt: '2026-01-01',
    },
  });

  const result = parseGasResponse(jsonSuccess, 'SMP NEGERI 2 TOULUAAN');
  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user?.name, 'PRISILIA DEBORA MANGKANG, S.Pd');
  assert.equal(result.user?.schoolName, 'SMP NEGERI 2 TOULUAAN');
  assert.equal(result.user?.role, 'Operator BOSP');

  // Mismatched UPT from Kolom F should be rejected
  const mismatch = parseGasResponse(jsonSuccess, 'SMP NEGERI 1 RATAHAN');
  assert.equal(mismatch.success, false);
  assert.ok(mismatch.error?.includes('SMP NEGERI 2 TOULUAAN'));
});

test('parseGasResponse handles error status from Google Apps Script', () => {
  const jsonError = JSON.stringify({
    status: 'error',
    message: 'Kata sandi tidak cocok di Google Spreadsheet.',
  });

  const result = parseGasResponse(jsonError);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Kata sandi tidak cocok di Google Spreadsheet.');
});

test('parseGasResponse detects missing doPost deployment in Google Apps Script', () => {
  const rawHtmlError = '<html><body><div>Script function not found: doPost</div></body></html>';
  const result = parseGasResponse(rawHtmlError);
  assert.equal(result.success, false);
  assert.equal(result.isGasScriptError, true);
  assert.ok(result.error?.includes('doPost(e)'));
});
