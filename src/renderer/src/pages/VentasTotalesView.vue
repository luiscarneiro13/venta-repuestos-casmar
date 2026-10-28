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
        <h1>Ventas totales</h1>
        <p>Historial de ventas, con filtros por fecha. Muestra los últimos 30 días por defecto.</p>
      </div>
      <button class="btn btn-outline" :disabled="ventas.length === 0" @click="exportarExcel">Exportar a Excel</button>
    </div>

    <div class="card" style="padding: 14px 16px; margin-bottom: 16px">
      <div class="filters" style="align-items: flex-end">
        <div class="login-field" style="margin-bottom: 0">
          <label class="field-label">Desde</label>
          <input v-model="filtros.desde" class="input" type="date" @change="cargarVentas" />
        </div>
        <div class="login-field" style="margin-bottom: 0">
          <label class="field-label">Hasta</label>
          <input v-model="filtros.hasta" class="input" type="date" @change="cargarVentas" />
        </div>
        <button class="btn btn-primary" type="button" @click="cargarVentas">Aplicar filtros</button>
        <button class="btn btn-outline" type="button" @click="limpiarFiltros">Limpiar filtros</button>
      </div>
    </div>

    <div class="card chart-card">
      <div class="chart-header">
        <h2 class="chart-titulo">Unidades y monto vendido</h2>
        <div class="chart-periodo">
          <label class="field-label" for="periodo-grafico">Agrupar por</label>
          <SearchSelect
            input-id="periodo-grafico"
            v-model="periodoGrafico"
            :options="opcionesPeriodo"
            style="width: 160px"
            @change="cargarGrafico"
          />
        </div>
      </div>
      <VentasTotalesChart :datos="datosGrafico" :periodo="periodoGrafico" />
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr)">
      <KpiCard
        lbl="Ventas de contado"
        :val="formatUsd(totalContadoUsd)"
        :sub-bold="formatMontoBs(totalContadoBs)"
        :sub="`· ${ventasActivas.length} ventas`"
      />
      <KpiCard lbl="Unidades" :val="String(unidadesPeriodo)" sub="Vendidas en el período" />
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Cliente</th>
            <th>Usuario</th>
            <th>Total USD</th>
            <th>Total Bs</th>
            <th>Tasa</th>
            <th>Fecha/hora</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in ventas" :key="v.id">
            <td class="num">{{ v.numero_ticket }}</td>
            <td>{{ v.cliente_nombre || 'Sin cliente' }}</td>
            <td>{{ v.usuario_nombre || '—' }}</td>
            <td class="num">{{ formatUsd(v.total_usd) }}</td>
            <td class="num muted">{{ formatMontoBs(v.total_bs) }}</td>
            <td class="num muted">{{ tasaMostrada(v).toLocaleString('es-VE', { minimumFractionDigits: 2 }) }} Bs</td>
            <td>{{ formatFechaHoraUtc(v.creado_en) }}</td>
            <td><StatusTag :estado="v.estado" /></td>
            <td>
              <button class="icon-btn" title="Ver venta" @click="verVenta(v)">👁</button>
              <button
                v-if="v.estado !== 'anulada' && puedeAnular"
                class="icon-btn icon-btn-danger"
                title="Anular venta"
                @click="pedirAnular(v)"
              >
                🗑
              </button>
            </td>
          </tr>
          <tr v-if="!cargando && ventas.length === 0">
            <td colspan="9" class="muted">No hay ventas para los filtros seleccionados.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal v-if="modalVer.abierto" :title="`Venta ${modalVer.venta?.numero_ticket}`" @close="modalVer.abierto = false">
      <p v-if="modalVer.cargando" class="muted">Cargando…</p>
      <div v-else-if="modalVer.venta" class="ticket">
        <div class="line"><span>Cliente</span><span>{{ modalVer.venta.cliente_nombre || 'Sin cliente' }}</span></div>
        <div class="line"><span>Atendido por</span><span>{{ modalVer.venta.usuario_nombre || '—' }}</span></div>
        <div class="line">
          <span>Documento</span>
          <span>{{ modalVer.venta.tipo_documento === 'nota_entrega' ? 'Nota de entrega' : 'Factura' }}</span>
        </div>
        <div class="line"><span>Tasa usada</span><span>{{ tasaMostrada(modalVer.venta).toFixed(2) }} Bs</span></div>
        <div v-if="modalVer.venta.metodo_pago" class="line">
          <span>Método de pago</span><span>{{ modalVer.venta.metodo_pago === 'usdt' ? 'USDT · Divisas' : 'Bolívares (Bs)' }}</span>
        </div>
        <div class="line"><span>Estado</span><span><StatusTag :estado="modalVer.venta.estado" /></span></div>
        <div v-if="modalVer.venta.estado === 'anulada'" class="line muted">
          <span>Anulada el</span><span>{{ formatFechaHoraUtc(modalVer.venta.anulado_en) }}</span>
        </div>
        <div v-if="modalVer.venta.estado === 'anulada'" class="line muted">
          <span>Anulada por</span><span>{{ modalVer.venta.usuario_anulacion_nombre || '—' }}</span>
        </div>
        <div v-if="modalVer.venta.anulado_motivo" class="line muted">
          <span>Motivo</span><span>{{ modalVer.venta.anulado_motivo }}</span>
        </div>
        <hr />
        <div v-for="item in modalVer.venta.items" :key="item.id" class="line">
          <span>{{ item.cantidad }} × {{ item.producto_nombre }} ({{ item.tipo_precio_nombre }})</span>
          <span>
            {{ formatUsd(item.subtotal_usd) }}
            <span class="muted" style="font-size: 10.5px; display: block; text-align: right">
              {{ formatMontoBs(item.subtotal_bs) }}
            </span>
          </span>
        </div>
        <hr />
        <template v-if="modalVer.venta.iva_bs != null && modalVer.venta.iva_porcentaje > 0">
          <div class="line muted">
            <span>Subtotal sin IVA</span>
            <span>{{ formatUsd(sumaItems('subtotal_usd')) }} · {{ formatMontoBs(sumaItems('subtotal_bs')) }}</span>
          </div>
          <div class="line muted">
            <span>IVA {{ modalVer.venta.iva_porcentaje }}%</span>
            <span>{{ formatUsd(modalVer.venta.iva_usd) }} · {{ formatMontoBs(modalVer.venta.iva_bs) }}</span>
          </div>
        </template>
        <div class="line" style="font-weight: 600"><span>Total</span><span>{{ formatUsd(modalVer.venta.total_usd) }}</span></div>
        <div class="line muted"><span>Total en bolívares</span><span>{{ formatMontoBs(modalVer.venta.total_bs) }}</span></div>
      </div>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalVer.abierto = false">Cerrar</button>
      </template>
    </BaseModal>

    <ConfirmModal
      v-if="confirmarAnular.abierto"
      title="Anular venta"
      :message="`¿Seguro que deseas anular el ticket ${confirmarAnular.venta?.numero_ticket}? Los productos volverán al inventario y la venta dejará de contar en los totales.`"
      confirm-text="Sí, continuar"
      cancel-text="Cancelar"
      @confirm="abrirModalMotivo"
      @cancel="confirmarAnular.abierto = false"
    />

    <BaseModal v-if="modalAnular.abierto" title="Motivo de anulación" @close="modalAnular.abierto = false">
      <p class="muted">
        Se anulará el ticket <strong>{{ modalAnular.venta?.numero_ticket }}</strong>. Indica el motivo de la anulación.
      </p>
      <label class="field-label">Motivo</label>
      <textarea v-model="modalAnular.motivo" class="input" rows="3" placeholder="Ej. Error al cobrar, cliente canceló, etc."></textarea>
      <p v-if="modalAnular.error" class="warning-box">{{ modalAnular.error }}</p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalAnular.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modalAnular.guardando" @click="ejecutarAnulacion">
          {{ modalAnular.guardando ? 'Anulando…' : 'Anular venta' }}
        </button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup>
