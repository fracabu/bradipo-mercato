// Pagina Analisi: un pulsante per ogni piano (strumento, solo H1) col giudizio; il clic apre il grafico grande
// pulito: candele, POC, volumi e frecce dei segnali.
import { computed, ref, watch } from "vue";
import { D, fmt, strumento, ricorda, LOCALE } from "../dati.js";
import { R, href } from "../rotta.js";
import { Pill, Schede, COL_GIUDIZIO } from "./ui.js";
import { Riquadro } from "./grafici.js";

const ORD = { buono: 0, no: 1 };

function tutti() {
  const v = [];
  for (const x of D.stato?.strumenti || [])
    for (const s of x.piano?.setup || []) v.push({ ...s, sym: x.sym, nome: x.nome, digits: x.digits });
  return v.sort((a, b) => ORD[a.giudizio] - ORD[b.giudizio] || (b.rr ?? -1) - (a.rr ?? -1));
}

const Lista = {
  components: { Pill, Schede },
  setup() {
    const filtro = ref(ricorda("analisi") || "utili");
    const voci = computed(() => tutti().filter(s => filtro.value === "tutti" || s.giudizio !== "no"));
    const scegli = f => { filtro.value = f; ricorda("analisi", f); };
    return { filtro, voci, scegli, fmt, href, COL_GIUDIZIO,
             FILTRI: [{ id: "utili", testo: "Buoni" }, { id: "tutti", testo: "Tutti" }] };
  },
  template: `<section class="pan">
    <h3>Analisi <small>se si entrasse adesso nel verso del segnale · stop SAR o 7 candele, target 1 × ATR(5) del TF superiore</small></h3>
    <Schede :voci="FILTRI" :model-value="filtro" @update:model-value="scegli" etichetta="Quali piani"/>
    <p v-if="!voci.length" class="muto">Nessun piano buono adesso: il metodo dice di aspettare.</p>
    <ul class="piani">
      <li v-for="s in voci" :key="s.sym + s.tf"><a class="piano-btn" :href="href('analisi', s.sym, s.tf)" :style="{ '--c': 'var(--' + COL_GIUDIZIO[s.giudizio] + ')' }">
        <span class="pb-testa"><b>{{ s.nome }}</b> <span class="muto">{{ s.tf }}</span>
          <span class="lato" :style="{ '--c': 'var(--' + s.lato + ')' }">{{ s.lato === "long" ? "▲" : "▼" }} {{ s.lato }}</span></span>
        <Pill :c="COL_GIUDIZIO[s.giudizio]">{{ s.giudizio }}</Pill>
        <span class="pb-num num">R:R {{ s.rr != null ? fmt(s.rr, 1) : "–" }}</span>
        <span class="pb-nota muto">{{ s.segnale ? "segnale " + s.segnale : s.fresco ? "da " + s.fresco : "" }}</span>
      </a></li></ul></section>`,
};

// Dettaglio: solo il grafico (D1 a sinistra, H1 a destra) con POC, volumi e frecce dei segnali. Utente 22/10 sera:
// "leva tutta la roba inutile, lascia POC, volumi e basta e le frecce dei segnali" (tolti piano, stop/target, livelli
// gialli, R:R, target a mano e il perché)
const Dettaglio = {
  components: { Riquadro },
  setup() {
    const x = computed(() => strumento(R.parti[1]));
    const s = computed(() => (x.value.piano?.setup || []).find(v => v.tf === R.parti[2]) || (x.value.piano?.setup || [])[0]);
    // video di analisi dello strumento (data/video/<sym>/ sul PC): dietro un pulsante, mai sul sito pubblico (utente 29/10)
    const video = ref([]), aperto = ref(null);
    watch(() => x.value.sym, async sym => {
      video.value = []; aperto.value = null;
      if (!LOCALE || !sym) return;
      try { video.value = (await (await fetch("api/video?sym=" + sym)).json()).video || []; } catch { /* niente video */ }
    }, { immediate: true });
    const data = v => v.nome.slice(8, 10) + "/" + v.nome.slice(5, 7);
    return { x, s, href, video, aperto, data };
  },
  template: `<Riquadro :sym="x.sym" :piano="null" grande>
      <div class="piano-barra">
        <a class="filtro" :href="href('analisi')" title="tutti gli strumenti">←</a>
        <b class="pb-nome">{{ x.nome }}</b>
        <span v-if="s" class="lato" :style="{ '--c': 'var(--' + s.lato + ')' }">{{ s.lato === "long" ? "▲" : "▼" }} {{ s.lato }} {{ s.tf }}</span>
        <button v-for="v in video" :key="v.url" type="button" class="filtro" :aria-pressed="aperto === v.url"
          @click="aperto = aperto === v.url ? null : v.url" :title="v.nome">▶ Video {{ data(v) }}</button>
      </div>
      <video v-if="aperto" class="video-analisi" :src="aperto" controls autoplay></video>
    </Riquadro>`,
};

export const Analisi = {
  components: { Lista, Dettaglio },
  setup: () => ({ R }),
  template: `<Dettaglio v-if="R.parti[1]"/><Lista v-else/>`,
};
