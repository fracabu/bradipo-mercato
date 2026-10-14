// Navigazione con l'hash (#/analisi/EURUSD/H1): funziona uguale in locale e su GitHub Pages, e il tasto indietro
// del browser torna alla pagina di prima. Niente vue-router: bastano nove pagine.
import { reactive } from "vue";

const leggi = () => (location.hash.replace(/^#\/?/, "") || "tabellone").split("/").map(decodeURIComponent);

export const R = reactive({ parti: leggi() });
addEventListener("hashchange", () => { R.parti = leggi(); scrollTo(0, 0); });

export const vai = (...parti) => { location.hash = "/" + parti.map(encodeURIComponent).join("/"); };
export const href = (...parti) => "#/" + parti.map(encodeURIComponent).join("/");

// le pagine, nell'ordine dei pulsanti in alto
export const PAGINE = [
  { id: "tabellone", titolo: "Tabellone", cosa: "D1, volumi e H1 di ogni strumento" },
  { id: "operazioni", titolo: "Operazioni", cosa: "il conto simulato in diretta" },
  { id: "analisi", titolo: "Analisi", cosa: "ingresso, stop e target col metodo di Luigi" },
  { id: "quadro", titolo: "Quadro", cosa: "cosa aspettiamo su ogni strumento, coi livelli" },
  { id: "controllo", titolo: "Controllo", cosa: "i valori degli indicatori, da confrontare col grafico MT5" },
  { id: "grafici", titolo: "Grafici", cosa: "D1 e H1 dello strumento scelto" },
  { id: "usa", titolo: "Mercato USA", cosa: "mappa delle azioni, ETF, VIX" },
  { id: "macro", titolo: "Macro", cosa: "news, COT, forza delle valute" },
  { id: "registro", titolo: "Registro", cosa: "segnali, svolte e operazioni del conto simulato" },
];
