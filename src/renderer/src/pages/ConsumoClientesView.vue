<template>
  <section>
    <div class="view-header">
      <div>
        <RouterLink to="/indicadores" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Indicadores
        </RouterLink>
        <h1>Consumo por cliente</h1>
        <p>Resumen de consumo acumulado por cliente.</p>
      </div>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="card">
      <div class="filtro-cliente">
        <label class="field-label" for="buscar-cliente-consumo">Buscar cliente</label>
        <div class="filtro-fila">
          <SearchSelect
            v-model="clienteId"
            input-id="buscar-cliente-consumo"
            :options="opcionesClientes"
            placeholder="Nombre o cédula…"
          />
          <button v-if="clienteId != null" class="btn btn-outline" type="button" @click="clienteId = null">
            Ver todos
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cédula</th>
            <th>Compras</th>
            <th>Unidades</th>
            <th style="text-align: right">Total USD · Bs</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in clientesFiltrados" :key="c.id">
            <td>{{ c.nombre }}</td>
            <td class="num">{{ c.tipo_documento }}-{{ c.doc || '—' }}</td>
            <td class="num">{{ c.compras }}</td>
            <td class="num">{{ c.unidades }}</td>
            <td class="num" style="text-align: right">
              <span class="monto-dual">
                <strong>{{ formatUsd(c.total_usd) }}</strong>
                <small>{{ formatMontoBs(c.total_bs) }}</small>
              </span>
            </td>
            <td>
              <button class="icon-btn" title="Ver gráfico" @click="verGrafico(c)">📊</button>
            </td>
          </tr>
          <tr v-if="!cargando && clientes.length === 0">
            <td colspan="6" class="muted">No hay clientes registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SearchSelect from '../components/SearchSelect.vue'
import { formatUsd, formatMontoBs } from '../composables/useFormato'

const router = useRouter()
const clientes = ref([])
const cargando = ref(true)
const error = ref('')

// Dropdown de búsqueda: busca por nombre o cédula (la etiqueta incluye
// ambos). Sin selección se muestran todos los clientes.
const clienteId = ref(null)
const opcionesClientes = computed(() =>
  clientes.value.map((c) => ({ value: c.id, label: `${c.nombre} · ${c.tipo_documento}-${c.doc || '—'}` }))
)
const clientesFiltrados = computed(() =>
  clienteId.value == null ? clientes.value : clientes.value.filter((c) => c.id === clienteId.value)
)

async function cargarClientes() {
  cargando.value = true
  error.value = ''
  try {
    clientes.value = await window.api.clientes.listarConConsumo()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

function verGrafico(cliente) {
  router.push({ path: '/consumo-cliente-grafico', query: { id: cliente.id, nombre: cliente.nombre } })
}

onMounted(cargarClientes)
</script>

<style scoped>
.filtro-cliente {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.filtro-fila {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 460px;
}
.filtro-fila .btn {
  flex-shrink: 0;
}
</style>
