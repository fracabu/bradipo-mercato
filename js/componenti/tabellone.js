// Pagina Tabellone: riga di stato (conto simulato, posizioni, prossima news rossa) e il tabellone di Luigi:
// D1 long o short, volumi, H1, H1 col D1 e il piano migliore. Un clic sulla riga apre i grafici dello strumento.
import { computed } from "vue";
import { D, fmt, segno, nome, cifre, quando, ORA } from "../dati.js";
import { href } from "../rotta.js";
import { Lato, Pill, COL_GIUDIZIO } from "./ui.js";

const StatoRiga = {
  components: { Pill },
  setup() {
    const E = computed(() => D.stato?.simulati?.conto);
    const news = computed(() => {
      const N = D.stato?.news;
      if (!N?.eventi) return null;
      if (Object.keys(N.bloccati || {}).length) return { blocco: true };
      const r = N.eventi.find(e => e.impatto === "rossa" && e.ts > D.adesso / 1000);
      return r ? { testo: `prossima 🔴 ${r.valuta} ${ORA(r.ts)}` } : null;
    });
    return { E, news, fmt, segno, nome, cifre };
  },
  template: `<section class="stato" aria-live="polite">
    <template v-if="E">
      <a :href="'#/operazioni'"><Pill c="pronto">Conto {{ fmt(E.equity, 0) }} €</Pill></a>
      <span v-if="!E.aperte.length" class="muto">nessuna posizione</span>
      <span v-for="p in E.aperte" :key="p.sym + p.t"><b>{{ nome(p.sym) }}</b>
        <span :style="{ color: 'var(--' + p.lato + ')' }">{{ p.lato === "long" ? "▲" : "▼" }}</span>
        <span class="num"> {{ fmt(p.prezzo, cifre(p.sym)) }}</span>
        <span v-if="p.euro != null" class="num" :style="{ color: p.euro >= 0 ? 'var(--long)' : 'var(--short)' }"> {{ segno(p.euro) }} €</span></span>
    </template>
    <span v-if="news?.blocco" style="color:var(--contro)">⛔ ingressi bloccati per news</span>
    <span v-else-if="news" class="muto">{{ news.testo }}</span></section>`,
};

const Riga = {
  props: { x: Object },
  components: { Lato, Pill },
  setup(p) {
    const c = computed(() => {
      const x = p.x, d1 = x.lato_d1?.lato ?? null, h1 = x.lato_tf?.H1, v = x.volumi;
      // filtro volumi (15/10): nodo D1 vicino sotto il prezzo per i long, sopra per gli short (entro 1 ATR)
      const nodo = v && d1 ? (d1 === "long" ? v.nodo_sotto : v.nodo_sopra) : null;
      const ord = { buono: 0, no: 1 };
      const migliore = [...(x.piano?.setup || [])].sort((a, b) => ord[a.giudizio] - ord[b.giudizio])[0];
      return { d1, h1, v, nodo, vol: v && d1 ? (nodo ? d1 : d1 === "long" ? "short" : "long") : null, migliore,
               d1testo: d1 && `${d1} ${x.lato_d1.da}c${x.lato_d1.chiusa && x.lato_d1.chiusa !== d1 ? " oggi" : ""}` };
    });
    return { c, fmt, href, COL_GIUDIZIO };
  },
  template: `<div v-if="x.errore" class="riga-s"><span class="nome"><b>{{ x.nome || x.sym }}</b></span><span class="err">{{ x.errore }}</span></div>
    <div v-else class="riga-s">
      <a class="nome" :href="href('grafici', x.sym)" title="apri i grafici"><b>{{ x.nome }}</b></a>
      <span class="num r">{{ fmt(x.prezzo, x.digits) }}</span>
      <span><Lato :lato="c.d1" :testo="c.d1testo"/></span>
      <span v-if="c.vol" :title="'POC del movimento ' + fmt(c.v.poc, x.digits)"><Lato :lato="c.vol" :testo="c.nodo ? 'nodo ' + fmt(c.nodo[0], x.digits) : 'nessun nodo'"/></span>
      <span v-else class="muto">–</span>
      <span v-if="c.h1?.lato" :class="{ fresco: c.h1.segnale }" :style="{ '--c': 'var(--' + c.h1.lato + ')' }">
        <Lato :lato="c.h1.lato" :testo="c.h1.lato + (c.h1.segnale ? ' · segnale' : ' ' + c.h1.da + 'c')"/></span>
      <span v-else class="muto">–</span>
      <span><Pill v-if="c.d1 && c.h1" :c="c.h1.lato === c.d1 ? 'pronto' : 'contro'">{{ c.h1.lato === c.d1 ? "A favore" : "Contro" }}</Pill></span>
      <a v-if="c.migliore" class="piano-link" :href="href('analisi', x.sym, c.migliore.tf)" title="apri il piano">
        <Pill :c="COL_GIUDIZIO[c.migliore.giudizio]">{{ c.migliore.tf }} {{ c.migliore.giudizio }}</Pill></a>
      <span v-else class="muto">–</span>
    </div>`,
};

export const Tabellone = {
  components: { StatoRiga, Riga },
  setup: () => ({ D }),
  template: `<StatoRiga/>
    <section class="tab" aria-label="Tabellone degli strumenti">
      <div class="tab-testa" aria-hidden="true"><span>Strumento</span><span class="r">Prezzo</span><span>D1</span><span>Volumi</span><span>H1</span><span>H1 col D1</span><span>Piano</span></div>
      <Riga v-for="x in D.stato.strumenti" :key="x.sym" :x="x"/>
    </section>
    <p class="muto nota">Clic sul nome: grafici dello strumento. Clic sul piano: ingresso, stop e target.</p>`,
};
