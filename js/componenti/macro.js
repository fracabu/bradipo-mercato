// Pagina Macro: news rosse e arancioni, COT della CFTC e forza delle valute contro il dollaro.
import { computed, ref, watch } from "vue";
import { D, fmt, ORA, ricorda } from "../dati.js";
import { Pannello, Schede } from "./ui.js";

// News: solo da adesso in avanti, raggruppate per giorno
const News = {
  components: { Pannello },
  setup() {
    const N = computed(() => D.stato?.news);
    const giorni = computed(() => {
      const n = N.value, ora = D.adesso / 1000, g = [];
      let prima = "";
      for (const e of (n?.eventi || []).filter(e => e.ts + (n.dopo_min ?? 30) * 60 > ora)) {
        const giorno = new Date(e.ts * 1000).toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
        const vicino = e.impatto === "rossa" && Math.abs(e.ts - ora) <= (n.prima_min ?? 30) * 60;
        g.push({ ...e, giorno: giorno === prima ? "" : giorno, k: e.ts + e.valuta + e.titolo, vicino });   // il giorno solo sulla prima riga
        prima = giorno;
      }
      return g;
    });
    return { N, giorni, ORA };
  },
  template: `<Pannello v-if="N" titolo="News" :nota="'le 🔴 fermano gli ingressi ±' + (N.prima_min ?? 30) + ' min'">
    <div v-if="N.errore && !(N.eventi || []).length" class="avviso" style="--c:var(--osserva)">Calendario non disponibile.</div>
    <ul v-else class="nlista">
      <li v-if="!giorni.length" class="giorno">Nessuna news in arrivo.</li>
      <li v-for="e in giorni" :key="e.k" class="ev" :class="{ ora: e.vicino }"><span class="h">{{ e.giorno }}</span><span class="h">{{ ORA(e.ts) }}</span>
        <span class="val">{{ e.valuta }}</span><span><span class="imp" :style="{ '--c': e.impatto === 'rossa' ? 'var(--contro)' : 'var(--osserva)' }"></span>{{ e.titolo }}</span></li>
    </ul></Pannello>`,
};

// COT: posizione netta degli speculatori (e degli istituzionali) e indice COT 0-100 su 3 anni
const IndiceCot = {
  props: { i: Number, anni: Number },
  template: `<span class="cot-ind" :class="{ estremo: i <= 10 || i >= 90 }" :title="'indice COT ' + i + ': 0 = la più short in ' + anni + ' anni, 100 = la più long'">
    <i :style="{ left: i + '%' }"></i></span><span class="num">{{ i }}</span>`,
};
const Cot = {
  components: { Pannello, IndiceCot },
  setup() {
    const K = computed(() => D.stato?.cot?.strumenti ? D.stato.cot : null);
    const mig = n => Math.abs(n) >= 1000 ? `${n > 0 ? "+" : ""}${fmt(n / 1000, 1)}k` : `${n > 0 ? "+" : ""}${n}`;
    const col = n => ({ color: `var(--${n >= 0 ? "long" : "short"})` });
    return { K, mig, col };
  },
  template: `<Pannello v-if="K" titolo="COT" :nota="'posizioni dei grandi sui futures (CFTC), dati del ' + K.strumenti[0].data.split('-').reverse().join('/')">
    <div class="cot-box"><table class="cot"><thead><tr><th></th><th>speculatori</th><th>settimana</th><th>indice spec.</th><th>indice istituz.</th></tr></thead>
      <tbody><tr v-for="x in K.strumenti" :key="x.sym"><th scope="row">{{ x.nome }}</th>
        <td class="num" :style="col(x.spec.netto)" :title="x.spec.chi + ', ' + (x.spec.pct_oi ?? '–') + ' % dei contratti aperti'">{{ mig(x.spec.netto) }}</td>
        <td class="num" :style="col(x.spec.var)">{{ mig(x.spec.var) }}</td>
        <td><IndiceCot :i="x.spec.indice" :anni="K.anni"/></td>
        <td :title="x.ist.chi + ' netto ' + mig(x.ist.netto)"><IndiceCot :i="x.ist.indice" :anni="K.anni"/></td></tr></tbody></table></div>
    <p class="muto">Speculatori = fondi a leva (valute, indici) o managed money (metalli, petrolio); istituzionali = asset manager o produttori.
      + = a favore dello strumento (USD/JPY e USD/CHF già girati). Indice 0 = la più short in {{ K.anni }} anni, 100 = la più long: agli estremi (in rosso) il posizionamento è affollato.
      Sugli indici i fondi a leva sono short per arbitraggio contro gli asset manager: lì il netto non è una scommessa. Niente DAX (Eurex non ha COT).</p></Pannello>`,
};

