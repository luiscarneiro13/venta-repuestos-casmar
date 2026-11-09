<template>
  <BaseModal xl :title="`Movimientos de «${producto.nombre}»`" @close="$emit('close')">
    <template #subtitle>
      <p class="modal-subtitulo">
        Libro de entradas y salidas del producto. Las entradas se pueden corregir con el lápiz.
      </p>
    </template>
    <template #header-extra>
      <span class="tag tag-parcial">Stock: {{ saldo }}</span>
    </template>

    <div class="filtros-mov">
      <button class="btn-filtro" :class="{ activo: filtro === 'todas' }" @click="filtro = 'todas'">Todas</button>
      <button class="btn-filtro" :class="{ activo: filtro === 'entrada' }" @click="filtro = 'entrada'">Entradas</button>
      <button class="btn-filtro" :class="{ activo: filtro === 'salida' }" @click="filtro = 'salida'">Salidas</button>
    </div>

    <p v-if="cargando" class="muted">Cargando movimientos…</p>
    <p v-else-if="error" class="warning-box">{{ error }}</p>
    <div v-else class="tabla-scroll movimientos-scroll">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Movimiento</th>
            <th>Cantidad</th>
            <th>Proveedor</th>
            <th>Motivo</th>
            <th>Registrado por</th>
            <th>Saldo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in movimientosFiltrados" :key="m.id">
            <td>{{ formatFechaHoraUtc(m.creado_en) }}</td>
            <td>
              <span class="tag" :class="m.tipo === 'entrada' ? 'tag-activa' : 'tag-vencido'">
                {{ m.tipo === 'entrada' ? 'Entrada' : 'Salida' }}
              </span>
              <span v-if="m.anulada" class="tag tag-vencido" style="margin-left: 4px">Anulada</span>
            </td>
            <td class="num">{{ m.tipo === 'entrada' ? '+' : '−' }}{{ m.cantidad }}</td>
            <td>{{ m.proveedor_nombre || '—' }}</td>
            <td>{{ m.motivo }}</td>
            <td>{{ m.usuario_nombre || '—' }}</td>
            <td class="num">{{ m.saldo }}</td>
            <td>
              <button
                class="icon-btn"
                :disabled="m.tipo !== 'entrada' || Boolean(m.anulada)"
                :title="m.tipo !== 'entrada' ? 'Las salidas no se editan' : m.anulada ? 'La entrada está anulada' : 'Actualizar entrada'"
                @click="abrirEditar(m)"
              >
                ✎
              </button>
            </td>
          </tr>
          <tr v-if="movimientosFiltrados.length === 0">
            <td colspan="8" class="muted">Sin movimientos con este filtro.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template #footer>
      <button class="btn btn-primary" type="button" @click="$emit('close')">Cerrar</button>
    </template>
  </BaseModal>

  <BaseModal
    v-if="modalEditar.abierto" extra-wide
    :title="modalEditar.confirmandoAnulacion ? 'Anular entrada' : 'Actualizar entrada'"
    @close="cerrarEditar"
  >
    <template v-if="modalEditar.confirmandoAnulacion">
      <p class="warning-box">
        Se descontarán {{ modalEditar.mov?.cantidad }} unidades de «{{ producto.nombre }}»
        y el costo del producto se recalculará con la última entrada con costo vigente. La entrada quedará
        en el historial como anulada; no se puede deshacer.
      </p>
      <p v-if="modalEditar.error" class="tasa-hint" style="color: var(--danger)">{{ modalEditar.error }}</p>
    </template>
    <template v-else>
    <p class="muted">
      Entrada del {{ formatFechaHoraUtc(modalEditar.mov?.creado_en) }} de «{{ producto.nombre }}»,
      registrada por {{ modalEditar.mov?.usuario_nombre || '—' }}. El inventario se ajustará con la diferencia.
    </p>
    <p v-if="vieneDeVenta(modalEditar.mov)" class="warning-box">
      Este movimiento viene de una anulación de venta; actualizarlo solo corrige el inventario, la venta no cambia.
    </p>
    <p v-if="modalEditar.esCompra && !esUltimaEntradaConCosto" class="muted" style="font-size: 11px">
      Hay una entrada con costo más reciente: corregir el costo aquí solo queda en el historial —
      el costo del producto y los precios se recalculan con el costo vigente.
    </p>
    <div class="entrada-grid">
      <div class="login-field col-cantidad">
        <label class="field-label" for="mov-editar-cantidad">Cantidad</label>
        <input id="mov-editar-cantidad" v-model.number="modalEditar.cantidad" class="input" type="number" min="1" step="1" />
      </div>
      <template v-if="modalEditar.esCompra">
        <div class="login-field col-proveedor">
          <label class="field-label" for="mov-editar-proveedor">Proveedor</label>
          <SearchSelect
            input-id="mov-editar-proveedor"
            v-model="modalEditar.proveedorId"
            :options="opcionesProveedores"
            placeholder="Buscar proveedor…"
          />
        </div>
        <div class="login-field col-costo">
          <label class="field-label" for="mov-editar-compra">Costo de compra (USD)</label>
          <input
            id="mov-editar-compra" :value="modalEditar.compra.texto" class="input num"
            inputmode="numeric" placeholder="0,00"
            @keydown="bloquearNoDigitos" @input="onMontoInput(modalEditar.compra, $event)"
          />
          <small class="costo-hint">(Ingrese el costo sin IVA)</small>
        </div>
      </template>
    </div>
    <template v-if="modalEditar.esCompra">
      <p v-if="modalEditar.cargando" class="muted">Cargando márgenes…</p>
      <div v-else class="login-field">
        <span class="field-label">Utilidad por tipo de precio</span>
        <MargenesTabla
          :filas="modalEditar.margenes"
          :costo-usd="costoParaPreview"
          :tasa-bcv="modalEditar.tasas.bcv"
        />
      </div>
    </template>
    <div class="login-field">
      <label class="field-label" for="mov-editar-nota">Nota</label>
      <input id="mov-editar-nota" v-model="modalEditar.nota" class="input" />
    </div>
    <p v-if="modalEditar.error" class="tasa-hint" style="color: var(--danger)">{{ modalEditar.error }}</p>
    </template>
    <template #footer>
      <template v-if="modalEditar.confirmandoAnulacion">
        <button class="btn btn-outline" type="button" @click="modalEditar.confirmandoAnulacion = false">Volver</button>
        <button class="btn btn-danger-ghost btn-rosa" type="button" :disabled="modalEditar.anulando" @click="anularEntrada">
          {{ modalEditar.anulando ? 'Anulando…' : 'Anular entrada' }}
        </button>
      </template>
      <template v-else>
        <button
          v-if="modalEditar.esCompra" class="btn btn-danger-ghost btn-anular" type="button"
          :disabled="modalEditar.guardando || modalEditar.cargando"
          @click="confirmarAnulacion"
        >
          Anular entrada
        </button>
        <button class="btn btn-outline" type="button" @click="cerrarEditar">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modalEditar.guardando || modalEditar.cargando" @click="guardarEdicion">
          {{ modalEditar.guardando ? 'Guardando…' : 'Guardar corrección' }}
        </button>
      </template>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import MargenesTabla from './MargenesTabla.vue'
