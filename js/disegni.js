// Disegni a mano sui grafici (utente 30/10: "tirare tutte le linee che voglio agilmente", Fibonacci, righello), come su
// TradingView: linea, raggio, orizzontale, verticale, canale parallelo, rettangolo, Fibonacci, righello (anche Shift+clic).
// Valgono per lo strumento su tutti i TF: ogni punto è [tempo, prezzo]. Restano in questo browser, in bradipo.disegni.<sym>.
// Un punto si mette a clic o trascinando; col magnete si aggancia ad aperto, massimo, minimo o chiuso della candela.
// Esc annulla, Canc toglie il disegno scelto, Ctrl+Z torna indietro. Si disegna sul canvas unico della colonna (grafici.js).
// Utente 30/10: si disegna anche sugli oscillatori. Il pannello è un'area con gli stessi campi della colonna (cp, ep, candele)
// e pane = l'oscillatore; lì il disegno vale solo per quell'oscillatore su quel TF, perché i suoi valori cambiano col TF.
// Utente 30/10: la matita, scarabocchi a mano libera come su Paint. Resta accesa finché non la si spegne, senza magnete e
// senza maniglie; ogni tratto vale solo sul TF dove è fatto, perché su un altro TF la stessa forma sarebbe un puntino o enorme.
export const COLORI = ["#4fc3f7", "#ffd60a", "#ff5ad7", "#7fd36a", "#ff8a50", "#ffffff"];
const PUNTI = { trend: 2, raggio: 2, oriz: 1, vert: 1, canale: 3, rett: 2, fib: 2, righello: 2, vp: 1 };
const LIVELLI = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];
const COL_FIB = { 0: "#9e9e9e", 0.236: "#ff5a50", 0.382: "#ffa94d", 0.5: "#7fd36a", 0.618: "#4fc3f7", 0.786: "#7e8cff", 1: "#9e9e9e", 1.272: "#ff5ad7", 1.618: "#ff5ad7" };
const VICINO = 6, MAGNETE = 14;
const SOLO_PREZZO = new Set(["fib", "righello", "vp"]);   // Fibonacci, righello e profilo parlano di prezzi
const qui = c => D.lista.filter(d => d.pane ? d.pane === c.pane && d.tf === c.tf : !c.pane && (d.tipo !== "matita" || d.tf === c.tf));

export const D = {
  sym: null, lista: [], strumento: null, punti: [], cur: null, sel: null, magnete: true, righello: null, colore: COLORI[0],
  storia: [], drag: null, premuto: null, candele: null, dove: null, tratto: null,
  // da grafici.js
  aggiorna: () => {}, formato: v => String(v), misure: () => "", suAncora: null, cambiato: () => {},
  clic: null, suClic: null, sopraAltro: null,   // il clic e il passaggio su quello che non è un disegno (grafici.js)
};

const chiave = sym => `bradipo.disegni.${sym}`;

export function caricaDisegni(sym) {
  D.sym = sym; D.sel = null; D.punti = []; D.cur = null; D.righello = null; D.storia = []; D.tratto = null;
  let l = null;
  try { l = JSON.parse(localStorage.getItem(chiave(sym))); } catch (e) {}
  if (!l) {                              // le linee di prima (20/10): orizzontali e oblique
    l = [];
    try {
      for (const v of JSON.parse(localStorage.getItem(`bradipo.linee.${sym}`)) || []) {
        if (v.tipo === "o") l.push({ id: nuovoId(), tipo: "oriz", pts: [[0, v.p]], col: COLORI[0] });
        else l.push({ id: nuovoId(), tipo: "trend", pts: [v.a, v.b].sort((x, y) => x[0] - y[0]), col: COLORI[0] });
      }
    } catch (e) {}
  }
  D.lista = l;
}

let contatore = 0;
const nuovoId = () => `${Date.now().toString(36)}${contatore++}`;
const salva = () => { try { localStorage.setItem(chiave(D.sym), JSON.stringify(D.lista)); } catch (e) {} };
const ricorda = () => { D.storia.push(JSON.stringify(D.lista)); if (D.storia.length > 50) D.storia.shift(); };

export function scegliStrumento(s) {
  D.strumento = D.strumento === s ? null : s;
  D.punti = []; D.cur = null; D.premuto = null; D.tratto = null;
  if (D.strumento) { D.sel = null; D.righello = null; }
  D.cambiato(); D.aggiorna();
}

