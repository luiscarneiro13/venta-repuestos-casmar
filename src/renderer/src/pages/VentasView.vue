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
        <h1>Ventas del día</h1>
        <p>Resumen del turno de hoy.</p>
      </div>
      <div style="display: flex; gap: 10px">
        <button class="btn btn-outline" :disabled="ventas.length === 0" @click="exportarExcel">
          Exportar a Excel
        </button>
        <button class="btn btn-primary" :disabled="!cajaObjetivo" @click="abrirCierre">Cerrar caja del día</button>
      </div>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr)">
      <KpiCard
        lbl="Ventas de contado"
        :val="formatUsd(totalContadoUsd)"
        :sub-bold="formatMontoBs(totalContadoBs)"
        :sub="`· ${ventasActivas.length} ventas`"
      />
      <KpiCard lbl="Tasa BCV (USD)" :val="formatMontoBs(tasasDelDia.bcv)" sub="Bs por dólar · hoy" />
      <KpiCard lbl="Tasa Binance (USDT)" :val="formatMontoBs(tasasDelDia.usdt)" sub="Bs por USDT · hoy" />
      <KpiCard lbl="Unidades" :val="String(unidadesHoy)" sub="Vendidas hoy" />
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Documento</th>
            <th>Cliente</th>
            <th>Usuario</th>
            <th>Unidades</th>
            <th>Total USD</th>
            <th>Total Bs</th>
            <th>Pago</th>
            <th>Tasa aplicada</th>
            <th>Fecha/hora</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in ventas" :key="v.id">
            <td class="num">{{ v.numero_ticket }}</td>
            <td>
              <span class="tag" :class="v.tipo_documento === 'nota_entrega' ? 'tag-anulada' : 'tag-parcial'">
                {{ etiquetaDocumento(v) }}
              </span>
            </td>
            <td>{{ v.cliente_nombre || 'Sin cliente' }}</td>
            <td>{{ v.usuario_nombre || '—' }}</td>
            <td class="num">{{ v.cantidad_unidades }}</td>
            <td class="num">{{ formatUsd(v.total_usd) }}</td>
            <td class="num muted">{{ formatMontoBs(v.total_bs) }}</td>
            <td>
              <span class="tag" :class="v.metodo_pago === 'usdt' ? 'tag-pendiente' : 'tag-activa'">
                {{ v.metodo_pago === 'usdt' ? 'USDT · Divisas' : 'Bolívares' }}
              </span>
            </td>
            <td class="num muted">
              {{ tasaMostrada(v).toLocaleString('es-VE', { minimumFractionDigits: 2 }) }} Bs
            </td>
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
            <td colspan="12" class="muted">Todavía no hay ventas registradas hoy.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal v-if="modalCierre.abierto" title="Confirmar cierre de caja" @close="cerrarModalCierre">
      <p v-if="modalCierre.cargando" class="muted">Calculando totales…</p>
      <template v-else-if="modalCierre.resumen">
        <p class="muted">
          Caja abierta el <strong>{{ formatearFecha(modalCierre.resumen.caja.abierta_en) }}</strong> por
          {{ modalCierre.resumen.caja.usuario_apertura_nombre }}.
        </p>
        <div class="ticket">
          <div class="line"><span>Ventas de contado</span><span>{{ formatUsd(modalCierre.resumen.totales.contadoUsd) }}</span></div>
          <div class="line muted"><span></span><span>{{ formatMontoBs(modalCierre.resumen.totales.contadoBs) }}</span></div>
        </div>
        <div class="login-field" style="margin-top: 14px">
          <label class="field-label">Tasa de cierre BCV (Bs por USD)</label>
          <input v-model.number="modalCierre.tasaCierre" class="input num" type="number" step="0.01" />
        </div>
        <div class="login-field">
          <label class="field-label">Tasa de cierre USDT (Bs por USDT)</label>
          <input v-model.number="modalCierre.tasaCierreUsdt" class="input num" type="number" step="0.01" />
        </div>
        <p class="muted" style="font-size: 11px">Esta acción no se puede deshacer.</p>
      </template>
      <p v-if="modalCierre.error" class="warning-box">{{ modalCierre.error }}</p>
      <p v-if="modalCierre.errorImpresion" class="warning-box">
        La caja se cerró, pero no se pudo imprimir el reporte: {{ modalCierre.errorImpresion }}
      </p>
      <template #footer>
        <template v-if="modalCierre.errorImpresion">
          <button class="btn btn-outline" type="button" @click="modalCierre.abierto = false">Cerrar sin imprimir</button>
          <button class="btn btn-primary" type="button" @click="imprimirReporteCierre(modalCierre.cajaCerrada)">Reintentar</button>
        </template>
        <template v-else>
          <button class="btn btn-outline" type="button" :disabled="modalCierre.imprimiendoReporte" @click="cerrarModalCierre">Cancelar</button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="modalCierre.guardando || modalCierre.imprimiendoReporte"
            @click="confirmarCierre"
          >
            {{ modalCierre.guardando ? 'Cerrando…' : modalCierre.imprimiendoReporte ? 'Imprimiendo reporte…' : 'Confirmar cierre' }}
          </button>
        </template>
      </template>
    </BaseModal>

    <BaseModal v-if="modalVer.abierto" :title="`Venta ${modalVer.venta?.numero_ticket}`" @close="modalVer.abierto = false">
      <p v-if="modalVer.errorImpresion" class="warning-box">No se pudo imprimir el ticket: {{ modalVer.errorImpresion }}</p>
      <p v-if="modalVer.cargando" class="muted">Cargando…</p>
      <div v-else-if="modalVer.venta" class="ticket">
        <div class="line"><span>Cliente</span><span>{{ modalVer.venta.cliente_nombre || 'Sin cliente' }}</span></div>
        <div class="line"><span>Atendido por</span><span>{{ modalVer.venta.usuario_nombre || '—' }}</span></div>
        <div class="line"><span>Tasa BCV (USD)</span><span>{{ formatMontoBs(tasaBcvMostrada(modalVer.venta)) }}</span></div>
        <div class="line"><span>Tasa Binance (USDT)</span><span>{{ formatMontoBs(tasaUsdtMostrada(modalVer.venta)) }}</span></div>
        <div v-if="modalVer.venta.metodo_pago" class="line">
          <span>Método de pago</span><span>{{ modalVer.venta.metodo_pago === 'usdt' ? 'USDT · Divisas' : 'Bolívares (Bs)' }}</span>
        </div>
        <div class="line">
          <span>Documento</span><span>{{ etiquetaDocumento(modalVer.venta) }}</span>
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
        <div v-if="modalVer.venta.metodo_pago === 'usdt'" class="line muted">
          <span>Total USDT</span><span>{{ formatMontoUsdt(modalVer.venta.total_usdt) }}</span>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalVer.abierto = false">Cerrar</button>
        <button
          v-if="modalVer.venta && modalVer.venta.estado === 'activa'"
          class="btn btn-primary"
          type="button"
          :disabled="modalVer.imprimiendo"
          @click="reimprimirVenta"
        >
          {{ modalVer.imprimiendo ? 'Imprimiendo…' : 'Reimprimir' }}
        </button>
      </template>
    </BaseModal>

    <ConfirmModal
      v-if="confirmarAnular.abierto"
      title="Anular venta"
      :message="`¿Seguro que deseas anular el ticket ${confirmarAnular.venta?.numero_ticket}? Los productos volverán al inventario y la venta dejará de contar en los totales del día.`"
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
import BaseModal from '../components/BaseModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import KpiCard from '../components/KpiCard.vue'
import StatusTag from '../components/StatusTag.vue'
import { formatUsd, formatMontoBs, formatMontoUsdt, formatFechaHoraUtc } from '../composables/useFormato'
import { exportarCsv } from '../composables/useExportarCsv'
import { session, marcarCajaCerrada } from '../store/session'

