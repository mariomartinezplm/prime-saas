// Generador de CSV escrito a mano — mismo criterio que sanitizeMongo/escapeHtml
// (Paso 06): es un formato simple, una dependencia menos por algo así.
function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(','));
  return lines.join('\r\n');
}