export function annulla() {
  if (D.punti.length || D.strumento) { D.punti = []; D.cur = null; D.strumento = null; D.premuto = null; D.tratto = null; }
  else if (D.righello) D.righello = null;
  else D.sel = null;
  D.cambiato(); D.aggiorna();
}

export function indietro() {
  if (!D.storia.length) return;
  D.lista = JSON.parse(D.storia.pop());
  D.sel = null; salva(); D.cambiato(); D.aggiorna();
}

export function togliScelto() {
  if (!D.sel) return false;
  ricorda();
  D.lista = D.lista.filter(x => x.id !== D.sel);
  D.sel = null; salva(); D.cambiato(); D.aggiorna();
  return true;
}

export function togliTutti() {
  if (!D.lista.length) return;
  ricorda(); D.lista = []; D.sel = null; salva(); D.cambiato(); D.aggiorna();
}

export function coloraScelto(col) {
  D.colore = col;
  const x = D.lista.find(v => v.id === D.sel);
  if (x) { ricorda(); x.col = col; salva(); }
  D.cambiato(); D.aggiorna();
}

// ---------- tempo e prezzo <-> posizione sul grafico ----------
// indice (anche con la virgola) del tempo t nella serie della colonna: oltre le due estremità si allunga col passo del TF
export function indice(c, t) {
  const T = c.s.t, n = T.length;
  if (t <= T[0]) return (t - T[0]) / c.passo;
  if (t >= T[n - 1]) return n - 1 + (t - T[n - 1]) / c.passo;
  let a = 0, b = n - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (T[m] <= t) a = m; else b = m; }
  return a + (t - T[a]) / (T[b] - T[a]);
}
const tempoDi = (c, i) => {
  const T = c.s.t, n = T.length, j = Math.round(i);
  return j < 0 ? T[0] + j * c.passo : j >= n ? T[n - 1] + (j - n + 1) * c.passo : T[j];
};
// come tempoDi ma anche fra due candele: la matita non va a scatti quando le candele sono larghe
const tempoFine = (c, i) => {
  const T = c.s.t, n = T.length, a = Math.floor(i);
  return Math.round(i <= 0 ? T[0] + i * c.passo : i >= n - 1 ? T[n - 1] + (i - n + 1) * c.passo : T[a] + (i - a) * (T[a + 1] - T[a]));
};
// il grafico converte solo indici interi: un tempo fra due candele (un perno di mercoledì sul W1) si interpola
export const xDi = (c, t) => {
  const ts = c.cp.timeScale(), i = indice(c, t), f = Math.floor(i), a = ts.logicalToCoordinate(f);
  if (i === f || a === null) return a;
  const b = ts.logicalToCoordinate(f + 1);
  return b === null ? null : a + (b - a) * (i - f);
};
const yDi = (c, p) => c.candele.priceToCoordinate(p);
const larghezza = c => c.ep.clientWidth - c.cp.priceScale("right").width();

function punto(c, x, y) {
  const i = c.cp.timeScale().coordinateToLogical(x);
  let p = c.candele.coordinateToPrice(y);
  if (i === null || p === null) return null;
  const j = Math.round(i), V = c.vista;
  // sulle candele aperto, massimo, minimo e chiuso; sugli oscillatori le loro linee
  const vicini = c.valori ? c.valori(j) : V && j >= 0 && j < V.o.length ? [V.o[j], V.h[j], V.l[j], V.c[j]] : [];
  if (D.magnete) {
    let meglio = MAGNETE;
    for (const v of vicini) {
      if (v === null || v === undefined) continue;
      const yy = yDi(c, v);
      if (yy !== null && Math.abs(yy - y) < meglio) { meglio = Math.abs(yy - y); p = v; }
    }
  }
  return [tempoDi(c, j), p];
}

// il punto della matita: esattamente dove sta il mouse, tenuto dentro l'area (il grafico converte solo indici interi)
function puntoLibero(c, x, y) {
  const ts = c.cp.timeScale(), a = ts.logicalToCoordinate(0), b = ts.logicalToCoordinate(1);
  const p = c.candele.coordinateToPrice(Math.max(0, Math.min(y, c.ep.clientHeight)));
  if (a === null || b === null || a === b || p === null) return null;
  return [tempoFine(c, (Math.max(0, Math.min(x, larghezza(c))) - a) / (b - a)), +p.toPrecision(9)];
}
const puntoPer = (c, d, x, y) => (d.tipo === "matita" ? puntoLibero(c, x, y) : punto(c, x, y));