import { puedeHacer } from '../composables/usePermisos'
import { computed, onMounted, reactive, ref } from 'vue'
import { alCambiar } from '../composables/useEventos'
import BaseModal from '../components/BaseModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import KpiCard from '../components/KpiCard.vue'
import StatusTag from '../components/StatusTag.vue'
import VentasTotalesChart from '../components/VentasTotalesChart.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { formatUsd, formatMontoBs, formatFechaHoraUtc } from '../composables/useFormato'
import { exportarCsv } from '../composables/useExportarCsv'
import { session } from '../store/session'

function fechaISO(fecha) {
  return fecha.toISOString().slice(0, 10)
}

// Por defecto se cargan solo los últimos 30 días (evita traer y renderizar
// el historial completo cada vez que se entra a la pantalla); "Limpiar
// filtros" sí quita el rango por completo si se quiere ver todo.
const hoy = new Date()
const hace30Dias = new Date()
hace30Dias.setDate(hace30Dias.getDate() - 30)

const filtros = reactive({ desde: fechaISO(hace30Dias), hasta: fechaISO(hoy) })

const ventas = ref([])
const cargando = ref(true)
const error = ref('')

const periodoGrafico = ref('mes')
const opcionesPeriodo = [
  { value: 'dia', label: 'Día' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' }
]
const datosGrafico = ref([])

async function cargarGrafico() {
  try {
    datosGrafico.value = await window.api.ventas.graficoVentasTotales(
      periodoGrafico.value,
      filtros.desde || null,
      filtros.hasta || null
    )
  } catch (e) {
    // La gráfica es complementaria; no bloquea el resto de la vista.
    datosGrafico.value = []
  }
}

async function cargarVentas() {
  cargando.value = true
  error.value = ''
  try {
    const filtroFechas = { desde: filtros.desde || null, hasta: filtros.hasta || null }
    const [listaVentas] = await Promise.all([window.api.ventas.listarConFiltros(filtroFechas), cargarGrafico()])
    ventas.value = listaVentas
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

function limpiarFiltros() {
  filtros.desde = ''
  filtros.hasta = ''
  cargarVentas()
}

// La tasa que aplicó a cada venta depende del método de cobro: BCV si pagó
// en bolívares, Binance si pagó en USDT. `tasa_valor` queda como respaldo
// para ventas registradas antes del modelo de doble tasa.
function tasaMostrada(v) {
  if (v.metodo_pago === 'usdt') return v.tasa_usdt ?? v.tasa_valor ?? 0
  return v.tasa_bcv ?? v.tasa_valor ?? 0
}

const ventasActivas = computed(() => ventas.value.filter((v) => v.estado === 'activa'))
const totalContadoUsd = computed(() => ventasActivas.value.reduce((s, v) => s + v.total_usd, 0))
const totalContadoBs = computed(() => ventasActivas.value.reduce((s, v) => s + v.total_bs, 0))
// La gráfica usa el mismo rango de fechas, así que sus unidades suman las del período.
const unidadesPeriodo = computed(() => datosGrafico.value.reduce((s, d) => s + d.unidades, 0))

// Anular devuelve stock y saca la venta de los totales: solo administradores.
const puedeAnular = computed(() => puedeHacer('ventas.anular'))
const modalVer = reactive({ abierto: false, cargando: false, venta: null })
// Subtotal sin IVA = suma de las líneas guardadas (igual que la factura).
const sumaItems = (campo) =>
  Math.round((modalVer.venta?.items ?? []).reduce((s, i) => s + (Number(i[campo]) || 0), 0) * 100) / 100

async function verVenta(venta) {
  modalVer.abierto = true
  modalVer.cargando = true
  modalVer.venta = null
  try {
    modalVer.venta = await window.api.ventas.detalle(venta.id)
  } catch (e) {
    error.value = e.message
    modalVer.abierto = false
  } finally {
    modalVer.cargando = false
  }
}

// Flujo de anulación en dos pasos:
//   1. ConfirmModal pregunta si realmente se quiere anular.
//   2. BaseModal pide el motivo y ejecuta la anulación.
const confirmarAnular = reactive({ abierto: false, venta: null })
const modalAnular = reactive({ abierto: false, venta: null, motivo: '', guardando: false, error: '' })

function pedirAnular(venta) {
  confirmarAnular.abierto = true
  confirmarAnular.venta = venta
}

function abrirModalMotivo() {
  modalAnular.abierto = true
  modalAnular.venta = confirmarAnular.venta
  modalAnular.motivo = ''
  modalAnular.error = ''
  confirmarAnular.abierto = false
}

async function ejecutarAnulacion() {
  const venta = modalAnular.venta
  if (!venta) return

  if (!modalAnular.motivo.trim()) {
    modalAnular.error = 'Indica el motivo de la anulación.'
    return
  }

  modalAnular.guardando = true
  modalAnular.error = ''
  error.value = ''
  try {
    await window.api.ventas.anular(venta.id, modalAnular.motivo.trim(), session.usuario.id)
    modalAnular.abierto = false
    await cargarVentas()
  } catch (e) {
    modalAnular.error = e.message
  } finally {
    modalAnular.guardando = false
  }
}

const ETIQUETA_ESTADO = { activa: 'Activa', anulada: 'Anulada' }

function exportarExcel() {
  const encabezados = ['Ticket', 'Cliente', 'Usuario', 'Total USD', 'Total Bs', 'Tasa', 'Fecha/hora', 'Estado']
  const filas = ventas.value.map((v) => [
    v.numero_ticket,
    v.cliente_nombre || 'Sin cliente',
    v.usuario_nombre || '',
    v.total_usd.toFixed(2),
    v.total_bs.toFixed(2),
    tasaMostrada(v).toFixed(2),
    formatFechaHoraUtc(v.creado_en),
    ETIQUETA_ESTADO[v.estado] || v.estado
  ])
  const fecha = new Date().toISOString().slice(0, 10)
  exportarCsv(`ventas-totales-${fecha}.csv`, encabezados, filas)
}

onMounted(cargarVentas)
alCambiar('ventas', () => cargarVentas().catch(() => {}))

</script>

<style scoped>
.chart-card {
  padding: 20px;
  margin-bottom: 16px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.chart-titulo {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.chart-periodo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-periodo .field-label {
  margin: 0;
}

.chart-periodo .input {
  width: auto;
  min-width: 120px;
}
</style>
