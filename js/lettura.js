// Lettura di uno strumento come quella fatta a mano il 23/10 sulle borse (utente: "queste analisi le possiamo mettere
// nell'app in una sezione dedicata e farle per tutti gli strumenti?"): D1, cosa fa l'H1, cosa manca al segnale a favore,
// avvisi e livelli sopra e sotto il prezzo. Solo regole sui dati del giro, nessun giudizio a mano.

const COND = { tsi: "TSI", ha: "Heikin Ashi", stoc: "stocastico" };
const ORDINE = { scattato: 0, attesa: 1, dentro: 2, nessuno: 3 };
const candele = n => `${n} candel${n === 1 ? "a" : "e"}`;

// livelli del giro (minimi, pivot) e del profilo del movimento, uniti se distano meno di 0,05 ATR D1
function livelli(x) {
  const v = (x.livelli || []).map(l => ({ nome: l.nome, prezzo: l.prezzo }));
  const vp = x.volumi || {};
  if (vp.poc != null) v.push({ nome: "POC movimento", prezzo: vp.poc });
  if (vp.vah != null) v.push({ nome: "alto value area", prezzo: vp.vah });
  if (vp.val != null) v.push({ nome: "basso value area", prezzo: vp.val });
  for (const [p] of vp.nodi || []) if (p !== vp.poc) v.push({ nome: "nodo volumi", prezzo: p });
  v.sort((a, b) => a.prezzo - b.prezzo);
  const uniti = [], soglia = 0.05 * (x.atr_d1 || 0);
  for (const l of v) {
    const u = uniti[uniti.length - 1];
    if (u && l.prezzo - u.prezzo <= soglia) u.nome += " · " + l.nome;
    else uniti.push({ ...l });
  }
  for (const l of uniti) l.atr = x.atr_d1 ? (l.prezzo - x.prezzo) / x.atr_d1 : null;
  return { sopra: uniti.filter(l => l.prezzo > x.prezzo).slice(0, 3),
           sotto: uniti.filter(l => l.prezzo < x.prezzo).reverse().slice(0, 3) };
}

// utente 26/10: il superiore dell'H1 è l'H8; il D1 resta per gli avvisi
export function lettura(x) {
  const d1 = x.lato_tf?.H8?.lato, D1 = x.lato_d1?.lato, h1 = x.lato_tf?.H1 || {}, { sopra, sotto } = livelli(x);
  const r = { d1, da_d1: x.lato_tf?.H8?.da, h1: h1.lato, sopra, sotto, avvisi: [], girate: 0 };
  if (!d1) return { ...r, stato: "nessuno", frase: "H8 senza direzione: nessun allineamento delle 3 condizioni." };
  if (D1 && D1 !== d1) r.avvisi.push(`D1 ${D1}: contro l'H8`);

  const kD1 = x.stoc_d1?.k, kH1 = x.stoc_op?.H1?.k, short = d1 === "short";
  if (kD1 != null && (short ? kD1 <= 20 : kD1 >= 80)) r.avvisi.push(`stocastico D1 a ${Math.round(kD1)}: già in eccesso`);
  const h4 = x.lato_tf?.H4?.lato;
  if (h4 && h4 !== d1) r.avvisi.push(`H4 ${h4}: contro l'H8`);

  if (h1.lato === d1) {
    if (h1.da <= 2) return { ...r, stato: "scattato", frase: `Segnale H1 ${d1} scattato ${candele(h1.da)} fa, a favore dell'H8.` };
    return { ...r, stato: "dentro", frase: `H1 ${d1} da ${h1.da} ore: il movimento è partito, il prossimo ingresso dopo uno storno.` };
  }
  // H1 contro l'H8: lo ora dice per ogni condizione se sull'ultima H1 chiusa era long (true) o short (false)
  const girate = Object.keys(COND).filter(c => h1.ora && h1.ora[c] === !short);
  r.girate = girate.length;
  let frase = `H1 ${h1.lato} da ${h1.da ?? "?"} ore, contro l'H8 ${d1}: si entra quando l'H1 chiude con le 3 condizioni ${d1}`;
  frase += girate.length ? ` (già girat${girate.length === 1 ? "o" : "i"}: ${girate.map(c => COND[c]).join(", ")}).` : ".";
  if (kH1 != null && (short ? kH1 >= 80 : kH1 <= 20))
    frase += ` Stocastico H1 a ${Math.round(kH1)}: ${short ? "ipercomprato" : "ipervenduto"}, vicino a girare.`;
  return { ...r, stato: "attesa", frase };
}

export const ordina = (a, b) => ORDINE[a.l.stato] - ORDINE[b.l.stato] || b.l.girate - a.l.girate;