// Strong / Weak: variazione % di ogni valuta in dollari; il dollaro è lo zero
const Forza = {
  components: { Pannello, Schede },
  setup() {
    const F = computed(() => D.stato?.forza);
    const scelta = ref(ricorda("forza") || "Oggi");
    watch(scelta, v => ricorda("forza", v));
    const w = computed(() => F.value?.finestre?.find(x => x.nome === scelta.value) || F.value?.finestre?.[0]);
    const righe = computed(() => {
      if (!w.value) return [];
      const max = Math.max(0.05, ...w.value.valute.map(v => Math.abs(v.pct)));
      return w.value.valute.filter(v => v.valuta !== "USD").map(v => ({ ...v, larg: 50 * Math.abs(v.pct) / max }));
    });
    const pc = v => `${v > 0 ? "+" : ""}${fmt(v, 2)}`;
    // dollarocentrismo: 100 = tutte le gambe dicono la stessa cosa sul dollaro, 0 = ognuna per conto suo
    const giudizio = dc => dc >= 70 ? "comanda il dollaro: cross fermi" : dc <= 30 ? "il dollaro non comanda: spazio per i cross" : "a metà";
    const coppia = x => x.sym.slice(0, 3) + "/" + x.sym.slice(3);
    const mossa = x => x.lato === "long" ? x.distanza : -x.distanza;              // come si è mosso il prezzo del cross
    const G = computed(() => F.value?.cross);
    const dettaglio = computed(() => G.value?.mosse.map(m => `${m.nome} ${pc(G.value.lato === "long" ? m.pct : -m.pct)} %`).join(" · "));
    return { F, w, scelta, righe, pc, giudizio, coppia, mossa, G, dettaglio };
  },
  template: `<Pannello v-if="F && (F.finestre?.length || F.errore)" titolo="Strong / Weak" nota="contro il dollaro, %">
    <p v-if="!w" class="muto">Non disponibile</p>
    <template v-else>
      <Schede :voci="F.finestre.map(x => x.nome)" v-model="scelta" etichetta="Finestra"/>
      <div class="barre"><div v-for="v in righe" :key="v.valuta" class="r" :title="v.valuta + ' ' + pc(v.pct) + ' % contro il dollaro · ' + w.nome">
        <b>{{ v.valuta }}</b><span class="asse"><i :class="v.pct >= 0 ? 'pos' : 'neg'" :style="{ width: v.larg + '%', '--c': v.pct >= 0 ? 'var(--long)' : 'var(--short)' }"></i></span>
        <span class="num">{{ pc(v.pct) }}</span></div></div>
      <div class="muto">USD contro il paniere: <b :style="{ color: w.usd >= 0 ? 'var(--long)' : 'var(--short)' }">{{ pc(w.usd) }} %</b></div>
      <div class="dc" :title="'quanta parte della mossa è il dollaro che si muove (' + w.nome + ')'">Dollarocentrico
        <span class="cot-ind"><i :style="{ left: w.dollarocentrismo + '%' }"></i></span><b class="num">{{ w.dollarocentrismo }} %</b>
        <span class="muto">{{ giudizio(w.dollarocentrismo) }}</span></div>
      <div class="dc" :title="w.cross.forte + ' fa più del paniere, ' + w.cross.debole + ' meno'">Cross
        <b :style="{ color: 'var(--' + w.cross.lato + ')' }">{{ w.cross.lato }} {{ coppia(w.cross) }}</b>
        <span class="num">{{ pc(mossa(w.cross)) }} %</span></div>
      <div v-if="G" class="dc" :title="dettaglio">Cross di oggi
        <b :style="{ color: 'var(--' + G.lato + ')' }">{{ G.lato }} {{ coppia(G) }}</b>
        <span :style="{ color: G.allineato ? 'var(--long)' : 'var(--muted)' }">{{ G.allineato ? "allineato su 4 ore, oggi e 5 giorni" : "non allineato" }}</span></div>
    </template></Pannello>`,
};

export const Macro = {
  components: { News, Cot, Forza },
  template: `<div class="quadro"><News/><Forza/><Cot/></div>`,
};
