<template>
  <section>
    <div class="view-header">
      <div>
        <RouterLink to="/menu" class="back-link">← Menú principal</RouterLink>
        <h1>Inventario</h1>
        <p>Catálogo de productos: consulta stock, mínimos y precios por tipo.</p>
      </div>
      <div style="display: flex; gap: 10px">
        <button class="btn btn-outline" :disabled="productosFiltrados.length === 0 || exportando" @click="exportarExcel">
          {{ exportando ? 'Exportando…' : 'Exportar a Excel' }}
        </button>
        <button v-if="puedeGestionar" class="btn btn-primary" @click="abrirCrear()">+ Nuevo producto</button>
      </div>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>
    <p v-if="tipos.length === 0 && !cargando" class="warning-box">
      No hay tipos de precio. Puedes crear productos, pero necesitas un tipo en Operaciones → Tipos de precio para registrar entradas.
    </p>

    <div class="toolbar">
      <div class="filters" style="flex: 1">
        <input
          v-model="busqueda"
          class="input"
          style="max-width: 420px"
          placeholder="Buscar por referencia, código de barra, nombre, marca o categoría…"
          aria-label="Buscar producto"
        />
        <div class="filtro-categoria">
          <SearchSelect
            v-model="categoriaFiltro"
            input-id="filtro-categoria"
            :options="opcionesCategoriaFiltro"
            placeholder="Todas las categorías"
          />
        </div>
      </div>
      <label class="muted ver-inactivos">
        <input v-model="mostrarInactivos" type="checkbox" @change="cargarTodo" />
        Mostrar desactivados
      </label>
    </div>

    <p v-if="cargando" class="muted">Cargando…</p>
    <div v-else class="card">
      <h3 class="titulo-tabla">Productos</h3>
      <div class="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th class="col-accion"></th>
              <th>Referencia / Nro. parte</th>
              <th>Código de barra</th>
              <th>Nombre</th>
              <th>Marca</th>
              <th>Categoría</th>
              <th style="text-align: right">Cantidad</th>
              <th style="text-align: right">Mínimo</th>
              <th style="text-align: right">Costo compra</th>
              <th v-for="t in tiposActivos" :key="t.id" style="text-align: right">
                {{ t.nombre }} <span class="muted" style="font-weight: 500">(s/IVA)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in productosFiltrados"
              :key="p.id"
              class="fila-producto"
              :class="{ 'fila-stock-bajo': esStockBajo(p), 'fila-inactiva': !p.activo }"
              tabindex="0"
              @click="abrirFicha(p)"
              @keydown.enter="abrirFicha(p)"
            >
              <td class="celda-accion">
                <button
                  class="btn-editar"
                  type="button"
                  :title="puedeGestionar ? 'Editar producto' : 'Ver producto'"
                  :aria-label="`${puedeGestionar ? 'Editar' : 'Ver'} ${p.nombre}`"
                  @click.stop="abrirFicha(p)"
                >
                  <svg v-if="puedeGestionar" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
                  </svg>
                  <svg v-else viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
                    <circle cx="8" cy="8" r="2" />
                  </svg>
                </button>
              </td>
              <td class="num">{{ p.codigo || '—' }}</td>
              <td class="num">{{ p.codigo_barras || '—' }}</td>
              <td>{{ p.nombre }}</td>
              <td>{{ p.marca || '—' }}</td>
              <td>
                <span v-if="p.categoria_nombre" class="tag tag-parcial">{{ p.categoria_nombre }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num" style="text-align: right">{{ p.stock }}</td>
              <td class="num" style="text-align: right">{{ p.stock_minimo ?? 0 }}</td>
              <td class="num" style="text-align: right">{{ p.precio_compra_usd == null ? '—' : formatUsd(p.precio_compra_usd) }}</td>
              <td v-for="t in tiposActivos" :key="t.id" style="text-align: right">
                <span v-if="precioDe(p.id, t.id)?.precioUsd != null" class="precio-tabla">
                  <strong>{{ formatMontoBs(precioDe(p.id, t.id).precioBs) }}</strong>
                  <small>
                    ≈ {{ formatUsd(precioDe(p.id, t.id).precioUsd) }}
                    <template v-if="precioDe(p.id, t.id).precioUsdt != null"> · {{ formatMontoUsdt(precioDe(p.id, t.id).precioUsdt) }}</template>
                  </small>
                </span>
                <span v-else class="muted">—</span>
              </td>
            </tr>
            <tr v-if="productosFiltrados.length === 0">
              <td :colspan="9 + tiposActivos.length" class="muted celda-vacia">
                <template v-if="busqueda.trim()">
                  No se encontró «{{ busqueda.trim() }}».
                  <button v-if="puedeGestionar" class="btn btn-outline btn-crear-busqueda" type="button" @click="abrirCrear(busqueda.trim())">
                    Crear producto "{{ busqueda.trim() }}"
                  </button>
                </template>
                <template v-else>Aún no hay productos.<template v-if="puedeGestionar"> Crea el primero con «+ Nuevo producto».</template></template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ProductoFichaModal
      v-if="fichaProducto"
      :key="fichaProducto.id"
      :producto="fichaProducto"
      :solo-lectura="!puedeGestionar"
      :puede-ver-movimientos="puedeVerMovimientos"
      @close="fichaProducto = null"
      @editar="abrirEditar"
      @entrada="abrirEntrada"
      @eliminar="pedirEliminar"
      @reactivar="reactivar"
      @movimientos="verMovimientos"
    />

    <BaseModal v-if="modal.abierto" :extra-wide="Boolean(modal.id)" :title="modal.id ? 'Editar producto' : 'Nuevo producto'" @close="cerrarEdicion">
      <template #icon>
        <span class="modal-icono">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </template>
      <template #header-extra>
        <span class="tag tag-parcial">Catálogo</span>
      </template>
      <template #subtitle>
        <p class="modal-subtitulo">{{ modal.id ? 'Actualiza los datos del artículo en el inventario.' : 'Registra un nuevo artículo o repuesto en el inventario.' }}</p>
      </template>

      <div class="form-grid">
        <div class="login-field">
          <label class="field-label" for="prod-codigo">Referencia / Nro. de parte</label>
          <div class="input-icono">
            <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6 6h.008v.008H6V6Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <input id="prod-codigo" v-model="form.codigo" class="input" placeholder="Ej. FO-1089" />
          </div>
        </div>
        <div class="login-field">
          <div class="label-fila">
            <label class="field-label" for="prod-barra">Código de barra</label>
            <span class="hint">Opcional</span>
          </div>
          <div class="input-icono">
            <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h3.75v3.75H13.5z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <input id="prod-barra" v-model="form.codigoBarras" class="input num" placeholder="Ej. 7591234567890" />
          </div>
        </div>
      </div>
      <div class="form-grid">
        <div class="login-field">
          <label class="field-label" for="prod-marca">Marca</label>
          <input id="prod-marca" v-model="form.marca" class="input" placeholder="Ej. Fram" />
        </div>
        <div class="login-field">
          <div class="label-fila">
            <label class="field-label" for="prod-categoria">Categoría</label>
            <span class="hint">Opcional</span>
          </div>
          <SearchSelect
            v-model="form.categoriaId"
            input-id="prod-categoria"
            :options="opcionesCategoriaForm"
            placeholder="Buscar categoría…"
          />
        </div>
      </div>
      <div class="login-field">
        <div class="label-fila">
          <label class="field-label" for="prod-nombre">Nombre del producto <span style="color: var(--danger)">*</span></label>
          <span class="hint">Obligatorio</span>
        </div>
        <input id="prod-nombre" v-model="form.nombre" class="input" placeholder="Ej. Filtro de aceite Corolla 2009-2018" />
      </div>
      <div class="login-field">
        <div class="label-fila">
          <label class="field-label" for="prod-descripcion">Descripción</label>
          <span class="hint">Opcional</span>
        </div>
        <input id="prod-descripcion" v-model="form.descripcion" class="input" placeholder="Ej. Compatible con Corolla 1.8, rosca M20" />
      </div>
      <div class="form-grid">
        <div class="login-field">
          <div class="label-fila">
            <label class="field-label" for="prod-minimo">Inventario mínimo</label>
            <span class="hint">Alerta de reposición</span>
          </div>
          <div class="stepper">
            <button type="button" aria-label="Disminuir" tabindex="-1" @click="ajustarMinimo(-1)">−</button>
            <input
              id="prod-minimo" v-model="form.stockMinimo"
              type="text" inputmode="numeric" placeholder="0"
              @input="form.stockMinimo = String(form.stockMinimo).replace(/\D/g, '')"
            />
            <button type="button" aria-label="Aumentar" tabindex="-1" @click="ajustarMinimo(1)">+</button>
          </div>
        </div>
        <div class="login-field">
          <div class="label-fila">
            <label class="field-label" for="prod-ubicacion">Ubicación / Estante</label>
            <span class="hint">Opcional</span>
          </div>
          <div class="input-icono">
            <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <input id="prod-ubicacion" v-model="form.ubicacion" class="input" placeholder="Ej. Estante A3, Nivel 2" />
          </div>
        </div>
      </div>

      <div v-if="modal.id" class="login-field">
        <span class="field-label">Utilidad por tipo de precio</span>
        <p v-if="modal.cargandoMargenes" class="muted">Cargando márgenes…</p>
        <template v-else>
          <MargenesTabla
            :filas="margenes"
            :costo-usd="form.costoUsd"
            :tasa-bcv="tasas.bcv"
            :tasa-usdt="tasas.usdt"
          />
          <p class="muted" style="font-size: 11px; margin: 6px 0 0">
            Los precios se calculan sobre el último costo de compra
            ({{ form.costoUsd == null ? 'sin costo todavía' : formatUsd(form.costoUsd) }}).
            Un solo % de utilidad por tipo — es el mismo en ambos métodos y editable desde cualquiera.
          </p>
        </template>
      </div>

      <p v-if="modal.error" style="color: var(--danger); font-size: 11px; margin-top: 10px">{{ modal.error }}</p>

      <template #footer>
        <button class="btn btn-outline" type="button" @click="cerrarEdicion">Cancelar</button>
        <button v-if="!modal.id" class="btn btn-outline" type="button" :disabled="modal.guardando || tipos.length === 0" @click="guardar(true)">
          <svg style="width: 14px; height: 14px" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 4.5v15m7.5-7.5h-15" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Guardar y registrar entrada
        </button>
        <button class="btn btn-primary" type="button" :disabled="modal.guardando || modal.cargandoMargenes" @click="guardar(false)">
          <svg style="width: 14px; height: 14px" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path d="m4.5 12.75 6 6 9-13.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ modal.guardando ? 'Guardando…' : 'Guardar producto' }}
        </button>
      </template>
    </BaseModal>

    <EntradaProductoModal
      v-if="modalEntrada && productoEntradaId"
      :producto-id="productoEntradaId"
      :productos="productos"
      producto-fijo
      @close="cerrarEntrada"
      @saved="entradaGuardada"
    />

    <ConfirmModal
      v-if="confirmEliminar.abierto"
      title="Eliminar producto"
      :message="`¿Eliminar «${confirmEliminar.producto?.nombre}»? Si ya tiene ventas o movimientos de inventario se desactivará en lugar de borrarse (el historial se conserva).`"
      confirm-text="Eliminar"
      @confirm="confirmarEliminar"
      @cancel="confirmEliminar.abierto = false"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseModal from '../components/BaseModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import EntradaProductoModal from '../components/EntradaProductoModal.vue'
import ProductoFichaModal from '../components/ProductoFichaModal.vue'
import MargenesTabla from '../components/MargenesTabla.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { puedeHacer } from '../composables/usePermisos'
import { formatUsd, formatMontoBs, formatMontoUsdt } from '../composables/useFormato'
import { exportarXlsx } from '../composables/useExportarXlsx'
import { mensajeError } from '../composables/useErrores'

const router = useRouter()

// Vendedor: consulta el catálogo y la ficha, pero no crea, edita, elimina
// productos ni registra entradas (el backend lo rechaza igualmente).
const puedeGestionar = computed(() => puedeHacer('catalogo.gestionar'))
const puedeVerMovimientos = computed(() => puedeHacer('inventario.gestionar'))

const productos = ref([])
const tipos = ref([])
const preciosCatalogo = ref([])
const cargando = ref(true)
const error = ref('')
const exportando = ref(false)
const mostrarInactivos = ref(false)
const busqueda = ref('')

const fichaProducto = ref(null)
const modalEntrada = ref(false)
const productoEntradaId = ref(null)
// Cuando el producto se crea desde una búsqueda sin resultados, guardarlo
// abre directo la entrada de mercancía (flujo aprobado).
let abrirEntradaTrasCrear = false

const normalizar = (t) =>
  (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')


// Categorías de producto (todas, para mostrar también las desactivadas que
// ya tenga algún producto). En el formulario solo se ofrecen las activas más
// la que el producto ya tenía; el filtro ofrece todas.
const categorias = ref([])
const categoriaFiltro = ref(null)
const SIN_CATEGORIA = 0
const opcionesCategoriaFiltro = computed(() => [
  { value: SIN_CATEGORIA, label: 'Sin categoría' },
  ...categorias.value.map((c) => ({ value: c.id, label: c.activo ? c.nombre : `${c.nombre} (inactiva)` }))
])
const opcionesCategoriaForm = computed(() =>
  categorias.value
    .filter((c) => c.activo || c.id === form.categoriaId)
    .map((c) => ({ value: c.id, label: c.activo ? c.nombre : `${c.nombre} (inactiva)` }))
)

const productosFiltrados = computed(() => {
  const palabras = normalizar(busqueda.value).split(/\s+/).filter(Boolean)
  return productos.value.filter((p) => {
    if (categoriaFiltro.value === SIN_CATEGORIA && p.categoria_id != null) return false
    if (categoriaFiltro.value && p.categoria_id !== categoriaFiltro.value) return false
    if (!palabras.length) return true
    const texto = normalizar(
      `${p.nombre} ${p.codigo || ''} ${p.codigo_barras || ''} ${p.marca || ''} ${p.ubicacion || ''} ${p.categoria_nombre || ''}`
    )
    return palabras.every((x) => texto.includes(x))
  })
})

const esStockBajo = (p) =>
  Boolean(p.stock_bajo) || ((p.stock_minimo ?? 0) > 0 && p.stock <= p.stock_minimo)

// Tipos de precio visibles como columnas de la tabla (orden del catálogo).
const tiposActivos = computed(() => tipos.value.filter((t) => t.activo !== 0))

// productoId → tipoPrecioId → fila calculada (margen, precioUsd/Bs/Usdt).
const preciosPorProducto = computed(() => {
  const mapa = new Map()
  for (const fila of preciosCatalogo.value) {
    if (!mapa.has(fila.productoId)) mapa.set(fila.productoId, new Map())
    mapa.get(fila.productoId).set(fila.tipoPrecioId, fila)
  }
  return mapa
})

const precioDe = (productoId, tipoPrecioId) =>
  preciosPorProducto.value.get(productoId)?.get(tipoPrecioId) ?? null

async function cargarTodo() {
  cargando.value = true
  error.value = ''
  try {
    const [listaProductos, listaTipos, listaPrecios, listaCategorias] = await Promise.all([
      window.api.productos.listar({ incluirInactivos: mostrarInactivos.value }),
      window.api.tiposPrecio.listar(),
      window.api.precios.listarCatalogo(),
      window.api.categoriasProducto.listar({ incluirInactivas: true })
    ])
    productos.value = listaProductos
    tipos.value = listaTipos
    preciosCatalogo.value = listaPrecios
    categorias.value = listaCategorias
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
}

function abrirFicha(p) {
  fichaProducto.value = p
}

// La ficha no muestra los movimientos (son muchos): lleva a la pantalla de
// operaciones con el producto ya seleccionado.
function verMovimientos(producto) {
  fichaProducto.value = null
  router.push({ path: '/operaciones-inventario', query: { producto: producto.id } })
}

// ---------- formulario crear/editar ----------
const modal = reactive({ abierto: false, id: null, guardando: false, error: '', cargandoMargenes: false })
const form = reactive({
  codigo: '',
  codigoBarras: '',
  nombre: '',
  marca: '',
  descripcion: '',
  unidadMedida: 'unidad',
  ubicacion: '',
  categoriaId: null,
  stockMinimo: '0',
  costoUsd: null
})

// El stepper mueve el mínimo de a 1 sin soltar el foco del formulario.
function ajustarMinimo(delta) {
  const actual = parseInt(form.stockMinimo, 10)
  form.stockMinimo = String(Math.max(0, (Number.isInteger(actual) ? actual : 0) + delta))
}
const margenes = ref([])
const margenesCargados = ref(false)
const tasas = ref({ bcv: null, usdt: null })

function resetForm() {
  Object.assign(form, {
    codigo: '',
    codigoBarras: '',
    nombre: '',
    marca: '',
    descripcion: '',
    unidadMedida: 'unidad',
    ubicacion: '',
    categoriaId: null,
    stockMinimo: '0',
    costoUsd: null
  })
  margenes.value = []
  margenesCargados.value = false
}

function abrirCrear(textoBusqueda = '') {
  resetForm()
  abrirEntradaTrasCrear = Boolean(textoBusqueda)
  // Si lo que se buscó parece una referencia/código (tiene dígitos), se
  // precarga como referencia; si no, como nombre del producto.
  if (textoBusqueda) {
    if (/\d/.test(textoBusqueda)) form.codigo = textoBusqueda
    else form.nombre = textoBusqueda
  }
  Object.assign(modal, { abierto: true, id: null, error: '', guardando: false, cargandoMargenes: false })
}

async function cargarTasas() {
  try {
    const ultima = await window.api.tasas.obtenerUltima()
    tasas.value = { bcv: ultima?.valor_bcv ?? null, usdt: ultima?.valor_usdt ?? null }
  } catch {
    tasas.value = { bcv: null, usdt: null }
  }
}

async function cargarFilasMargenes(productoId) {
  try {
    const lista = await window.api.precios.listarPorProducto(productoId)
    return lista.map((p) => ({
      tipoPrecioId: p.tipoPrecioId,
      nombre: p.tipoPrecioNombre,
      margen: p.margen,
      margenTexto: String(p.margen),
      origen: p.margenOrigen === 'propio' ? 'propio' : 'default'
    }))
  } catch {
    return tipos.value
      .filter((t) => t.activo !== 0)
      .map((t) => ({
        tipoPrecioId: t.id,
        nombre: t.nombre,
        margen: t.margen_default ?? 100,
        margenTexto: String(t.margen_default ?? 100),
        origen: 'default'
      }))
  }
}

// Si la edición o la entrada se cerraron desde la ficha, cancelarlas
// reabre la ficha del producto (no queda la pantalla "vacía").
function cerrarEdicion() {
  modal.abierto = false
  if (!modal.id) return
  fichaProducto.value = productos.value.find((p) => p.id === modal.id) ?? null
}

function cerrarEntrada() {
  modalEntrada.value = false
  fichaProducto.value = productos.value.find((p) => p.id === productoEntradaId.value) ?? null
}

async function abrirEditar(producto) {
  fichaProducto.value = null
  abrirEntradaTrasCrear = false
  error.value = ''
  try {
    const completo = await window.api.productos.obtener(producto.id)
    Object.assign(form, {
      codigo: completo.codigo || '',
      codigoBarras: completo.codigo_barras || '',
      nombre: completo.nombre,
      marca: completo.marca || '',
      descripcion: completo.descripcion || '',
      unidadMedida: completo.unidad_medida || 'unidad',
      ubicacion: completo.ubicacion || '',
      categoriaId: completo.categoria_id ?? null,
      stockMinimo: String(completo.stock_minimo ?? 0),
      costoUsd: completo.precio_compra_usd ?? null
    })
    Object.assign(modal, { abierto: true, id: producto.id, error: '', guardando: false, cargandoMargenes: true })
    const [, filas] = await Promise.all([cargarTasas(), cargarFilasMargenes(producto.id)])
    margenes.value = filas
    margenesCargados.value = true
    modal.cargandoMargenes = false
  } catch (e) {
    modal.cargandoMargenes = false
    error.value = mensajeError(e)
  }
}

async function guardar(registrarEntrada = false) {
  modal.error = ''
  if (!form.nombre.trim()) {
    modal.error = 'El nombre del producto es obligatorio.'
    return
  }
  const minimo = parseInt(form.stockMinimo, 10)
  if (!Number.isInteger(minimo) || minimo < 0) {
    modal.error = 'El inventario mínimo debe ser un entero mayor o igual a 0.'
    return
  }
  const datos = {
    codigo: form.codigo,
    codigoBarras: form.codigoBarras,
    nombre: form.nombre,
    marca: form.marca,
    descripcion: form.descripcion,
    unidadMedida: form.unidadMedida,
    ubicacion: form.ubicacion,
    categoriaId: form.categoriaId,
    stockMinimo: minimo
  }
  // Solo se envían los márgenes si terminaron de cargar: mandar una tabla
  // vacía haría que el backend sobrescriba los márgenes propios con el
  // default del tipo.
  if (modal.id && margenesCargados.value) {
    datos.margenes = margenes.value.map((f) => ({ tipoPrecioId: f.tipoPrecioId, margen: f.margen }))
  }

  modal.guardando = true
  try {
    let productoId = modal.id
    if (modal.id) {
      await window.api.productos.actualizar(modal.id, datos)
    } else {
      const nuevo = await window.api.productos.crear(datos)
      productoId = nuevo.id
    }
    modal.abierto = false
    await cargarTodo()
    if (productoId && (registrarEntrada || abrirEntradaTrasCrear)) {
      abrirEntrada(productos.value.find((p) => p.id === productoId))
    } else if (productoId) {
      // Si venía de la ficha, se reabre con los datos ya actualizados.
      const actualizado = productos.value.find((p) => p.id === productoId)
      if (modal.id && actualizado) fichaProducto.value = actualizado
    }
  } catch (e) {
    modal.error = mensajeError(e)
  } finally {
    modal.guardando = false
    abrirEntradaTrasCrear = false
  }
}

// ---------- ficha → entrada ----------
function abrirEntrada(producto) {
  if (!producto) return
  fichaProducto.value = null
  productoEntradaId.value = producto.id
  modalEntrada.value = true
}

async function entradaGuardada(id) {
  modalEntrada.value = false
  await cargarTodo()
  const actualizado = productos.value.find((p) => p.id === id)
  if (actualizado) fichaProducto.value = actualizado
}

// ---------- eliminar / reactivar ----------
const confirmEliminar = reactive({ abierto: false, producto: null })

function pedirEliminar(producto) {
  confirmEliminar.abierto = true
  confirmEliminar.producto = producto
}

async function confirmarEliminar() {
  const producto = confirmEliminar.producto
  confirmEliminar.abierto = false
  error.value = ''
  try {
    await window.api.productos.eliminar(producto.id)
    await cargarTodo()
    // Si se desactivó (tenía historial) la ficha se refresca; si se borró
    // de verdad, se cierra porque ya no está en la lista.
    fichaProducto.value = productos.value.find((p) => p.id === producto.id) ?? null
  } catch (e) {
    error.value = mensajeError(e)
  }
}

async function reactivar(producto) {
  error.value = ''
  try {
    await window.api.productos.reactivar(producto.id)
    await cargarTodo()
    const actualizado = productos.value.find((p) => p.id === producto.id)
    if (actualizado) fichaProducto.value = actualizado
  } catch (e) {
    error.value = mensajeError(e)
  }
}

// ---------- exportar: solo las filas filtradas ----------
async function exportarExcel() {
  exportando.value = true
  error.value = ''
  try {
    const encabezados = ['Referencia / Nro. parte', 'Código de barra', 'Nombre', 'Marca', 'Categoría', 'Descripción', 'Ubicación', 'Cantidad', 'Mínimo', 'Costo compra (USD)']
    for (const t of tiposActivos.value) {
      encabezados.push(`${t.nombre} (USD)`, `${t.nombre} (Bs)`, `${t.nombre} (USDT)`)
    }
    const filas = productosFiltrados.value.map((p) => {
      const base = [
        p.codigo || '', p.codigo_barras || '', p.nombre, p.marca || '', p.categoria_nombre || '', p.descripcion || '',
        p.ubicacion || '', p.stock, p.stock_minimo ?? 0, p.precio_compra_usd
      ]
      for (const t of tiposActivos.value) {
        const precio = precioDe(p.id, t.id)
        base.push(precio?.precioUsd ?? null, precio?.precioBs ?? null, precio?.precioUsdt ?? null)
      }
      return base
    })
    exportarXlsx(`productos-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: 'Productos',
        encabezados,
        filas
      }
    ])
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    exportando.value = false
  }
}

onMounted(cargarTodo)
</script>

<style scoped>
.titulo-tabla {
  margin: 0;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  min-height: 48px;
  border-bottom: 1px solid var(--border);
}
.tabla-scroll {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}
.fila-producto {
  cursor: pointer;
}
.col-accion {
  width: 44px;
}
.celda-accion {
  text-align: center;
}
.btn-editar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--primary);
  cursor: pointer;
  padding: 0;
}
.btn-editar:hover {
  border-color: var(--primary);
  background: var(--primary-light);
}
.btn-editar:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.fila-producto:hover td {
  background: var(--surface-alt);
}
.fila-producto:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.fila-inactiva td {
  color: var(--text-muted);
}
.precio-tabla {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
}
.precio-tabla small {
  color: var(--text-muted);
  font-size: 11px;
}
.celda-vacia {
  text-align: center;
  padding: 28px 14px;
}
.btn-crear-busqueda {
  margin-left: 10px;
  min-height: 34px;
  padding: 6px 12px;
}
.ver-inactivos {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.filtro-categoria {
  width: 240px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}
</style>
