// Indicatori che si aggiungono dal menu (utente 30/10: "indicatori principali vari, anche se poi non credo che li userò"):
// calcolati nella pagina sui prezzi veri della candela. Ogni funzione rende array lunghi come l'ingresso, null dove manca.
export function sma(v, n) {
  let s = 0;
  return v.map((x, i) => { s += x; if (i >= n) s -= v[i - n]; return i >= n - 1 ? s / n : null; });
}

export function ema(v, n) {
  const a = 2 / (n + 1);
  let e = null;
  return v.map((x, i) => { e = e === null ? x : e + a * (x - e); return i >= n - 1 ? e : null; });
}

export function bollinger(v, n, k = 2) {
  const media = sma(v, n), su = [], giu = [];
  for (let i = 0; i < v.length; i++) {
    if (media[i] === null) { su.push(null); giu.push(null); continue; }
    let q = 0;
    for (let j = i - n + 1; j <= i; j++) q += (v[j] - media[i]) ** 2;
    const d = Math.sqrt(q / n);
    su.push(media[i] + k * d); giu.push(media[i] - k * d);
  }
  return { media, su, giu };
}

// RSI di Wilder
export function rsi(v, n = 14) {
  const out = v.map(() => null);
  let su = 0, giu = 0;
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1], a = Math.max(d, 0), b = Math.max(-d, 0);
    if (i <= n) { su += a / n; giu += b / n; } else { su = (su * (n - 1) + a) / n; giu = (giu * (n - 1) + b) / n; }
    if (i >= n) out[i] = giu === 0 ? 100 : 100 - 100 / (1 + su / giu);
  }
  return out;
}

export function macd(v, a = 12, b = 26, c = 9) {
  const ea = ema(v, a), eb = ema(v, b);
  const linea = v.map((_, i) => ea[i] === null || eb[i] === null ? null : ea[i] - eb[i]);
  const primo = linea.findIndex(x => x !== null);
  const segnale = linea.map(() => null);
  if (primo >= 0) ema(linea.slice(primo), c).forEach((x, i) => { segnale[primo + i] = x; });
  return { linea, segnale, ist: linea.map((x, i) => x === null || segnale[i] === null ? null : x - segnale[i]) };
}

// ATR di Wilder
export function atr(h, l, c, n = 14) {
  const out = c.map(() => null);
  let a = 0;
  for (let i = 0; i < c.length; i++) {
    const tr = i ? Math.max(h[i], c[i - 1]) - Math.min(l[i], c[i - 1]) : h[i] - l[i];
    a = i < n ? a + tr / n : (a * (n - 1) + tr) / n;
    if (i >= n - 1) out[i] = a;
  }
  return out;
}
