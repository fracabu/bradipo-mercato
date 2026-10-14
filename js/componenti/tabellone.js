// Pagina Tabellone (utente 26/10: "un unico tabellone" coi due sistemi): riga di stato (i due conti, posizioni, prossima
// news rossa) e per ogni strumento H8, H1 e l'H1 con l'H8 (sistema intraday), D1, H4 e l'H4 col D1 (multiday), il piano.
// Un clic sul nome apre i grafici dello strumento.
import { computed, ref } from "vue";
import { D, fmt, segno, nome, cifre, quando, ORA } from "../dati.js";
import { href } from "../rotta.js";
import { Lato, Pill, COL_GIUDIZIO } from "./ui.js";

const StatoRiga = {
  components: { Pill },
  setup() {
    const conti = computed(() => D.stato?.simulati?.conti || []);
    const news = computed(() => {
      const N = D.stato?.news;
      if (!N?.eventi) return null;
      if (Object.keys(N.bloccati || {}).length) return { blocco: true };
      const r = N.eventi.find(e => e.impatto === "rossa" && e.ts > D.adesso / 1000);
      return r ? { testo: `prossima 🔴 ${r.valuta} ${ORA(r.ts)}` } : null;
    });
    return { conti, news, fmt, segno, nome, cifre };
  },
  template: `<section class="stato" aria-live="polite">
    <template v-for="E in conti" :key="E.serie">
      <a :href="'#/operazioni'"><Pill c="pronto">{{ E.titolo }} {{ fmt(E.equity, 0) }} €</Pill></a>
      <span v-if="!E.aperte.length" class="muto">nessuna posizione</span>
      <span v-for="p in E.aperte" :key="p.sym + p.t"><b>{{ nome(p.sym) }}</b>
        <span :style="{ color: 'var(--' + p.lato + ')' }">{{ p.lato === "long" ? "▲" : "▼" }}</span>
        <span class="num"> {{ fmt(p.prezzo, cifre(p.sym)) }}</span>
        <span v-if="p.euro != null" class="num" :style="{ color: p.euro >= 0 ? 'var(--long)' : 'var(--short)' }"> {{ segno(p.euro) }} €</span></span>
    </template>
    <span v-if="news?.blocco" style="color:var(--contro)">⛔ ingressi bloccati per news</span>
    <span v-else-if="news" class="muto">{{ news.testo }}</span></section>`,
};

// un TF della riga: lato, da quante candele, riquadro se ha appena cambiato
const Tf = {
  props: { l: Object },
  components: { Lato },
  template: `<span v-if="l?.lato" :class="{ fresco: l.segnale }" :style="{ '--c': 'var(--' + l.lato + ')' }">
    <Lato :lato="l.lato" :testo="l.lato + (l.segnale ? '' : ' ' + l.da + 'c')"/><i v-if="l.segnale" class="nuovo">nuovo</i></span>
    <span v-else class="muto">–</span>`,
};

// un sistema nella riga: dentro (con gli euro), segnale (il TF operativo ha appena cambiato nel verso del TF sopra),
// in attesa (è contro: al prossimo cambio entra), già partito (era già a favore: non è quello da cliccare, Luigi 26/10
// sul Dow "è l h4 che ha fatto girare il d1, non è quello che dobbiamo cliccare, è il prossimo h4 short")
const Sistema = {
  props: { x: Object, tf: String, op: Object, sopra: Object, p: Object, fuori: Boolean },
  components: { Pill },
  setup: () => ({ fmt, segno }),
  template: `<span v-if="p" class="dentro-box" :title="'dentro ' + p.lato + ' da ' + p.prezzo">
      <Pill :c="p.lato === 'long' ? 'long' : 'short'">{{ p.lato === "long" ? "▲" : "▼" }} dentro</Pill>
      <small v-if="p.euro != null" class="num" :style="{ color: p.euro >= 0 ? 'var(--long)' : 'var(--short)' }">{{ segno(p.euro) }} €</small></span>
    <span v-else-if="!x.negoziabile" class="muto">solo visione</span>
    <span v-else-if="op?.lato && sopra?.lato">
      <!-- semaforo (utente 26/10): verde = primo H4 dopo il segnale D1 (o primo H1 dopo l'H8), si entra; giallo = si aspetta;
           rosso = il primo è già passato, per questo segnale non si entra più -->
      <span class="semaforo-box" role="img"
        :aria-label="op.primo ? 'verde: entra ' + sopra.lato : op.usato ? 'rosso: ingresso già passato' : 'giallo: si aspetta il primo ' + tf + ' ' + sopra.lato"
        :title="op.primo ? 'entra ' + sopra.lato : op.usato ? 'ingresso già passato' : 'si aspetta il primo ' + tf + ' ' + sopra.lato">
        <i class="lampada rossa" :class="{ accesa: !op.primo && op.usato }"></i><i class="lampada gialla" :class="{ accesa: !op.primo && !op.usato }"></i><i class="lampada verde" :class="{ accesa: op.primo }"></i></span>
      <small v-if="fuori && op.lato === sopra.lato && op.segnale" class="muto"> fuori orario</small></span>
    <span v-else class="muto">–</span>`,
};

