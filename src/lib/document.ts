// CPF/CNPJ: só dígitos no banco; máscara e validação dos dígitos verificadores na tela.
export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function maskDocument(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

function allSame(d: string) { return /^(\d)\1+$/.test(d); }

function cpfOk(d: string) {
  if (d.length !== 11 || allSame(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== Number(d[n])) return false;
  }
  return true;
}

function cnpjOk(d: string) {
  if (d.length !== 14 || allSame(d)) return false;
  for (const n of [12, 13]) {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * w[i];
    const r = sum % 11;
    const dv = r < 2 ? 0 : 11 - r;
    if (dv !== Number(d[n])) return false;
  }
  return true;
}

export function isValidDocument(v: string) {
  const d = onlyDigits(v);
  return d.length === 11 ? cpfOk(d) : d.length === 14 ? cnpjOk(d) : false;
}

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isValidPhone = (v: string) => { const d = onlyDigits(v); return d.length === 10 || d.length === 11; };
