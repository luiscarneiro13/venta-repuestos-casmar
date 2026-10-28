<template>
  <section>
    <div class="view-header">
      <div>
        <RouterLink to="/consumo-clientes" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Consumo por cliente
        </RouterLink>
        <h1>Gráfico de consumo</h1>
        <p>{{ cliente?.nombre || 'Cliente' }}</p>
      </div>
    </div>

    <div class="card filtros">
      <div class="filtro-group">
        <div>
          <label class="field-label">Desde</label>
          <input type="date" v-model="desde" class="input" />
        </div>
        <div>
          <label class="field-label">Hasta</label>
          <input type="date" v-model="hasta" class="input" />
        </div>
        <div>
          <label class="field-label">Agrupar por</label>
          <SearchSelect
            v-model="periodo"
            :options="opcionesPeriodo"
            style="width: 160px"
            @change="cargarDatos"
          />
        </div>
        <div class="filtro-actions">
          <button class="btn btn-primary" @click="aplicarFiltro">Filtrar</button>
          <button v-if="hayFiltro" class="btn btn-outline" @click="limpiarFiltro">Eliminar filtro</button>
        </div>
      </div>
    </div>

    <div class="card" style="padding: 20px; margin-bottom: 16px">
      <ConsumoBarChart :datos="datos" :periodo="periodo" />
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Ticket</th>
            <th>Productos</th>
            <th>Unidades</th>
            <th style="text-align: right">Total USD · Bs</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in historial" :key="v.id">
            <td>{{ formatFechaHoraUtc(v.creado_en) }}</td>
            <td class="num">{{ v.numero_ticket }}</td>
            <td>{{ v.productos }}</td>
            <td class="num">{{ v.unidades }}</td>
            <td class="num" style="text-align: right">
              <span class="monto-dual">
                <strong>{{ formatUsd(v.total_usd) }}</strong>
                <small>{{ formatMontoBs(v.total_bs) }}</small>
              </span>
            </td>
          </tr>
          <tr v-if="!cargando && historial.length === 0">
            <td colspan="5" class="muted">Sin ventas en el período seleccionado.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ConsumoBarChart from '../components/ConsumoBarChart.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { formatUsd, formatMontoBs, formatFechaHoraUtc } from '../composables/useFormato'

const route = useRoute()
const cliente = ref({ nombre: route.query.nombre || '' })
const datos = ref([])
const historial = ref([])
const periodo = ref('mes')
const opcionesPeriodo = [
  { value: 'dia', label: 'Día' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' }
]
const desde = ref('')
const hasta = ref('')
const cargando = ref(true)
const hayFiltro = computed(() => desde.value !== '' || hasta.value !== '')

async function cargarDatos() {
  const clienteId = route.query.id
  if (!clienteId) return
  cargando.value = true
  const d = desde.value || null
  const h = hasta.value || null
  const [graf, hist] = await Promise.all([
    window.api.clientes.consumoDiario(Number(clienteId), periodo.value, d, h),
    window.api.clientes.historial(Number(clienteId), d, h)
  ])
  datos.value = graf
  historial.value = hist
  cargando.value = false
}

function aplicarFiltro() {
  cargarDatos()
}

function limpiarFiltro() {
  desde.value = ''
  hasta.value = ''
  cargarDatos()
}

onMounted(cargarDatos)
</script>

<style scoped>
.filtros {
  padding: 16px;
  margin-bottom: 16px;
}

.filtro-group {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.filtro-group > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filtro-actions {
  flex-direction: row !important;
  gap: 8px !important;
}


</style>