const Riga = {
  props: { x: Object, pos: Object, fuori: Boolean, s: Object },
  components: { Lato, Pill, Tf, Sistema },
  setup(p) {
    const c = computed(() => {
      const x = p.x, lt = x.lato_tf || {}, sopra = lt[p.s.sopra], op = lt[p.s.op];
      const dentro = p.pos[p.s.serie]?.[x.sym];
      // colore della riga come il semaforo (utente 26/10, "un pannello fico"): verde in evidenza, rosso spento
      const st = dentro ? "dentro" : !x.negoziabile || !op?.lato || !sopra?.lato ? "" : op.primo ? "verde" : op.usato ? "rosso" : "giallo";
      return { sopra, op, dentro, st };
    });
    const giorno = t => new Date(t * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    return { c, fmt, href, COL_GIUDIZIO, giorno };
  },
  template: `<div v-if="x.errore" class="riga-s"><span class="nome"><b>{{ x.nome || x.sym }}</b></span><span class="err">{{ x.errore }}</span></div>
    <div v-else class="riga-s" :class="c.st && 'st-' + c.st">
      <a class="nome" :href="href('grafici', x.sym)" title="apri i grafici"><b>{{ x.nome }}</b></a>
      <!-- prezzo del segnale del TF sopra al posto di quello di adesso (Luigi 26/10: "d1..segnale nuovo..a che prezzo..", "il prezzo
           attuale..lo vedo sul grafico"): la chiusura della candela in cui ha girato, per capire se miglioriamo l'ingresso -->
      <span class="num r prezzo" :title="c.sopra?.t_segnale ? 'segnale ' + s.sopra + ' del ' + giorno(c.sopra.t_segnale) : ''">{{ c.sopra?.prezzo_segnale != null ? fmt(c.sopra.prezzo_segnale, x.digits) : "–" }}</span>
      <span class="s2 sup" :data-l="s.sopra"><Tf :l="c.sopra"/></span>
      <span class="oper" :data-l="s.op"><Tf :l="c.op"/></span>
      <span class="sem-cella"><Sistema :x="x" :tf="s.op" :op="c.op" :sopra="c.sopra" :p="c.dentro" :fuori="fuori"/></span>
    </div>`,
};

// orario degli H1 (Luigi 26/10): dalle 7 alle 19:59 ora italiana, come SIM_ORARIO_H1
const oraRoma = () => Number(new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome", hour: "numeric", hour12: false }));

// i due sistemi, un pannello ciascuno con gli strumenti sulle stesse righe (utente 30/10: "nel tabellone gli H1 e H8")
const SISTEMI = [{ serie: "h4d1", sopra: "D1", op: "H4" }, { serie: "h1h8", sopra: "H8", op: "H1" }];

export const Tabellone = {
  components: { StatoRiga, Riga },
  setup() {
    // posizioni aperte per sistema: serie -> sym -> posizione
    const pos = computed(() => {
      const o = {};
      for (const c of D.stato?.simulati?.conti || []) for (const p of c.aperte) (o[p.serie] ||= {})[p.sym] = p;
      return o;
    });
    const fuori = computed(() => { D.adesso; const h = oraRoma(); return h < 7 || h >= 20; });
    // utente 26/10: "che nel pannello si possano mettere in ordine di nuovo daily": clic su D1 = prima i D1 più nuovi
    let salvato = false;
    try { salvato = localStorage.getItem("bradipo.ordine_d1") === "1"; } catch (e) {}
    const perD1 = ref(salvato);
    const cambia = () => { perD1.value = !perD1.value; try { localStorage.setItem("bradipo.ordine_d1", perD1.value ? "1" : "0"); } catch (e) {} };
    const righe = computed(() => {
      const r = [...(D.stato?.strumenti || [])];
      return perD1.value ? r.sort((a, b) => (a.lato_tf?.D1?.da ?? 999) - (b.lato_tf?.D1?.da ?? 999)) : r;
    });
    return { D, pos, fuori, perD1, cambia, righe, SISTEMI };
  },
  template: `<StatoRiga/>
    <section class="tab-d1-griglia" aria-label="Tabellone dei due sistemi, D1/H4 e H8/H1">
     <div v-for="s in SISTEMI" :key="s.serie" class="tab tab2 tab-d1">
      <div class="tab-testa"><span>Strumento</span><span class="r">Segnale {{ s.sopra }}</span>
        <span class="s2"><button v-if="s.sopra === 'D1'" class="ordina" type="button" :aria-pressed="perD1" @click="cambia"
          :title="perD1 ? 'ordine di sempre' : 'metti prima i D1 più nuovi'">D1 {{ perD1 ? "▲" : "⇅" }}</button><template v-else>{{ s.sopra }}</template></span>
        <span>{{ s.op }}</span><span></span></div>
      <Riga v-for="x in righe" :key="x.sym" :x="x" :pos="pos" :s="s" :fuori="s.op === 'H1' && fuori"/>
     </div>
    </section>
    <p class="muto nota">Lati sulle candele chiuse, "nuovo" = segnale appena scattato. Semaforo: 🟢 primo H4 dopo il segnale D1 o primo H1 dopo il segnale H8, si entra
      · 🟡 si aspetta · 🔴 il primo è già passato, per quel segnale non si entra più. "Dentro" = posizione aperta.
      Clic sul nome: grafici dello strumento.</p>`,
};
