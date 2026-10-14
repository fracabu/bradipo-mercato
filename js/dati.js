// Lo stato condiviso dalla pagina: in locale i dati arrivano dal server (api/...), online (GitHub Pages) da file statici
// pubblicati dal server. Ogni componente legge da qui; nessuno scarica dati per conto suo, tranne i grafici.
import { reactive } from "vue";

export const LOCALE = ["127.0.0.1", "localhost"].includes(location.hostname);
const FONTE = LOCALE ? { stato: "api/stato", eventi: "api/eventi?n=300" } : { stato: "dati/stato.json", eventi: "dati/eventi.json" };

export const D = reactive({ stato: null, server: {}, eventi: [], errore: null, adesso: Date.now() });

export const fmt = (v, dg) => v == null ? "–" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: dg, maximumFractionDigits: dg });
export const segno = (v, dg = 2) => v == null ? "–" : `${v > 0 ? "+" : ""}${fmt(v, dg)}`;
export const strumento = sym => (D.stato?.strumenti || []).find(x => x.sym === sym) || {};
export const nome = sym => strumento(sym).nome || sym;
export const cifre = sym => strumento(sym).digits ?? 2;
export const ORA = ts => new Date(ts * 1000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
export const quando = t => new Date(t).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const colore = lato => `var(--${lato})`;

// preferenze di chi guarda (strumento scelto, finestre dei pannelli): solo comodità, la pagina vive anche senza
export function ricorda(chiave, valore) {
  try { if (valore === undefined) return localStorage.getItem(`bradipo.${chiave}`); localStorage.setItem(`bradipo.${chiave}`, valore); }
  catch (e) { return null; }
}

// Registro: solo segnali, svolte del D1 e formazioni degli strumenti in pagina; il resto è rumore del giro
const TIPI = new Set(["segnale", "direzione", "formazione"]);
async function caricaEventi() {
  try {
    const r = await fetch(FONTE.eventi, { cache: "no-store" });
    if (!r.ok) return;
    const miei = new Set(D.stato.strumenti.map(x => x.sym));
    D.eventi = (await r.json()).filter(e => TIPI.has(e.tipo) && miei.has(e.sym)).slice(0, 60);
  } catch (e) {}
}

export async function carica() {
  try {
    const r = await fetch(FONTE.stato, { cache: "no-store" });
    if (!r.ok) throw new Error(`il server risponde ${r.status}`);
    const j = await r.json();
    D.server = j.server_app || {};
    if (!j.stato) { D.errore = D.server.errore || "primo giro in corso"; return; }
    D.errore = D.server.errore || null;
    if (!D.stato || j.stato.generato !== D.stato.generato) { D.stato = j.stato; caricaEventi(); }
  } catch (e) {
    D.errore = LOCALE ? "server dell'app non raggiungibile: avvialo con avvia.bat" : "dati non disponibili";
  }
}

export async function rifaiGiro() {
  try { await fetch("api/giro", { method: "POST" }); } catch (e) {}
  setTimeout(carica, 2500);
}

export function avvia() {
  carica();
  setInterval(carica, 15000);
  setInterval(() => { D.adesso = Date.now(); }, 1000);
}
