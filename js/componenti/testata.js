// In alto: i pulsanti delle pagine, l'orario del giro (pallino verde = dati freschi) e la striscia che scorre.
import { computed, ref, watch } from "vue";
import { D, LOCALE, fmt, segno, nome, ORA, rifaiGiro } from "../dati.js";
import { R, PAGINE, href } from "../rotta.js";
import { Campanella } from "./campanella.js";

export const Nav = {
  setup: () => ({ R, PAGINE, href }),
  template: `<nav class="nav" aria-label="Pagine">
    <a v-for="p in PAGINE" :key="p.id" class="nav-btn" :href="href(p.id)" :aria-current="R.parti[0] === p.id ? 'page' : null" :title="p.cosa">
      {{ p.titolo }}</a></nav>`,
};

export const Vivo = {
  components: { Campanella },
  setup() {
    const giro = ref(false);
    const info = computed(() => {
      const S = D.stato;
      if (!S) return null;
      const sec = Math.max(0, Math.round((D.adesso - new Date(S.generato)) / 1000));
      const ogni = D.server.ogni_s || 60;
      return { ora: new Date(S.generato).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
               fa: sec < 60 ? `${sec} s fa` : `${Math.round(sec / 60)} min fa`,
               vecchi: sec > Math.max(180, 2.5 * ogni) || !!D.errore, ogni };
    });
    const rifai = async () => { giro.value = true; await rifaiGiro(); setTimeout(() => { giro.value = false; }, 2500); };
    watch(() => D.stato?.generato, () => { giro.value = false; });
    return { D, LOCALE, info, giro, rifai };
  },
  template: `<div class="meta">
    <a class="filtro" href="test.html">Test del sistema</a>
    <Campanella/>
    <span v-if="!info">{{ D.errore || "carico…" }}</span>
    <template v-else>
      <span><span class="dot" :style="{ '--c': info.vecchi ? 'var(--contro)' : 'var(--pronto)' }"></span>
        giro delle <span class="num">{{ info.ora }}</span> ({{ info.fa }})<template v-if="!LOCALE"> · online, ogni {{ Math.round(info.ogni / 60) }} min</template>
        <span v-if="D.errore" style="color:var(--contro)"> · ultimo giro fallito: {{ D.errore }}</span></span>
      <span>· {{ D.stato.server }}</span>
      <button v-if="LOCALE" class="filtro" type="button" :disabled="giro" @click="rifai">{{ giro ? "Giro in corso…" : "Rifai il giro" }}</button>
    </template></div>`,
};

// Striscia che scorre: le cose da vedere al volo. Due copie del testo, così il giro non si vede; si ferma col mouse
export const Striscia = {
  setup() {
    const voci = computed(() => {
      const S = D.stato, v = [];
      if (!S) return v;
      for (const x of S.strumenti.filter(x => !x.errore)) {
        // utente 26/10: solo il sistema D1/H4 ("contro" = H4 contro il D1)
        const d1 = x.lato_tf?.D1?.lato, h4 = x.lato_tf?.H4;
        if (!d1 || !h4?.lato) continue;
        v.push({ k: x.sym, nome: x.nome, prezzo: fmt(x.prezzo, x.digits), d1, h4: h4.lato,
                 segnale: h4.segnale && "segnale", contro: h4.lato !== d1 });
      }
      if (S.vix?.valore != null) v.push({ k: "vix", testo: `VIX ${fmt(S.vix.valore, 2)} ${S.vix.fascia}`, valore: `${segno(S.vix.var_pct, 1)} %`, su: S.vix.var_pct <= 0 });
      const ora = D.adesso / 1000, rossa = S.news?.eventi?.find(e => e.impatto === "rossa" && e.ts > ora);
      if (rossa) v.push({ k: "news", testo: `prossima news 🔴 ${rossa.valuta} ${ORA(rossa.ts)} ${rossa.titolo || ""}` });
      return v;
    });
    const durata = computed(() => `${Math.max(30, voci.value.length * 5)}s`);
    return { voci, durata };
  },
  template: `<div v-if="voci.length" class="ticker" aria-label="Riepilogo veloce"><div class="ticker-scorre" :style="{ '--durata': durata }">
    <template v-for="copia in 2" :key="copia">
      <span v-for="v in voci" :key="copia + v.k" class="voce" :aria-hidden="copia === 2 ? 'true' : null">
        <template v-if="v.h4"><b>{{ v.nome }}</b> <span class="num">{{ v.prezzo }}</span> · D1
          <span :style="{ color: 'var(--' + v.d1 + ')' }">{{ v.d1 === "long" ? "▲" : "▼" }}</span> · H4
          <span :style="{ color: 'var(--' + v.h4 + ')' }">{{ v.h4 === "long" ? "▲" : "▼" }}</span>
          <b v-if="v.segnale" :style="{ color: 'var(--' + v.h4 + ')' }"> {{ v.segnale }}</b>
          <span v-if="v.contro" style="color:var(--osserva)"> contro</span></template>
        <template v-else>{{ v.testo }} <span v-if="v.valore" class="num" :style="{ color: v.su ? 'var(--long)' : 'var(--short)' }">{{ v.valore }}</span></template>
      </span></template></div></div>`,
};