// ---------- geometria: i tratti di un disegno sullo schermo ----------
const allunga = (x0, y0, x1, y1, W) => (x1 === x0 ? [x0, y0, x1, y1] : [x0, y0, W, y0 + (y1 - y0) * (W - x0) / (x1 - x0)]);

function tratti(c, d, pts = d.pts) {
  const W = larghezza(c), H = c.ep.clientHeight;
  const P = pts.map(([t, p]) => [xDi(c, t), yDi(c, p)]);
  if (d.tipo !== "oriz" && d.tipo !== "vert" && P.some(q => q[0] === null || q[1] === null)) return [];
  if (d.tipo === "oriz") return P[0][1] === null ? [] : [[0, P[0][1], W, P[0][1]]];
  if (d.tipo === "vert") return P[0][0] === null ? [] : [[P[0][0], 0, P[0][0], H]];
  if (d.tipo === "matita") return P.length < 2 ? [[...P[0], ...P[0]]] : P.slice(1).map((q, i) => [...P[i], ...q]);
  const [a, b, e] = P;
  if (!b) return [];
  if (d.tipo === "trend" || d.tipo === "righello") return [[a[0], a[1], b[0], b[1]]];
  if (d.tipo === "raggio") return [allunga(a[0], a[1], b[0], b[1], W)];
  if (d.tipo === "rett") return [[a[0], a[1], b[0], a[1]], [b[0], a[1], b[0], b[1]], [b[0], b[1], a[0], b[1]], [a[0], b[1], a[0], a[1]]];
  if (d.tipo === "fib") {
    const xa = Math.min(a[0], b[0]);
    return LIVELLI.map(l => { const y = yDi(c, pts[1][1] + (pts[0][1] - pts[1][1]) * l); return y === null ? null : [xa, y, W, y]; }).filter(Boolean);
  }
  if (d.tipo === "canale") {
    const su = [[a[0], a[1], b[0], b[1]]];
    if (e) { const dy = e[1] - (a[1] + (b[1] - a[1]) * (e[0] - a[0]) / ((b[0] - a[0]) || 1)); su.push([a[0], a[1] + dy, b[0], b[1] + dy]); }
    return su;
  }
  return [];
}

export const distanza = (x, y, [a, b, e, f]) => {
  const dx = e - a, dy = f - b, q = dx * dx + dy * dy, u = q ? Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / q)) : 0;
  return Math.hypot(x - a - u * dx, y - b - u * dy);
};

function maniglie(c, d) {
  if (d.tipo === "matita") return [];
  if (d.tipo === "oriz") { const y = yDi(c, d.pts[0][1]); return y === null ? [] : [[larghezza(c) / 2, y, 0]]; }
  if (d.tipo === "vert") { const x = xDi(c, d.pts[0][0]); return x === null ? [] : [[x, c.ep.clientHeight / 2, 0]]; }
  return d.pts.map(([t, p], i) => [xDi(c, t), yDi(c, p), i]).filter(q => q[0] !== null && q[1] !== null);
}

function colpito(c, x, y) {
  const L = qui(c), sc = L.find(v => v.id === D.sel);
  if (sc) for (const m of maniglie(c, sc)) if (Math.hypot(m[0] - x, m[1] - y) <= VICINO + 2) return { d: sc, maniglia: m[2] };
  for (let i = L.length - 1; i >= 0; i--) {
    const d = L[i];
    if (tratti(c, d).some(s => distanza(x, y, s) <= VICINO)) return { d, maniglia: null };
  }
  return null;
}

// ---------- mouse e dito ----------
function finisci(c) {
  const tipo = D.strumento;
  if (tipo === "righello") D.righello = { pts: D.punti.slice(), c };
  else if (tipo === "vp") D.suAncora?.(D.punti[0][0]);
  else {
    ricorda();
    const d = { id: nuovoId(), tipo, pts: D.punti.slice(), col: D.colore, ...(c.pane ? { pane: c.pane, tf: c.tf } : {}) };
    D.lista.push(d); D.sel = d.id; salva();
  }
  D.punti = []; D.cur = null; D.premuto = null; D.strumento = null;
  D.cambiato(); D.aggiorna();
}

