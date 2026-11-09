<template>
  <section>
    <div class="view-header">
      <div>
        <h1>Nueva venta</h1>
        <p>Agrega productos al ticket y asigna un precio a cada uno.</p>
      </div>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>
    <p v-else-if="cargando" class="muted">Cargando…</p>

    <div v-else class="venta-layout">
      <div class="venta-ticket-col">
        <div class="card cart-panel">
          <div class="login-field">
            <label class="field-label">Cliente *</label>
            <ClienteCombobox v-model="clienteSeleccionadoId" :clientes="clientes" @crear-cliente="abrirModalCliente" />
          </div>
          <div class="login-field">
            <label class="field-label">Producto</label>
            <ProductoCombobox ref="buscadorRef" :productos="productos" :iva-porcentaje="ivaConfigurado" limpiar-al-seleccionar @seleccionar="agregarProducto" />
          </div>

          <div class="cart-title">
            <h3>Ticket actual</h3>
            <div style="display: flex; align-items: center; gap: 10px">
              <span class="muted" style="font-size: 11px">{{ carrito.length }} {{ carrito.length === 1 ? 'item' : 'items' }}</span>
              <button v-if="carrito.length > 0" type="button" class="btn btn-outline" @click="limpiarTicket">
                Vaciar ticket
              </button>
            </div>
          </div>

          <div v-if="carrito.length === 0" class="cart-empty">Aún no has agregado productos al ticket</div>
          <div v-else>
            <div class="cart-item-header">
              <span class="remove-spacer"></span>
              <span class="info"></span>
              <span class="qty-label">Cantidad</span>
              <span class="subtotal-label">Subtotal</span>
            </div>
            <CartItem
              v-for="item in carritoDetallado"
              :key="item.productoId"
              :item="item"
              :selected="productoActivoId === item.productoId"
              @select="productoActivoId = item.productoId"
              @set-cantidad="(v) => setCantidad(item.productoId, v)"
              @confirmar-cantidad="(v) => confirmarCantidadConTope(item.productoId, v)"
              @remove="quitarDelCarrito(item.productoId)"
            />
          </div>

          <div class="cart-totals">
            <div class="row">
              <span>{{ ivaPorcentaje > 0 ? 'Subtotal sin IVA' : 'Subtotal' }}</span>
              <span class="num">{{ formatMontoBs(totales.subtotal.bs) }}</span>
            </div>
            <div v-if="ivaPorcentaje > 0" class="row">
              <span>IVA {{ ivaPorcentaje }}%</span>
              <span class="num">{{ formatMontoBs(totales.iva.bs) }}</span>
            </div>
            <div class="row total">
              <span>Pago en bolívares{{ ivaPorcentaje > 0 ? ' (IVA incluido)' : '' }}</span>
              <span class="num">
                {{ formatMontoBs(totales.total.bs) }}
                <small class="total-usd">{{ totales.total.usd == null ? '—' : formatUsd(totales.total.usd) }}</small>
              </span>
            </div>
          </div>

          <div class="segmented" role="group" aria-label="Tipo de documento">
            <button type="button" :class="{ active: tipoDocumento === 'factura' }" @click="setTipoDocumento('factura')">
              Factura{{ ivaConfigurado > 0 ? ` (IVA ${ivaConfigurado}%)` : '' }}
            </button>
            <button type="button" :class="{ active: tipoDocumento === 'nota_entrega' }" @click="setTipoDocumento('nota_entrega')">
              Nota de entrega
            </button>
          </div>

          <div v-if="esNota" class="nota-opciones">
            <fieldset class="nota-grupo">
              <legend>Moneda del documento</legend>
              <div class="nota-radios">
                <label class="nota-radio" :class="{ activa: notaMoneda === 'usd' }">
                  <input type="radio" name="nota-moneda" value="usd" :checked="notaMoneda === 'usd'" @change="setNotaMoneda('usd')" />
                  <span>Dólares <small>($)</small></span>
                </label>
                <label class="nota-radio" :class="{ activa: notaMoneda === 'bs' }">
                  <input type="radio" name="nota-moneda" value="bs" :checked="notaMoneda === 'bs'" @change="setNotaMoneda('bs')" />
                  <span>Bolívares <small>(Bs)</small></span>
                </label>
              </div>
            </fieldset>
          </div>

          <p v-if="hayExcesoStock" class="warning-box">
            Hay productos con más unidades que el stock disponible. Ajusta las cantidades para continuar.
          </p>
          <p v-if="haySinPrecio" class="warning-box">Asigna un precio a cada producto antes de finalizar.</p>
          <p v-if="errorVenta" class="warning-box">{{ errorVenta }}</p>

          <button
            class="btn btn-primary finalizar-btn"
            :disabled="carrito.length === 0 || !clienteSeleccionadoId || hayExcesoStock || haySinPrecio"
            @click="finalizarVenta"
          >
            Finalizar venta
          </button>
        </div>
      </div>

      <div class="venta-precios-col">
        <template v-if="productoActivo">
          <div class="producto-seleccionado">
            <div>
              <div class="nombre">{{ productoActivo.nombre }}</div>
              <div class="meta">
                {{ [productoActivo.codigo, productoActivo.codigo_barras, productoActivo.marca].filter(Boolean).join(' · ') }}
                <template v-if="productoActivo.codigo || productoActivo.codigo_barras || productoActivo.marca"> · </template>
                <span class="stock" :class="{ agotado: productoActivo.stock <= 0 }">
                  {{ productoActivo.stock <= 0 ? 'Sin stock' : `${productoActivo.stock} disponibles` }}
                </span>
              </div>
            </div>
            <span class="muted">Selecciona su precio</span>
          </div>

          <div v-if="preciosDelProducto.length === 0" class="cart-empty">
            {{ productoActivo.precio_compra_usd == null ? 'Este producto aún no tiene costo de compra: registra una entrada.' : 'Este producto no tiene precios cargados.' }}
          </div>
          <div v-else class="price-grid">
            <PriceCard
              v-for="precio in preciosDelProducto"
              :key="precio.tipoPrecioId"
              :precio="precio"
              :iva-porcentaje="ivaConfigurado"
              :iva-incluido="Number(productoActivo.costo_con_iva) === 1"
              :selected="carrito.find((i) => i.productoId === productoActivoId)?.precioId === precio.id"
              @click="asignarPrecio(productoActivoId, precio.id)"
            />
          </div>
        </template>
        <div v-else class="estado-vacio">Selecciona un producto del ticket para asignar o cambiar su precio.</div>
      </div>
    </div>

    <BaseModal v-if="modalCliente.abierto" title="Nuevo cliente" @close="modalCliente.abierto = false">
      <div class="login-field">
        <label class="field-label">Nombre o razón social</label>
        <input v-model="modalCliente.nombre" class="input" placeholder="Ej. Abastos La Esquina" />
      </div>
      <div class="login-field">
        <label class="field-label">Documento</label>
        <div style="display: flex; gap: 8px">
          <SearchSelect v-model="modalCliente.tipoDoc" :options="['V', 'J']" style="max-width: 90px" placeholder="V" />
          <input
            v-model="modalCliente.doc"
            class="input"
            placeholder="Solo números"
            inputmode="numeric"
            @input="modalCliente.doc = modalCliente.doc.replace(/\D/g, '')"
          />
        </div>
      </div>
      <div class="login-field"><label class="field-label">Teléfono</label><input v-model="modalCliente.tel" class="input" placeholder="Solo números" inputmode="numeric" @input="modalCliente.tel = modalCliente.tel.replace(/\D/g, '')" /></div>
      <div class="login-field"><label class="field-label">Dirección</label><input v-model="modalCliente.direccion" class="input" placeholder="Ej. EL TIGRE" /></div>
      <p v-if="modalCliente.error" style="color: var(--danger); font-size: 10.5px; margin-top: -8px">
        {{ modalCliente.error }}
      </p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalCliente.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modalCliente.guardando" @click="guardarCliente">
          Guardar cliente
        </button>
      </template>
    </BaseModal>

    <BaseModal
      v-if="modalTicket.abierto"
      :title="modalTicket.tipoDocumento === 'nota_entrega' ? 'Vista previa de la nota de entrega' : 'Vista previa del ticket'"
      :cerrable="false"
    >
      <div class="ticket">
        <img :src="logoUrl" class="ticket-logo" alt="" />
        <template v-if="modalTicket.tipoDocumento === 'nota_entrega'">
          <div class="center" style="font-weight: 700">NOTA DE ENTREGA</div>
          <div v-if="modalTicket.numeroTicket" class="center">Nro. {{ modalTicket.numeroTicket }}</div>
        </template>
        <div v-else-if="modalTicket.numeroTicket" class="center">Ticket {{ modalTicket.numeroTicket }}</div>
        <hr />
        <div class="line"><span>Cliente</span><span>{{ modalTicket.clienteNombre }}</span></div>
        <hr />
        <!-- Misma estructura que el documento impreso: la factura va SOLO
             en bolívares (líneas sin IVA + Subtotal/IVA/TOTAL); la nota de
             entrega va en $ o en Bs (según se eligió), sin IVA ni método. -->
        <div v-for="item in modalTicket.items" :key="item.precioId" class="line">
          <span>
            {{ item.cantidad }} × {{ item.nombre }}
            <span class="muted" style="font-size: 10.5px; display: block">
              {{ item.tipoPrecioNombre }} - {{ montoPreview(item.unitarioUsd, item.unitarioBs) }} c/u
            </span>
          </span>
          <span>{{ montoPreview(item.subtotalUsd, item.subtotalBs) }}</span>
        </div>
        <hr />
        <template v-if="modalTicket.tipoDocumento === 'nota_entrega'">
          <div class="line" style="font-weight: 600"><span>TOTAL{{ modalTicket.notaMoneda === 'bs' ? ' Bs' : '' }}</span><span>{{ montoPreview(modalTicket.totalUsd, modalTicket.totalBs) }}</span></div>
          <div class="recibo-preview">
            <div>RECIBIDO: _________________________</div>
            <div>FECHA: _________________________</div>
            <div>FIRMA: _________________________</div>
          </div>
        </template>
        <template v-else>
          <template v-if="modalTicket.ivaPorcentaje > 0">
            <div class="line"><span>Subtotal Bs</span><span>{{ formatMontoBs(modalTicket.subtotalBs) }}</span></div>
            <div class="line"><span>IVA {{ modalTicket.ivaPorcentaje }}%</span><span>{{ formatMontoBs(modalTicket.ivaBs) }}</span></div>
          </template>
          <div class="line" style="font-weight: 600"><span>TOTAL Bs</span><span>{{ formatMontoBs(modalTicket.totalBs) }}</span></div>
        </template>
      </div>
      <div class="copias-fila">
        <span class="muted">Copias a imprimir:</span>
        <label class="copia-opcion" :class="{ activa: modalTicket.copias === 1 }">
          <input type="radio" :value="1" v-model.number="modalTicket.copias" /> 1
        </label>
        <label class="copia-opcion" :class="{ activa: modalTicket.copias === 2 }">
          <input type="radio" :value="2" v-model.number="modalTicket.copias" /> 2
        </label>
      </div>
      <p class="muted" style="font-size: 11px; margin-top: 6px">
        Se imprimirá en hoja carta{{ modalTicket.copias === 2 ? ': ORIGINAL para el cliente y COPIA para la tienda' : ' una copia' }}.
      </p>
      <template #footer>
        <button class="btn btn-outline" type="button" :disabled="modalTicket.imprimiendo" @click="corregir">
          Corregir
        </button>
        <button class="btn btn-primary" type="button" :disabled="modalTicket.imprimiendo" @click="imprimirYCerrar">
          {{ modalTicket.imprimiendo ? 'Imprimiendo…' : 'Imprimir' }}
        </button>
      </template>
    </BaseModal>

    <BaseModal v-if="modalStock.abierto" title="Stock insuficiente" @close="aceptarStock">
      <template #icon>
        <span class="modal-icono">
          <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </template>
      <p style="font-size: 12.5px; margin-bottom: 6px">
        <strong>{{ modalStock.nombre }}</strong>
        <span v-if="modalStock.detalle" class="muted"> — {{ modalStock.detalle }}</span>
      </p>
      <p class="warning-box">
        Solo tiene {{ modalStock.stock }} {{ modalStock.stock === 1 ? 'unidad disponible' : 'unidades disponibles' }}.
        {{ modalStock.stock > 0 ? 'Al continuar, la cantidad se ajustará al máximo disponible.' : 'Al continuar, el producto se quitará del carrito.' }}
      </p>
      <template #footer>
        <button class="btn btn-primary" type="button" @click="aceptarStock">Entendido</button>
      </template>
    </BaseModal>

    <BaseModal v-if="modalErrorImpresion.abierto" title="Error de impresión" @close="modalErrorImpresion.abierto = false">
      <p class="venta-registrada">La venta se registró con éxito</p>
      <p class="muted" style="margin-bottom: 10px; text-align: center">
        No se pudo imprimir la factura. Puedes reimprimirla desde Ventas del día cuando la impresora responda.
      </p>
      <p class="warning-box">{{ modalErrorImpresion.mensaje }}</p>
      <template #footer>
        <button class="btn btn-primary" type="button" @click="modalErrorImpresion.abierto = false">Cerrar</button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRefs, watch } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import PriceCard from '../components/PriceCard.vue'
