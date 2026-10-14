// Campanella di Wall Street: apertura (9:30) e chiusura (16:00) di New York, lun-ven. Dal 26/10 suona il server dalle
// casse del PC (bradipo/campanella.py), come una sveglia: il browser non fa suonare una pagina finché non ci si clicca
// (l'apertura delle 14:30 era suonata alle 14:45). Qui solo il pulsante che la accende e la spegne; online non c'è.
import { ref, onMounted } from "vue";
import { LOCALE } from "../dati.js";

export const Campanella = {
  setup() {
    const accesa = ref(null);
    const chiedi = async (corpo) => {
      try {
        const r = await fetch("api/campanella", corpo ? { method: "POST", body: JSON.stringify(corpo) } : { cache: "no-store" });
        accesa.value = (await r.json()).accesa;
      } catch (e) { accesa.value = null; }
    };
    const cambia = () => chiedi({ accesa: !accesa.value });
    onMounted(() => { if (LOCALE) chiedi(); });
    return { accesa, cambia };
  },
  template: `<button v-if="accesa !== null" class="filtro" type="button" @click="cambia" :aria-pressed="accesa"
    :title="accesa ? 'Campanella di Wall Street accesa, suona dal PC (apre 9:30, chiude 16:00 New York): clic per spegnerla' : 'Campanella spenta: clic per accenderla (suona una prova)'">
    {{ accesa ? "🔔" : "🔕" }} Wall Street</button>`,
};