function giu(c, e, x, y) {
  if (x > larghezza(c)) return false;     // sulla scala dei prezzi si fa quello che fa il grafico
  if (e.target?.closest?.(".gr-osc-x")) return false;
  D.clic = { c, x, y };
  if (c.pane && (SOLO_PREZZO.has(D.strumento) || (!D.strumento && e.shiftKey))) return false;
  if (D.strumento === "matita") {
    const q = puntoLibero(c, x, y);
    if (q) { D.tratto = { c, x, y, d: { id: nuovoId(), tipo: "matita", pts: [q], col: D.colore, tf: c.tf, ...(c.pane ? { pane: c.pane } : {}) } }; D.aggiorna(); }
    return true;
  }
  if (!D.strumento && e.shiftKey) { D.strumento = "righello"; D.righello = null; D.punti = []; D.cambiato(); }
  if (D.strumento) {
    if (D.punti.length && D.dove !== c) return true;   // il disegno si finisce dove è cominciato
    const q = punto(c, x, y);
    if (!q) return true;
    D.dove = c;
    D.punti.push(q);
    D.premuto = { x, y };
    D.cur = q;
    if (D.punti.length === PUNTI[D.strumento]) finisci(c);
    else D.aggiorna();
    return true;
  }
  if (D.righello) { D.righello = null; D.aggiorna(); }
  const h = colpito(c, x, y);
  if (!h) {
    if (D.sel) { D.sel = null; D.cambiato(); D.aggiorna(); }
    return false;
  }
  D.sel = h.d.id;
  ricorda();
  D.drag = { d: h.d, maniglia: h.maniglia, da: puntoPer(c, h.d, x, y) || [0, 0], orig: JSON.parse(JSON.stringify(h.d.pts)), c, mosso: false, y0: y };
  D.cambiato(); D.aggiorna();
  return true;
}

function muovi(c, x, y) {
  if (D.tratto) {
    const T = D.tratto;
    if (T.c === c && Math.hypot(x - T.x, y - T.y) >= 2) {
      const q = puntoLibero(c, x, y);
      if (q) { T.d.pts.push(q); T.x = x; T.y = y; D.aggiorna(); }
    }
    return true;
  }
  if (D.drag) {
    const g = D.drag, d = g.d, q = puntoPer(g.c, d, x, y);
    if (!q) return true;
    g.mosso = true;
    if (g.maniglia !== null && d.tipo !== "oriz" && d.tipo !== "vert") d.pts[g.maniglia] = q;
    else {
      const di = indice(g.c, q[0]) - indice(g.c, g.da[0]), dp = q[1] - g.da[1], tempo = d.tipo === "matita" ? tempoFine : tempoDi;
      d.pts = g.orig.map(([t, p]) => [d.tipo === "oriz" ? t : tempo(g.c, indice(g.c, t) + di), d.tipo === "vert" ? p : p + dp]);
    }
    D.aggiorna();
    return true;
  }
  if (D.strumento && D.punti.length) {
    if (D.dove === c) { D.cur = punto(c, x, y); D.aggiorna(); }
    return false;
  }
  const h = !D.strumento && x <= larghezza(c) ? colpito(c, x, y) || D.sopraAltro?.(c, x, y) : null;
  c.ep.classList.toggle("sopra-disegno", !!h);
  return false;
}

function su(c, x, y) {
  if (D.tratto) {
    if (D.tratto.c !== c) return;
    ricorda();
    D.lista.push(D.tratto.d); D.tratto = null;
    salva(); D.aggiorna();
    return;
  }
  if (D.drag) {
    if (D.drag.mosso) salva(); else D.storia.pop();
    D.drag = null;
    D.aggiorna();
    return;
  }
  if (D.dove !== c) return;              // ogni area ascolta il mouse su tutta la finestra: x e y valgono solo per la sua
  // tenendo premuto: si lascia sul secondo punto, come su TradingView
  if (D.strumento && D.premuto && D.punti.length && Math.hypot(x - D.premuto.x, y - D.premuto.y) > 6) {
    const q = punto(c, x, y);
    if (q) { D.punti.push(q); if (D.punti.length === PUNTI[D.strumento]) finisci(c); else { D.premuto = null; D.aggiorna(); } }
  } else D.premuto = null;
}