// Si hay una caja de un día anterior sin cerrar, se cierra esa primero (es
// la más urgente); si no, se cierra la de hoy.
const cajaObjetivo = computed(() => session.cajasPendientes[0] ?? session.caja)

const ventas = ref([])
const unidadesHoy = ref(0)
const cargando = ref(true)
const error = ref('')
// Tasas registradas hoy en la BD (las mismas que imprime el reporte diario);
// si hoy no se registró ninguna, las vigentes de la sesión.
const tasasDelDia = reactive({ bcv: null, usdt: null })

async function cargarVentasDeHoy() {
  cargando.value = true
  error.value = ''
  try {
    const [listaVentas, totales, tasaHoy] = await Promise.all([
      window.api.ventas.listarHoy(),
      window.api.ventas.totalesProductosHoy(),
      window.api.tasas.obtenerHoy()
    ])
    ventas.value = listaVentas
    unidadesHoy.value = totales.unidades || 0
    tasasDelDia.bcv = tasaHoy?.valor_bcv ?? tasaHoy?.valor ?? session.tasa ?? null
    tasasDelDia.usdt = tasaHoy?.valor_usdt ?? session.tasaUsdt ?? null
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// Los totales se calculan a partir de total_usd/total_bs tal cual quedaron
// guardados en cada venta (la tasa puede cambiar durante el día, por eso no
// se recalcula con session.tasa: cada venta ya congeló la tasa vigente en
// su momento).
// La tasa que aplicó a cada venta depende del método de cobro: BCV si pagó
// en bolívares, Binance si pagó en USDT. `tasa_valor` queda como respaldo
// para ventas registradas antes del modelo de doble tasa.
function tasaMostrada(v) {
  if (v.metodo_pago === 'usdt') return v.tasa_usdt ?? v.tasa_valor ?? 0
  return v.tasa_bcv ?? v.tasa_valor ?? 0
}

// Ambas tasas congeladas en la venta (para mostrarlas juntas en el detalle).
const tasaBcvMostrada = (v) => v.tasa_bcv ?? v.tasa_valor ?? 0
const tasaUsdtMostrada = (v) => v.tasa_usdt ?? v.tasa_valor ?? 0

const ventasActivas = computed(() => ventas.value.filter((v) => v.estado === 'activa'))
const totalContadoUsd = computed(() => ventasActivas.value.reduce((s, v) => s + v.total_usd, 0))
const totalContadoBs = computed(() => ventasActivas.value.reduce((s, v) => s + v.total_bs, 0))

// Anular devuelve stock y saca la venta de los totales: solo administradores.
const puedeAnular = computed(() => puedeHacer('ventas.anular'))
const modalVer = reactive({ abierto: false, cargando: false, venta: null, imprimiendo: false, errorImpresion: '' })
// Subtotal sin IVA = suma de las líneas guardadas (igual que la factura).
const sumaItems = (campo) =>
  Math.round((modalVer.venta?.items ?? []).reduce((s, i) => s + (Number(i[campo]) || 0), 0) * 100) / 100

async function verVenta(venta) {
  modalVer.abierto = true
  modalVer.cargando = true
  modalVer.venta = null
  modalVer.errorImpresion = ''
  try {
    modalVer.venta = await window.api.ventas.detalle(venta.id)
  } catch (e) {
    error.value = e.message
    modalVer.abierto = false
  } finally {
    modalVer.cargando = false
  }
}

// Reimprime los 2 tickets de una venta ya registrada (ej. cuando falló la
// impresora al vender y se corrigió el fallo después).
async function reimprimirVenta() {
  if (!modalVer.venta) return
  modalVer.imprimiendo = true
  modalVer.errorImpresion = ''
  try {
    const resultado = await window.api.impresora.imprimirVenta(modalVer.venta.id)
    if (!resultado.ok) {
      modalVer.errorImpresion = resultado.error || 'Error desconocido'
    }
  } catch (e) {
    modalVer.errorImpresion = e.message || 'No se pudo imprimir el ticket'
  } finally {
    modalVer.imprimiendo = false
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
    await cargarVentasDeHoy()
  } catch (e) {
    modalAnular.error = e.message
  } finally {
    modalAnular.guardando = false
  }
}

const modalCierre = reactive({
  abierto: false,
  cargando: false,
  resumen: null,
  tasaCierre: 0,
  tasaCierreUsdt: 0,
  error: '',
  guardando: false,
  imprimiendoReporte: false,
  errorImpresion: '',
  cajaCerrada: null
})

function formatearFecha(fechaHoraLocal) {
  if (!fechaHoraLocal) return ''
  const d = new Date(fechaHoraLocal.replace(' ', 'T'))
  return d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function abrirCierre() {
  const caja = cajaObjetivo.value
  if (!caja) return

  modalCierre.abierto = true
  modalCierre.cargando = true
  modalCierre.resumen = null
  modalCierre.error = ''
  modalCierre.errorImpresion = ''
  modalCierre.cajaCerrada = null
  modalCierre.tasaCierre = session.tasa
  modalCierre.tasaCierreUsdt = session.tasaUsdt
  try {
    modalCierre.resumen = await window.api.caja.resumenCierre(caja.id)
  } catch (e) {
    modalCierre.error = e.message
  } finally {
    modalCierre.cargando = false
  }
}

function cerrarModalCierre() {
  modalCierre.abierto = false
}

async function confirmarCierre() {
  const caja = cajaObjetivo.value
  if (!caja) return

  modalCierre.error = ''
  modalCierre.errorImpresion = ''
  if (!modalCierre.tasaCierre || modalCierre.tasaCierre <= 0) {
    modalCierre.error = 'La tasa de cierre BCV debe ser mayor a 0'
    return
  }
  if (!modalCierre.tasaCierreUsdt || modalCierre.tasaCierreUsdt <= 0) {
    modalCierre.error = 'La tasa de cierre USDT debe ser mayor a 0'
    return
  }

  modalCierre.guardando = true
  try {
    await window.api.caja.cerrar({
      cajaId: caja.id,
      usuarioCierreId: session.usuario.id,
      tasaCierre: modalCierre.tasaCierre,
      tasaCierreUsdt: modalCierre.tasaCierreUsdt
    })
    marcarCajaCerrada(caja.id)
    modalCierre.cajaCerrada = caja
  } catch (e) {
    modalCierre.error = e.message
    return
  } finally {
    modalCierre.guardando = false
  }

  // Caja cerrada: ahora se imprime el reporte Z del día.
  await imprimirReporteCierre(caja)
}

async function imprimirReporteCierre(caja) {
  modalCierre.imprimiendoReporte = true
  modalCierre.errorImpresion = ''
  try {
    const resultado = await window.api.impresora.imprimirReporteCierre(caja.id, session.usuario.nombre)
    if (!resultado.ok) {
      modalCierre.errorImpresion = resultado.error || 'No se pudo imprimir el reporte'
      return
    }
    modalCierre.abierto = false
  } catch (e) {
    modalCierre.errorImpresion = e.message || 'No se pudo imprimir el reporte'
  } finally {
    modalCierre.imprimiendoReporte = false
  }
}

const ETIQUETA_ESTADO = { activa: 'Activa', anulada: 'Anulada' }

const etiquetaDocumento = (v) => (v?.tipo_documento === 'nota_entrega' ? 'Nota de entrega' : 'Factura')

function exportarExcel() {
  const encabezados = ['Ticket', 'Documento', 'Cliente', 'Usuario', 'Unidades', 'Total USD', 'Total Bs', 'IVA Bs', 'Pago', 'Tasa BCV (USD)', 'Tasa Binance (USDT)', 'Fecha/hora', 'Estado']
  const filas = ventas.value.map((v) => [
    v.numero_ticket,
    etiquetaDocumento(v),
    v.cliente_nombre || 'Sin cliente',
    v.usuario_nombre || '',
    v.cantidad_unidades,
    v.total_usd.toFixed(2),
    v.total_bs.toFixed(2),
    Number(v.iva_bs || 0).toFixed(2),
    v.metodo_pago === 'usdt' ? 'USDT · Divisas' : 'Bolívares',
    tasaBcvMostrada(v).toFixed(2),
    tasaUsdtMostrada(v).toFixed(2),
    formatFechaHoraUtc(v.creado_en),
    ETIQUETA_ESTADO[v.estado] || v.estado
  ])

  // Fila final con los totales del día bajo sus columnas.
  filas.push([])
  filas.push(['', '', 'Totales hoy:', String(unidadesHoy.value)])
  filas.push(['', '', 'Tasa BCV (USD) del día:', Number(tasasDelDia.bcv || 0).toFixed(2)])
  filas.push(['', '', 'Tasa Binance (USDT) del día:', Number(tasasDelDia.usdt || 0).toFixed(2)])

  const fecha = new Date().toISOString().slice(0, 10)
  exportarCsv(`ventas-del-dia-${fecha}.csv`, encabezados, filas)
}

onMounted(cargarVentasDeHoy)
</script>