import CartItem from '../components/CartItem.vue'
import ClienteCombobox from '../components/ClienteCombobox.vue'
import ProductoCombobox from '../components/ProductoCombobox.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { formatUsd, formatMontoBs } from '../composables/useFormato'
import { mensajeError } from '../composables/useErrores'
import { alCambiar } from '../composables/useEventos'
import { calcularLinea, calcularLineaNota, calcularTotales } from '../../../shared/venta.calculo.js'
import { session } from '../store/session'
import logoUrl from '../assets/logo.png'
import {
  ventaState,
  agregarProducto,
  asignarPrecio,
  setCantidad,
  confirmarCantidad,
  quitarDelCarrito,
  ajustarCantidadAlStock,
  limpiarTicket,
  setTipoDocumento,
  setNotaMoneda
} from '../store/venta'

const productos = ref([])
// Precios por producto bajo demanda: api.precios.listarPorProducto devuelve
// todos los tipos activos ya calculados con las tasas vigentes
// ({ id, tipoPrecioId, tipoPrecioNombre, margen, margenOrigen, precioUsd,
//    precioBs, precioUsdt }). Se cachea por productoId.
const preciosPorProducto = ref(new Map())
const clientes = ref([])
const cargando = ref(true)
const error = ref('')
const buscadorRef = ref(null)

