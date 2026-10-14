// Pezzi piccoli usati da più pagine: freccia del lato, pillola colorata, pannello col titolo.

// D1 di Luigi: long o short fino a quando non si allineano le 3 condizioni dell'altro lato; null = nessun allineamento
export const Lato = {
  props: { lato: String, testo: String },
  template: `<span v-if="!lato" class="lato misto" title="nessun allineamento delle 3 condizioni nello storico">◆ {{ testo ?? "misto" }}</span>
    <span v-else class="lato" :style="{ '--c': 'var(--' + lato + ')' }">{{ lato === "long" ? "▲" : "▼" }} {{ testo ?? lato }}</span>`,
};

export const Pill = {
  props: { c: String },
  template: `<span class="pill" :style="{ '--c': 'var(--' + c + ')' }"><slot/></span>`,
};

export const Pannello = {
  props: { titolo: String, nota: String },
  template: `<section class="pan"><h3>{{ titolo }} <small v-if="nota">{{ nota }}</small></h3><slot/></section>`,
};

// Gruppo di pulsanti a scelta singola (finestre, indici, filtri)
export const Schede = {
  props: { voci: Array, modelValue: String, etichetta: String },
  emits: ["update:modelValue"],
  template: `<div class="schede" role="group" :aria-label="etichetta">
    <button v-for="v in voci" :key="v.id ?? v" class="filtro" type="button" :aria-pressed="(v.id ?? v) === modelValue"
      @click="$emit('update:modelValue', v.id ?? v)">{{ v.testo ?? v }}</button></div>`,
};

// Giudizio del piano: buono / no
export const COL_GIUDIZIO = { buono: "pronto", no: "fermo" };
