/**
 * Mengubah angka menjadi kalimat terbilang bahasa Indonesia untuk Kuitansi resmi
 * Contoh: 1250000 -> "Satu Juta Dua Ratus Lima Puluh Ribu Rupiah"
 */
export function terbilang(n: number): string {
  if (n === 0) return 'Nol Rupiah';
  if (n < 0) return 'Minus ' + terbilang(Math.abs(n));

  const bilangan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];

  function convert(x: number): string {
    if (x < 12) {
      return bilangan[x];
    } else if (x < 20) {
      return convert(x - 10) + ' Belas';
    } else if (x < 100) {
      return convert(Math.floor(x / 10)) + ' Puluh ' + convert(x % 10);
    } else if (x < 200) {
      return 'Seratus ' + convert(x - 100);
    } else if (x < 1000) {
      return convert(Math.floor(x / 100)) + ' Ratus ' + convert(x % 100);
    } else if (x < 2000) {
      return 'Seribu ' + convert(x - 1000);
    } else if (x < 1000000) {
      return convert(Math.floor(x / 1000)) + ' Ribu ' + convert(x % 1000);
    } else if (x < 1000000000) {
      return convert(Math.floor(x / 1000000)) + ' Juta ' + convert(x % 1000000);
    } else if (x < 1000000000000) {
      return convert(Math.floor(x / 1000000000)) + ' Milyar ' + convert(x % 1000000000);
    }
    return '';
  }

  const result = convert(Math.floor(n)).replace(/\s+/g, ' ').trim();
  return result + ' Rupiah';
}