// El ticket en curso (carrito, cliente, tipo de documento y producto
// seleccionado) vive en un store de módulo (ventaState) para que no se
// pierda al navegar a otra pantalla y volver a "Nueva venta".
const { clienteSeleccionadoId, productoActivoId, tipoDocumento, notaMoneda } = toRefs(ventaState)
const esNota = computed(() => tipoDocumento.value === 'nota_entrega')
const carrito = ventaState.carrito

async function asegurarPrecios(productoId, forzar = false) {
  if (!productoId || (!forzar && preciosPorProducto.value.has(productoId))) return
  const lista = await window.api.precios.listarPorProducto(productoId)
  preciosPorProducto.value = new Map(preciosPorProducto.value).set(productoId, lista)
}

// Al activar un producto (agregar al ticket o tocar su línea) se cargan sus
// precios calculados, si no estaban ya en caché.
watch(productoActivoId, (id) => {
  if (id) asegurarPrecios(id).catch((e) => (error.value = mensajeError(e)))
})

async function cargarCatalogo() {
  productos.value = await window.api.productos.listar()
  // Precios de todos los productos que están en el ticket (o activos),
  // para revalidar las líneas y mostrar subtotales.
  const ids = new Set(carrito.map((i) => i.productoId))
  if (productoActivoId.value) ids.add(productoActivoId.value)
  // Se recalculan siempre: los precios dependen de las tasas vigentes, que
  // pueden haber cambiado desde la TopBar mientras el ticket estaba armado.
  await Promise.all([...ids].map((id) => asegurarPrecios(id, true)))
}