import SearchSelect from './SearchSelect.vue'
import { aplicarMascaraTasa, bloquearNoDigitos, mascaraTasaDesdeNumero } from '../composables/useMascaras'
import { formatFechaHoraUtc } from '../composables/useFormato'
import { mensajeError } from '../composables/useErrores'

const props = defineProps({
  producto: { type: Object, required: true }
})
const emit = defineEmits(['close', 'actualizado'])

const movimientos = ref([])
const saldo = ref(0)
const cargando = ref(true)
const error = ref('')
const filtro = ref('todas')
// Costo vigente del producto (para el preview cuando la entrada editada no es la última)
const costoProducto = ref(props.producto.precio_compra_usd ?? null)

const movimientosFiltrados = computed(() =>
  filtro.value === 'todas' ? movimientos.value : movimientos.value.filter((m) => m.tipo === filtro.value)
)

// Un movimiento viene de una venta si tiene venta_id (salidas) o si es la
// devolución que genera una anulación. Editarlo solo corrige el inventario.
const vieneDeVenta = (m) => !!m?.venta_id || (m?.motivo || '').startsWith('Anulación')

async function recargar() {
  error.value = ''
  try {
    const [estado, prod] = await Promise.all([
      window.api.inventario.estadoProducto(props.producto.id),
      window.api.productos.obtener(props.producto.id)
    ])
    movimientos.value = estado.movimientos
    saldo.value = estado.saldo
    costoProducto.value = prod?.precio_compra_usd ?? null
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
}

onMounted(recargar)

const modalEditar = reactive({
  abierto: false,
  mov: null,
  cantidad: 0,
  nota: '',
  esCompra: false,
  proveedorId: null,
  proveedores: [],
  compra: { texto: '', valorUsd: null },
  margenes: [],
  tasas: { bcv: null, usdt: null },
  cargando: false,
  error: '',
  guardando: false,
  confirmandoAnulacion: false,
  anulando: false
})

const opcionesProveedores = computed(() =>
  modalEditar.proveedores.map((p) => ({ value: p.id, label: p.nombre }))
)

// El costo del producto es el de su última entrada con costo: si la editada
// no es esa, los precios se recalculan con el costo vigente, no con este.
const esUltimaEntradaConCosto = computed(() => {
  const m = modalEditar.mov
  if (!m) return false
  const ultima = movimientos.value.find((x) => x.tipo === 'entrada' && x.costo_usd != null && !x.anulada)
  return ultima?.id === m.id
})

const costoParaPreview = computed(() =>
  esUltimaEntradaConCosto.value ? modalEditar.compra.valorUsd : costoProducto.value
)

function onMontoInput(fila, event) {
  const digitos = event.target.value.replace(/\D/g, '').replace(/^0+/, '')
  const { texto, valor } = digitos ? aplicarMascaraTasa(digitos) : { texto: '', valor: null }
  fila.texto = texto
  fila.valorUsd = valor
  event.target.value = texto
}

async function abrirEditar(m) {
  if (m.tipo !== 'entrada' || m.anulada) return
  Object.assign(modalEditar, {
    abierto: true,
    mov: m,
    cantidad: m.cantidad,
    nota: m.motivo || '',
    esCompra: !vieneDeVenta(m),
    proveedorId: m.proveedor_id ?? null,
    compra: {
      texto: m.costo_usd == null ? '' : mascaraTasaDesdeNumero(m.costo_usd).texto,
      valorUsd: m.costo_usd ?? null
    },
    margenes: [],
    tasas: { bcv: null, usdt: null },
    cargando: false,
    error: '',
    guardando: false,
    confirmandoAnulacion: false,
    anulando: false
  })
  // Solo las entradas de compra editan proveedor/costo/márgenes.
  if (!modalEditar.esCompra) return
  modalEditar.cargando = true
  try {
    const [prov, ultima, listaPrecios] = await Promise.all([
      window.api.proveedores.listar(),
      window.api.tasas.obtenerUltima(),
      window.api.precios.listarPorProducto(m.producto_id)
    ])
    modalEditar.proveedores = prov.filter((p) => p.activo || p.id === m.proveedor_id)
    modalEditar.tasas = { bcv: ultima?.valor_bcv ?? null, usdt: ultima?.valor_usdt ?? null }
    modalEditar.margenes = listaPrecios.map((p) => ({
      tipoPrecioId: p.tipoPrecioId,
      nombre: p.tipoPrecioNombre,
      margen: p.margen,
      margenTexto: String(p.margen),
      origen: p.margenOrigen === 'propio' ? 'propio' : 'default',
      margenUsdt: p.margenUsdt ?? p.margen,
      margenUsdtTexto: String(p.margenUsdt ?? p.margen),
      origenUsdt: p.margenUsdtOrigen === 'propio' ? 'propio' : 'default'
    }))
  } catch (e) {
    modalEditar.error = mensajeError(e)
  } finally {
    modalEditar.cargando = false
  }
}

async function guardarEdicion() {
  if (!modalEditar.cantidad || modalEditar.cantidad <= 0) {
    modalEditar.error = 'La cantidad debe ser mayor a 0'
    return
  }
  if (modalEditar.esCompra && modalEditar.compra.texto && !(modalEditar.compra.valorUsd > 0)) {
    modalEditar.error = 'El costo de compra debe ser mayor a 0.'
    return
  }
  modalEditar.guardando = true
  modalEditar.error = ''
  try {
    const datos = {
      id: modalEditar.mov.id,
      cantidad: modalEditar.cantidad,
      motivo: modalEditar.nota.trim()
    }
    if (modalEditar.esCompra) {
      datos.proveedorId = modalEditar.proveedorId
      datos.precioCompraUsd = modalEditar.compra.valorUsd
      datos.costoConIva = false
      datos.margenes = modalEditar.margenes.map((f) => ({
        tipoPrecioId: f.tipoPrecioId,
        margen: f.margen,
      }))
    }
    await window.api.inventario.editarMovimiento(datos)
    modalEditar.abierto = false
    await recargar()
    emit('actualizado')
  } catch (e) {
    modalEditar.error = mensajeError(e)
  } finally {
    modalEditar.guardando = false
  }
}

function cerrarEditar() {
  modalEditar.abierto = false
  modalEditar.confirmandoAnulacion = false
}

function confirmarAnulacion() {
  modalEditar.confirmandoAnulacion = true
  modalEditar.error = ''
}

async function anularEntrada() {
  modalEditar.anulando = true
  modalEditar.error = ''
  try {
    await window.api.inventario.anularMovimiento(modalEditar.mov.id)
    cerrarEditar()
    await recargar()
    emit('actualizado')
  } catch (e) {
    modalEditar.error = mensajeError(e)
  } finally {
    modalEditar.anulando = false
  }
}
</script>

<style scoped>
.filtros-mov {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.btn-filtro {
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.btn-filtro:hover {
  background: var(--surface-alt);
}

.btn-filtro.activo {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Botón de actualizar por fila: verde y visible (mismo que en Operaciones) */
.icon-btn {
  border: 1px solid var(--success);
  padding: 7px 13px;
  color: var(--success);
  font-size: 16px;
}

.icon-btn:hover {
  background: var(--success);
  color: white;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn:disabled:hover {
  background: transparent;
  color: var(--text-muted);
}

.movimientos-scroll {
  max-height: 50vh;
}

/* Misma grilla de campos que el modal de entrada de mercancía */
.entrada-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0 16px;
}
.col-cantidad { grid-column: span 3; }
.col-proveedor { grid-column: span 5; }
.col-costo { grid-column: span 4; }
.costo-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}
@media (max-width: 720px) {
  .col-cantidad, .col-proveedor, .col-costo { grid-column: 1 / -1; }
}

/* Anular: borde izquierdo del footer y fondo rosadito tenue */
.btn-anular {
  margin-right: auto;
}
.btn-anular,
.btn-rosa {
  background: #fde8ec;
  border-color: #f6d2da;
}
.btn-anular:hover,
.btn-rosa:hover {
  background: #fbd9e0;
}
</style>
