<template>
  <section>
    <div class="view-header">
      <div>
        <RouterLink to="/configuracion" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Operaciones
        </RouterLink>
        <h1>Operaciones de entrada y salida</h1>
        <p>Consulta movimientos y registra entradas o ajustes de inventario.</p>
      </div>
      <div style="display: flex; gap: 10px">
        <button class="btn btn-outline" :disabled="productos.length === 0 || exportando" @click="exportarExcel">
          {{ exportando ? 'Exportando…' : 'Exportar a Excel' }}
        </button>
        <button class="btn btn-outline" :disabled="productos.length === 0" @click="abrirModal">
          Ajuste de salida
        </button>
        <button class="btn btn-primary" :disabled="productos.length === 0" @click="modalEntrada = true">
          + Registrar entrada
        </button>
      </div>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 20px">
      <KpiCard lbl="Productos activos" :val="resumen.productos.toLocaleString('es-VE')" sub="En el catálogo de venta" />
      <KpiCard lbl="Unidades en stock" :val="resumen.unidades.toLocaleString('es-VE')" sub="Suma de existencias" />
      <div class="card kpi-card">
        <div class="lbl">Productos sin stock</div>
        <div class="val" :style="{ color: resumen.sin_stock > 0 ? 'var(--danger)' : '' }">
          {{ resumen.sin_stock.toLocaleString('es-VE') }}
        </div>
        <div class="sub">No se pueden vender hasta registrar una entrada</div>
      </div>
    </div>

    <div class="inventario-layout">
      <div class="card">
        <div class="tabla-header">
          <h3 class="titulo-tabla">Existencias</h3>
          <input v-model="busqueda" class="input" style="max-width: 260px" placeholder="Buscar producto…" />
        </div>
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th style="text-align: right">Stock</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in productosFiltrados"
                :key="p.id"
                class="fila-producto"
                :class="{ seleccionada: p.id === productoSelId }"
                @click="seleccionar(p.id)"
              >
                <td class="num">{{ p.codigo || '—' }}</td>
                <td>
                  {{ p.nombre }}
                  <div v-if="p.marca" class="muted" style="font-size: 11px">{{ p.marca }}</div>
                </td>
                <td class="num" style="text-align: right" :style="{ color: p.stock <= 0 ? 'var(--danger)' : '' }">
                  {{ p.stock }}
                </td>
              </tr>
              <tr v-if="productosFiltrados.length === 0">
                <td colspan="3" class="muted">
                  {{ productos.length === 0 ? 'No hay productos. Créalos en Inventario.' : 'Sin resultados.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="tabla-header">
          <h3 class="titulo-tabla">
            {{ productoSel ? `Movimientos: ${productoSel.nombre}` : 'Movimientos' }}
          </h3>
          <div v-if="productoSel" class="filtro-botones">
            <button class="btn-filtro" :class="{ activo: filtro === 'todas' }" @click="filtro = 'todas'">Todas</button>
            <button class="btn-filtro" :class="{ activo: filtro === 'entrada' }" @click="filtro = 'entrada'">Entradas</button>
            <button class="btn-filtro" :class="{ activo: filtro === 'salida' }" @click="filtro = 'salida'">Salidas</button>
          </div>
        </div>
        <p v-if="!productoSel" class="cart-empty">Selecciona un producto de la lista para ver sus movimientos.</p>
        <div v-else class="tabla-scroll">
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
                </td>
                <td class="num">{{ m.tipo === 'entrada' ? '+' : '−' }}{{ m.cantidad }}</td>
                <td>{{ m.proveedor_nombre || '—' }}</td>
                <td>{{ m.motivo }}</td>
                <td>{{ m.usuario_nombre || '—' }}</td>
                <td class="num">{{ m.saldo }}</td>
                <td>
                  <button
                    class="icon-btn"
                    :disabled="m.tipo !== 'entrada'"
                    :title="m.tipo === 'entrada' ? 'Actualizar entrada' : 'Las salidas no se editan'"
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
      </div>
    </div>

    <EntradaProductoModal
      v-if="modalEntrada"
      :producto-id="productoSelId"
      :productos="productos"
      @close="modalEntrada = false"
      @saved="entradaGuardada"
    />

    <BaseModal v-if="modal.abierto" title="Ajuste de salida" @close="modal.abierto = false">
      <div class="login-field">
        <label class="field-label">Producto</label>
        <ProductoCombobox v-model="modal.productoId" :productos="productos" />
      </div>
      <div class="login-field">
        <label class="field-label">Cantidad</label>
        <input v-model.number="modal.cantidad" class="input" type="number" min="1" />
      </div>
      <div class="login-field">
        <label class="field-label">Motivo *</label>
        <input v-model="modal.nota" class="input" placeholder="Ej. Pieza dañada, garantía" />
      </div>
      <p v-if="modal.error" class="tasa-hint" style="color: var(--danger)">{{ modal.error }}</p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modal.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modal.guardando" @click="guardar">
          {{ modal.guardando ? 'Guardando…' : 'Guardar ajuste' }}
        </button>
      </template>
    </BaseModal>

    <BaseModal v-if="modalEditar.abierto" title="Actualizar entrada" @close="modalEditar.abierto = false">
      <p class="muted">
        Entrada del {{ formatFechaHoraUtc(modalEditar.mov?.creado_en) }} registrada por
        {{ modalEditar.mov?.usuario_nombre || '—' }}. El inventario se ajustará con la diferencia.
      </p>
      <p v-if="vieneDeVenta(modalEditar.mov)" class="warning-box">
        Este movimiento viene de una anulación de venta; actualizarlo solo corrige el inventario, la venta no cambia.
      </p>
      <div class="login-field">
        <label class="field-label">Cantidad</label>
        <input v-model.number="modalEditar.cantidad" class="input" type="number" min="1" />
      </div>
      <div class="login-field">
        <label class="field-label">Nota</label>
        <input v-model="modalEditar.nota" class="input" />
      </div>
      <p v-if="modalEditar.error" class="tasa-hint" style="color: var(--danger)">{{ modalEditar.error }}</p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalEditar.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modalEditar.guardando" @click="guardarEdicion">
          {{ modalEditar.guardando ? 'Guardando…' : 'Guardar corrección' }}
        </button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseModal from '../components/BaseModal.vue'
import KpiCard from '../components/KpiCard.vue'
import ProductoCombobox from '../components/ProductoCombobox.vue'
import EntradaProductoModal from '../components/EntradaProductoModal.vue'
import { session } from '../store/session'
import { exportarInventario } from '../composables/useExportarInventario'
import { formatFechaHoraUtc } from '../composables/useFormato'
import { mensajeError } from '../composables/useErrores'
import { alCambiar } from '../composables/useEventos'

const route = useRoute()

const productos = ref([])
const resumen = ref({ productos: 0, unidades: 0, sin_stock: 0 })
const movimientos = ref([])
const productoSelId = ref(null)
const busqueda = ref('')
const error = ref('')
const exportando = ref(false)
const filtro = ref('todas')

const normalizar = (t) =>
  (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const productosFiltrados = computed(() => {
  const palabras = normalizar(busqueda.value).split(/\s+/).filter(Boolean)
  if (!palabras.length) return productos.value
  return productos.value.filter((p) => {
    const texto = normalizar(`${p.nombre} ${p.codigo || ''} ${p.marca || ''}`)
    return palabras.every((x) => texto.includes(x))
  })
})

const productoSel = computed(() => productos.value.find((p) => p.id === productoSelId.value) ?? null)

const movimientosFiltrados = computed(() =>
  filtro.value === 'todas' ? movimientos.value : movimientos.value.filter((m) => m.tipo === filtro.value)
)

// Un movimiento viene de una venta si tiene venta_id (salidas) o si es la
// devolución que genera una anulación. Editarlo solo corrige el inventario.
const vieneDeVenta = (m) => !!m?.venta_id || (m?.motivo || '').startsWith('Anulación')

async function cargarProductos() {
  const [lista, res] = await Promise.all([window.api.productos.listar(), window.api.inventario.resumen()])
  productos.value = lista
  resumen.value = res
}

async function cargarMovimientos() {
  if (!productoSelId.value) {
    movimientos.value = []
    return
  }
  movimientos.value = (await window.api.inventario.estadoProducto(productoSelId.value)).movimientos
}

async function recargar() {
  error.value = ''
  try {
    await Promise.all([cargarProductos(), cargarMovimientos()])
  } catch (e) {
    error.value = mensajeError(e)
  }
}

async function seleccionar(id) {
  productoSelId.value = id
  filtro.value = 'todas'
  try {
    await cargarMovimientos()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

const modal = reactive({ abierto: false, productoId: null, cantidad: null, nota: '', error: '', guardando: false })
const modalEntrada = ref(false)
const modalEditar = reactive({ abierto: false, mov: null, cantidad: 0, nota: '', error: '', guardando: false })

async function entradaGuardada(id) {
  modalEntrada.value = false
  productoSelId.value = id
  await recargar()
}

function abrirModal() {
  Object.assign(modal, {
    abierto: true,
    productoId: productoSelId.value,
    cantidad: null,
    nota: '',
    error: '',
    guardando: false
  })
}

async function guardar() {
  if (!modal.productoId) {
    modal.error = 'Selecciona un producto'
    return
  }
  if (!modal.cantidad || modal.cantidad <= 0) {
    modal.error = 'La cantidad debe ser mayor a 0'
    return
  }
  modal.guardando = true
  modal.error = ''
  const datos = {
    productoId: modal.productoId,
    cantidad: modal.cantidad,
    motivo: modal.nota.trim(),
    usuarioId: session.usuario.id
  }
  try {
    await window.api.inventario.registrarAjusteSalida(datos)
    modal.abierto = false
    productoSelId.value = modal.productoId
    await recargar()
  } catch (e) {
    modal.error = mensajeError(e)
  } finally {
    modal.guardando = false
  }
}

function abrirEditar(m) {
  Object.assign(modalEditar, { abierto: true, mov: m, cantidad: m.cantidad, nota: m.motivo || '', error: '', guardando: false })
}

async function guardarEdicion() {
  if (!modalEditar.cantidad || modalEditar.cantidad <= 0) {
    modalEditar.error = 'La cantidad debe ser mayor a 0'
    return
  }
  modalEditar.guardando = true
  modalEditar.error = ''
  try {
    await window.api.inventario.editarMovimiento({
      id: modalEditar.mov.id,
      cantidad: modalEditar.cantidad,
      motivo: modalEditar.nota.trim()
    })
    modalEditar.abierto = false
    await recargar()
  } catch (e) {
    modalEditar.error = mensajeError(e)
  } finally {
    modalEditar.guardando = false
  }
}

async function exportarExcel() {
  exportando.value = true
  error.value = ''
  try {
    await exportarInventario()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    exportando.value = false
  }
}

// ?producto=<id> llega desde la ficha del producto («Ver todos los movimientos»).
async function aplicarProductoDeRuta() {
  const id = Number(route.query.producto)
  if (!id || !productos.value.some((p) => p.id === id)) return
  await seleccionar(id)
}

alCambiar(['catalogo', 'inventario', 'proveedores', 'tasas'], () => recargar().catch(() => {}))

onMounted(async () => {
  await recargar()
  await aplicarProductoDeRuta()
})

watch(() => route.query.producto, aplicarProductoDeRuta)
</script>

<style scoped>
/* ESTÁNDAR: títulos de tablas centrados verticalmente con padding */
.titulo-tabla {
  margin: 0;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  min-height: 48px;
}

.tabla-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  min-height: 56px;
}

.tabla-header .titulo-tabla {
  padding: 0;
  min-height: 48px;
}

.inventario-layout {
  display: grid;
  grid-template-columns: minmax(320px, 2fr) 3fr;
  gap: 20px;
  align-items: flex-start;
}

.tabla-scroll {
  max-height: calc(100vh - 360px);
  overflow-y: auto;
}

.fila-producto {
  cursor: pointer;
}

.fila-producto:hover td {
  background: var(--surface-alt);
}

.fila-producto.seleccionada td {
  background: var(--primary-light);
}

.filtro-botones {
  display: flex;
  gap: 8px;
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

/* Botón de actualizar por fila: verde y visible */
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
</style>
