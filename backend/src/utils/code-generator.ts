// Generate kode unik 8 karakter alfanumerik
// Hindari karakter yang membingungkan: 0, O, 1, I, L
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateUniqueCode(length = 8): string {
  return Array.from(
    { length },
    () => CHARSET[Math.floor(Math.random() * CHARSET.length)]
  ).join('');
}