export function collega(c) {
  const dove = e => { const r = c.ep.getBoundingClientRect(), t = e.touches?.[0] || e.changedTouches?.[0] || e; return [t.clientX - r.left, t.clientY - r.top]; };
  const prendi = e => { e.stopPropagation(); e.preventDefault(); };
  // un clic senza trascinare su quello che non è un disegno: non si ferma il grafico, si sceglie solo se il mouse non si è mosso
  let libero = null;
  const down = e => { if (e.button) return; const [x, y] = dove(e); if (giu(c, e, x, y)) { prendi(e); libero = null; } else libero = x <= larghezza(c) ? [x, y] : null; };
  const move = e => { if ((D.drag && D.drag.c !== c) || (D.tratto && D.tratto.c !== c)) return; const [x, y] = dove(e); if (muovi(c, x, y)) prendi(e); };
  const up = e => { const [x, y] = dove(e); su(c, x, y); if (libero && Math.hypot(x - libero[0], y - libero[1]) < 4) D.suClic?.(c, x, y); libero = null; };
  c.ep.addEventListener("mousedown", down, true);
  c.ep.addEventListener("touchstart", down, { capture: true, passive: false });
  c.ep.addEventListener("mousemove", move, true);
  c.ep.addEventListener("touchmove", move, { capture: true, passive: false });
  c.ep.addEventListener("contextmenu", e => { if (D.strumento) { prendi(e); annulla(); } }, true);
  window.addEventListener("mouseup", up);
  window.addEventListener("touchend", up);
  // il trascinamento continua anche fuori dal grafico
  const fuori = e => { if ((D.drag && D.drag.c === c) || (D.tratto && D.tratto.c === c)) { const [x, y] = dove(e); muovi(c, x, y); } };
  window.addEventListener("mousemove", fuori);
  c.scollega = () => { window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); window.removeEventListener("mousemove", fuori); };
}

// ---------- disegno ----------
const etichetta = (g, testo, x, y, col, fondo = "rgba(20,20,20,.82)") => {
  g.font = "11px IBM Plex Mono, monospace";
  const w = g.measureText(testo).width + 8;
  g.fillStyle = fondo; g.fillRect(x, y - 8, w, 16);
  g.fillStyle = col; g.fillText(testo, x + 4, y + 4);
  return w;
};
// etichetta col prezzo sulla scala
export function sullaScala(c, g, y, testo, fondo, col = "#fff") {
  const W = larghezza(c);
  g.fillStyle = fondo; g.fillRect(W, y - 8, c.ep.clientWidth - W, 16);
  g.fillStyle = col; g.font = "11px IBM Plex Mono, monospace"; g.fillText(testo, W + 4, y + 4);
}