async function cargarTodo() {
  cargando.value = true
  error.value = ''
  try {
    const [, listaClientes, iva] = await Promise.all([
      cargarCatalogo(),
      window.api.clientes.listar(),
      window.api.configuracion.obtenerIva()
    ])
    clientes.value = listaClientes
    ivaConfigurado.value = iva
    // El ticket sobrevive a la navegación, pero no debe conservar productos
    // eliminados ni precios que ya no pertenecen al producto.
    if (!productos.value.some((p) => p.id === productoActivoId.value)) productoActivoId.value = null
    for (const item of [...carrito]) {
      if (!productos.value.some((p) => p.id === item.productoId)) {
        quitarDelCarrito(item.productoId)
      } else if (
        item.precioId &&
        !(preciosPorProducto.value.get(item.productoId) ?? []).some((p) => p.id === item.precioId)
      ) {
        item.precioId = null
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const productoActivo = computed(() => productos.value.find((p) => p.id === productoActivoId.value) ?? null)

const preciosDelProducto = computed(() => preciosPorProducto.value.get(productoActivoId.value) ?? [])

// IVA general configurable. El % se lee de la configuración al cargar la
// pantalla; el backend usa el mismo valor al registrar la venta. En la
// pantalla TODO se muestra con IVA incluido, en ambos documentos: la
// factura cobra base + IVA (o desglosa el IVA que ya traía el costo) y la
// nota de entrega cobra el precio con IVA embebido sin desglosarlo.
// `ivaPorcentaje` (0 en nota) solo controla los rótulos del carrito.
const ivaConfigurado = ref(16)
const ivaPorcentaje = computed(() => (tipoDocumento.value === 'nota_entrega' ? 0 : ivaConfigurado.value))

// Cada línea lleva sus montos calculados con shared/venta.calculo.js — la
// misma función que usa el backend al guardar la venta (y que imprime la
// factura) —: unitario/subtotal sin IVA, IVA y total con IVA. Si el costo
// del producto traía IVA (costo_con_iva), el precio materializado ya es el
// precio con IVA: la factura lo desglosa y la nota lo embebe.
const carritoDetallado = computed(() =>
  carrito
    .map((item) => {
      const producto = productos.value.find((p) => p.id === item.productoId)
      if (!producto) return null
      const precio = (preciosPorProducto.value.get(item.productoId) ?? []).find((p) => p.id === item.precioId) ?? null
      const conIva = Number(producto.costo_con_iva) === 1
      const linea = precio
        ? esNota.value
          ? calcularLineaNota(precio, item.cantidad, ivaConfigurado.value, conIva)
          : calcularLinea(precio, item.cantidad, ivaConfigurado.value, conIva)
        : null
      return { ...item, producto, precio, linea, stock: producto.stock, excedeStock: item.cantidad > producto.stock }
    })
    .filter(Boolean)
)

const hayExcesoStock = computed(() => carritoDetallado.value.some((item) => item.excedeStock))
const haySinPrecio = computed(() => carritoDetallado.value.length !== carrito.length || carritoDetallado.value.some((item) => !item.precio))

// Totales = suma de líneas (subtotal sin IVA + IVA = total), idéntico al backend.
const totales = computed(() => calcularTotales(carritoDetallado.value.filter((i) => i.linea).map((i) => i.linea)))

const clienteActual = computed(() => clientes.value.find((c) => c.id === clienteSeleccionadoId.value) ?? null)

// El campo acepta la escritura transitoria; al confirmar se compara con el
// stock. Aplicar el límite al aceptar el modal garantiza que tanto el estado
// como el valor visible del input cambien juntos.
const modalStock = reactive({ abierto: false, productoId: null, nombre: '', detalle: '', stock: 0 })

function confirmarCantidadConTope(productoId, valor) {
  const producto = productos.value.find((p) => p.id === productoId)
  const stock = Number(producto?.stock)
  const cantidad = Number(valor)
  if (!Number.isInteger(cantidad) || cantidad < 1 || !Number.isFinite(stock) || cantidad <= stock) {
    confirmarCantidad(productoId, valor)
    return
  }
  modalStock.productoId = productoId
  modalStock.nombre = producto.nombre
  modalStock.detalle = [producto.codigo, producto.marca].filter(Boolean).join(' · ')
  modalStock.stock = Math.max(0, stock)
  modalStock.abierto = true
}

function aceptarStock() {
  if (modalStock.productoId != null) {
    const stockActual = productos.value.find((p) => p.id === modalStock.productoId)?.stock ?? 0
    ajustarCantidadAlStock(modalStock.productoId, Math.min(modalStock.stock, stockActual))
  }
  modalStock.abierto = false
  modalStock.productoId = null
}

const modalCliente = reactive({
  abierto: false,
  nombre: '',
  tipoDoc: 'V',
  doc: '',
  tel: '',
  direccion: 'EL TIGRE',
  error: '',
  guardando: false
})

function abrirModalCliente(textoSugerido) {
  const texto = (textoSugerido || '').trim()
  // Si lo que se buscó parece una cédula o RIF (ej. "V-12345678", "J30512345-6",
  // o solo dígitos) se precarga en Documento en vez de Nombre.
  const pareceDocumento = /^[VEJPGvejpg]?[-.\s]?\d[\d.\s-]*$/.test(texto)
  modalCliente.abierto = true
  modalCliente.nombre = pareceDocumento ? '' : texto
  modalCliente.tipoDoc = 'V'
  modalCliente.doc = pareceDocumento ? texto.replace(/\D/g, '') : ''
  modalCliente.tel = ''
  modalCliente.direccion = 'EL TIGRE'
  modalCliente.error = ''
}

async function guardarCliente() {
  const nombre = modalCliente.nombre.trim()
  if (!nombre) {
    modalCliente.error = 'Ingresa un nombre para el cliente.'
    return
  }
  modalCliente.guardando = true
  modalCliente.error = ''
  try {
    const nuevo = await window.api.clientes.crear({
      nombre,
      tipoDoc: modalCliente.tipoDoc,
      doc: modalCliente.doc.trim(),
      tel: modalCliente.tel.trim(),
      direccion: modalCliente.direccion.trim() || 'EL TIGRE'
    })
    clientes.value.push(nuevo)
    clientes.value.sort((a, b) => a.nombre.localeCompare(b.nombre))
    clienteSeleccionadoId.value = nuevo.id
    modalCliente.abierto = false
  } catch (e) {
    modalCliente.error = e.message || 'No se pudo guardar el cliente'
  } finally {
    modalCliente.guardando = false
  }
}

const modalTicket = reactive({
  abierto: false,
  numeroTicket: '',
  ventaId: null,
  imprimiendo: false,
  items: [],
  subtotalBs: 0,
  subtotalUsdt: 0,
  ivaPorcentaje: 0,
  ivaBs: 0,
  ivaUsdt: 0,
  totalBs: 0,
  totalUsd: 0,
  totalUsdt: 0,
  tipoDocumento: 'factura',
  notaMoneda: 'usd',
  clienteNombre: '',
  copias: 2
})
const errorVenta = ref('')

// Monto de la vista previa: la factura siempre en Bs; la nota en la moneda
// elegida ($ o Bs).
const montoPreview = (usd, bs) =>
  modalTicket.tipoDocumento === 'nota_entrega' && modalTicket.notaMoneda === 'usd' ? formatUsd(usd) : formatMontoBs(bs)

// Modal de error de impresión: se abre encima de la vista previa con el
// motivo del fallo, para que al cerrarlo se pueda reintentar o corregir.
const modalErrorImpresion = reactive({ abierto: false, mensaje: '' })

function mostrarErrorImpresion(mensaje) {
  modalErrorImpresion.mensaje = mensaje || 'Error desconocido'
  modalErrorImpresion.abierto = true
}

// "Finalizar venta" solo abre la vista previa: la venta NO se registra en BD
// todavía. El snapshot de items alimenta el modal; si el usuario elige
// "Corregir" el carrito sigue intacto y no queda nada guardado.
async function finalizarVenta() {
  errorVenta.value = ''
  if (carrito.length === 0 || haySinPrecio.value || hayExcesoStock.value) {
    errorVenta.value = 'Revisa que todos los productos tengan precio y stock disponible.'
    return
  }
  if (!clienteSeleccionadoId.value) {
    errorVenta.value = 'Selecciona un cliente para registrar la venta.'
    return
  }
  // Antes de mostrar la factura se refrescan precios (tasas vigentes) e IVA
  // desde la BD: la vista previa debe calcular con lo mismo que usará el
  // backend al registrar.
  try {
    const [, iva] = await Promise.all([cargarCatalogo(), window.api.configuracion.obtenerIva()])
    ivaConfigurado.value = iva
  } catch (e) {
    errorVenta.value = mensajeError(e)
    return
  }
  if (haySinPrecio.value || hayExcesoStock.value) {
    errorVenta.value = 'Los precios o el stock cambiaron: revisa el ticket antes de finalizar.'
    return
  }
  modalTicket.numeroTicket = ''
  modalTicket.ventaId = null
  modalTicket.imprimiendo = false
  modalTicket.tipoDocumento = tipoDocumento.value
  modalTicket.notaMoneda = notaMoneda.value
  modalTicket.items = carritoDetallado.value.map((item) => ({
    precioId: item.precioId,
    cantidad: item.cantidad,
    nombre: item.producto.nombre,
    tipoPrecioNombre: item.precio.tipoPrecioNombre,
    unitarioBs: item.linea.unitario.bs,
    unitarioUsd: item.linea.unitario.usd,
    unitarioUsdt: item.linea.unitario.usdt,
    subtotalBs: item.linea.subtotal.bs,
    subtotalUsd: item.linea.subtotal.usd,
    subtotalUsdt: item.linea.subtotal.usdt
  }))
  const t = totales.value
  modalTicket.subtotalBs = t.subtotal.bs
  modalTicket.subtotalUsdt = t.subtotal.usdt
  modalTicket.ivaPorcentaje = ivaPorcentaje.value
  modalTicket.ivaBs = t.iva.bs
  modalTicket.ivaUsdt = t.iva.usdt
  modalTicket.totalBs = t.total.bs
  modalTicket.totalUsd = t.total.usd
  modalTicket.totalUsdt = t.total.usdt
  modalTicket.clienteNombre = clienteActual.value?.nombre || ''
  modalTicket.abierto = true
}

// Cierra la vista previa. Si la venta ya quedó registrada (porque la
// impresión falló) se mantiene: el ticket se puede reimprimir desde
// Ventas del día cuando se corrija el fallo de la impresora.
function corregir() {
  modalTicket.abierto = false
}

async function imprimirYCerrar() {
  modalTicket.imprimiendo = true
  try {
    // La venta se registra recién acá: el backend congela precio unitario,
    // subtotales, método de pago y las tasas vigentes (BCV/Binance) junto
    // con el cliente y los nombres de producto/tipo de precio. El renderer
    // ya no envía la tasa: la lee la BD en el momento de registrar.
    if (!modalTicket.ventaId) {
      let venta
      try {
        venta = await window.api.ventas.crear({
          clienteId: clienteSeleccionadoId.value,
          usuarioId: session.usuario?.id,
          metodoPago: 'bs',
          tipoDocumento: modalTicket.tipoDocumento,
          notaMoneda: modalTicket.notaMoneda,
          notaConIva: true,
          items: carritoDetallado.value.map((item) => ({
            precioId: item.precioId,
            cantidad: item.cantidad
          })),
          // Lo que vio el usuario en la factura: el backend rechaza la venta
          // si sus montos no coinciden al céntimo (ej. cambió la tasa o el IVA).
          totalesEsperados: {
            ivaPorcentaje: modalTicket.ivaPorcentaje,
            subtotalBs: modalTicket.subtotalBs,
            ivaBs: modalTicket.ivaBs,
            totalBs: modalTicket.totalBs,
            totalUsdt: modalTicket.totalUsdt
          }
        })
      } catch (e) {
        // No se registró la venta (ej. stock insuficiente): el carrito queda
        // intacto para corregirlo y se recarga el stock actualizado.
        modalTicket.abierto = false
        errorVenta.value = mensajeError(e)
        cargarCatalogo()
        return
      }
      modalTicket.ventaId = venta.id
      modalTicket.numeroTicket = venta.numero_ticket
      cargarCatalogo()
      // La venta ya quedó registrada, así que el carrito se vacía aunque la
      // impresión falle: el ticket se reimprime desde Ventas del día.
      limpiarTicket()
    }

    // La vista previa se cierra al mandar a imprimir; si hay problemas se
    // muestra el modal de error con el motivo.
    modalTicket.abierto = false

    const resultado = await window.api.impresora.imprimirVenta(modalTicket.ventaId, modalTicket.copias)
    if (!resultado.ok) {
      mostrarErrorImpresion(resultado.error || 'No se pudo imprimir el documento')
    }
  } catch (e) {
    modalTicket.abierto = false
    mostrarErrorImpresion(mensajeError(e) || 'No se pudo imprimir el documento')
  } finally {
    modalTicket.imprimiendo = false
  }
}

onMounted(cargarTodo)
// Refresco en vivo: si otra PC vende/cambia catálogo/tasas, se recargan los
// productos y los precios del ticket sin tocar el estado de carga.
alCambiar(['ventas', 'catalogo', 'inventario', 'tasas'], () => cargarCatalogo().catch(() => {}))
alCambiar('clientes', async () => {
  try {
    clientes.value = await window.api.clientes.listar()
  } catch { /* offline: se reintenta con el próximo evento */ }
})
alCambiar('config', async () => {
  try {
    ivaConfigurado.value = await window.api.configuracion.obtenerIva()
  } catch { }
})

</script>

<style scoped>
.total-usd {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
  text-align: right;
}

.ticket-logo {
  display: block;
  width: 55%;
  height: auto;
  margin: 0 auto 8px;
  filter: grayscale(1);
}

.venta-registrada {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  color: var(--success);
  margin-bottom: 8px;
}

.copias-fila {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.copia-opcion {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.copia-opcion.activa {
  border-color: var(--primary);
  background: var(--primary-soft, #eef4ff);
  font-weight: 600;
}

.copia-opcion input {
  accent-color: var(--primary);
  margin: 0;
}

/* Opciones de la nota de entrega: panel anidado bajo el selector de
   documento, con radios (moneda) y checkbox (IVA). */
.nota-opciones {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--primary);
  border-radius: var(--radius);
  background: var(--surface-alt);
  display: grid;
  gap: 10px;
}

.nota-grupo {
  border: none;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.nota-grupo legend {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0;
  margin-bottom: 6px;
}

.nota-radios {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.nota-radio {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface, #fff);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

.nota-radio:hover {
  border-color: var(--primary);
}

.nota-radio.activa {
  border-color: var(--primary);
  background: var(--primary-soft, #eef4ff);
  font-weight: 600;
}

.nota-radio small {
  color: var(--text-secondary);
  font-weight: 400;
}

.nota-radio input {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
  margin: 0;
  flex-shrink: 0;
  cursor: pointer;
}


/* Vista previa de la nota de entrega: bloque de recepción como en la hoja. */
.recibo-preview {
  margin-top: 16px;
  font-size: 11px;
  line-height: 2.4;
  color: var(--text-secondary);
  letter-spacing: .5px;
}
</style>