function unDisegno(c, g, d, pts, scelto) {
  const col = d.col || COLORI[0], T = tratti(c, d, pts);
  g.strokeStyle = col; g.lineWidth = scelto ? 2.5 : 1.75; g.setLineDash([]);
  if (d.tipo === "matita") {
    if (pts.length === 1) { g.fillStyle = col; g.beginPath(); g.arc(T[0][0], T[0][1], 1.5, 0, 7); g.fill(); return; }
    g.lineCap = "round"; g.lineWidth = scelto ? 3.5 : 2;
    g.beginPath();
    for (const s of T) { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); }
    g.stroke(); g.lineCap = "butt";
    return;
  }
  if (d.tipo === "rett" && pts[1]) {
    const a = [xDi(c, pts[0][0]), yDi(c, pts[0][1])], b = [xDi(c, pts[1][0]), yDi(c, pts[1][1])];
    if (a[0] !== null && b[0] !== null && a[1] !== null && b[1] !== null) { g.globalAlpha = 0.13; g.fillStyle = col; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); g.globalAlpha = 1; }
  }
  if (d.tipo === "canale" && T.length === 2) {
    const [p, q] = T;
    g.globalAlpha = 0.1; g.fillStyle = col; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.lineTo(q[2], q[3]); g.lineTo(q[0], q[1]); g.closePath(); g.fill(); g.globalAlpha = 1;
    g.setLineDash([5, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2); g.lineTo((p[2] + q[2]) / 2, (p[3] + q[3]) / 2); g.stroke(); g.setLineDash([]); g.lineWidth = scelto ? 2.5 : 1.75;
  }
  if (d.tipo === "fib" && pts[1]) {
    // utente 31/10, "un po' invasivo": linee più leggere; scritte senza fondo a destra, accanto alla scala ma fuori da lei.
    // Dove i livelli sono fitti resta la scritta del più importante; col disegno scelto si leggono tutte
    const dp = pts[1][1] - pts[0][1], W = larghezza(c), xa = Math.min(xDi(c, pts[0][0]) ?? 0, xDi(c, pts[1][0]) ?? 0), Y = l => yDi(c, pts[1][1] - dp * l);
    g.lineWidth = scelto ? 1.5 : 1; g.globalAlpha = scelto ? 1 : 0.6;
    for (const l of LIVELLI) {
      const y = Y(l);
      if (y === null) continue;
      g.strokeStyle = COL_FIB[l]; g.beginPath(); g.moveTo(xa, y); g.lineTo(W, y); g.stroke();
    }
    g.globalAlpha = 1;
    const prese = [];
    g.save(); g.font = "11px IBM Plex Mono, monospace"; g.textAlign = "right"; g.lineJoin = "round";
    for (const l of [0.5, 0.618, 0, 1, 0.382, 0.786, 0.236, 1.272, 1.618]) {
      const y = Y(l);
      if (y === null || (!scelto && prese.some(q => Math.abs(q - y) < 13))) continue;
      prese.push(y);
      const testo = `${l}  ${D.formato(pts[1][1] - dp * l)}`;
      g.strokeStyle = "rgba(30,30,30,.85)"; g.lineWidth = 3; g.strokeText(testo, W - 5, y - 3);
      g.fillStyle = COL_FIB[l]; g.fillText(testo, W - 5, y - 3);
    }
    g.restore();
    return;
  }
  g.beginPath();
  for (const s of T) { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); }
  g.stroke();
  if (d.tipo === "oriz" && T[0]) sullaScala(c, g, T[0][1], c.pane ? pts[0][1].toFixed(2) : D.formato(pts[0][1]), col, "#111");
}

function unRighello(c, g, pts) {
  const [a, b] = pts;
  if (!b) return;
  const xa = xDi(c, a[0]), xb = xDi(c, b[0]), ya = yDi(c, a[1]), yb = yDi(c, b[1]);
  if (xa === null || xb === null || ya === null || yb === null) return;
  const sale = b[1] >= a[1], col = sale ? "#4fc3f7" : "#ff7a70";
  g.globalAlpha = 0.18; g.fillStyle = col; g.fillRect(xa, ya, xb - xa, yb - ya); g.globalAlpha = 1;
  g.strokeStyle = col; g.lineWidth = 1.5; g.setLineDash([]);
  g.beginPath(); g.moveTo(xa, (ya + yb) / 2); g.lineTo(xb, (ya + yb) / 2); g.moveTo((xa + xb) / 2, ya); g.lineTo((xa + xb) / 2, yb); g.stroke();
  const testo = D.misure(c, a, b);
  g.font = "12px IBM Plex Mono, monospace";
  const w = g.measureText(testo).width + 12, x = Math.max(4, Math.min((xa + xb) / 2 - w / 2, larghezza(c) - w - 4));
  const y = Math.max(4, Math.min(sale ? Math.min(ya, yb) - 28 : Math.max(ya, yb) + 8, c.ep.clientHeight - 26));
  g.fillStyle = col; g.fillRect(x, y, w, 21);
  g.fillStyle = "#111"; g.fillText(testo, x + 6, y + 15);
}

export function dipingi(c, g) {
  const L = qui(c);
  for (const d of L) unDisegno(c, g, d, d.pts, d.id === D.sel);
  const sc = L.find(v => v.id === D.sel);
  if (sc) for (const m of maniglie(c, sc)) {
    g.fillStyle = "#1c1c1c"; g.strokeStyle = sc.col || COLORI[0]; g.lineWidth = 2;
    g.beginPath(); g.arc(m[0], m[1], 4.5, 0, 7); g.fill(); g.stroke();
  }
  if (D.strumento && D.punti.length && D.cur && D.dove === c) {
    const pts = [...D.punti, D.cur];
    if (D.strumento === "righello") unRighello(c, g, pts);
    else if (D.strumento !== "vp") unDisegno(c, g, { tipo: D.strumento, col: D.colore }, pts, false);
  }
  if (D.tratto?.c === c) unDisegno(c, g, D.tratto.d, D.tratto.d.pts, false);
  if (D.righello && !c.pane) unRighello(c, g, D.righello.pts);
}
