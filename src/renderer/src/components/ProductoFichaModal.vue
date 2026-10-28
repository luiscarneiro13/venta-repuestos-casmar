<template>
  <BaseModal xl :title="producto.nombre" @close="emit('close')">
    <div class="ficha-tags">
      <span v-if="!producto.activo" class="tag tag-anulada">Desactivado</span>
      <span v-if="stockBajo" class="tag tag-vencido">Stock en el mínimo o por debajo</span>
      <span v-else-if="producto.stock <= 0" class="tag tag-vencido">Sin stock</span>
      <span v-else class="tag tag-activa">{{ producto.stock }} {{ producto.unidad_medida || 'unidades' }} en stock</span>
    </div>

    <div class="ficha-grid">
      <div><span class="field-label">Referencia / Nro. de parte</span><strong>{{ producto.codigo || '—' }}</strong></div>
      <div><span class="field-label">Código de barra</span><strong>{{ producto.codigo_barras || '—' }}</strong></div>
      <div><span class="field-label">Marca</span><strong>{{ producto.marca || '—' }}</strong></div>
      <div><span class="field-label">Categoría</span><strong>{{ producto.categoria_nombre || '—' }}</strong></div>
      <div><span class="field-label">Descripción</span><strong>{{ producto.descripcion || '—' }}</strong></div>
      <div><span class="field-label">Unidad</span><strong>{{ producto.unidad_medida || 'unidad' }}</strong></div>
      <div><span class="field-label">Ubicación</span><strong>{{ producto.ubicacion || '—' }}</strong></div>
      <div>
        <span class="field-label">Stock vs mínimo</span>
        <strong class="num" :style="{ color: stockBajo ? 'var(--danger)' : '' }">
          {{ producto.stock }} / {{ producto.stock_minimo ?? 0 }}
        </strong>
      </div>
      <div>
        <span class="field-label">Último costo de compra</span>
        <strong class="num">{{ producto.precio_compra_usd == null ? '—' : formatUsd(producto.precio_compra_usd) }}</strong>
      </div>
    </div>

    <h3 class="titulo-tabla">Precios de venta por tipo <span class="muted" style="font-size: 11px; font-weight: 500; margin-left: 8px">(sin IVA)</span></h3>
    <p v-if="cargandoPrecios" class="muted">Calculando precios…</p>
    <p v-else-if="errorPrecios" class="warning-box">{{ errorPrecios }}</p>
    <div v-else class="tabla-scroll">
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th style="text-align: right">% utilidad</th>
            <th>Origen</th>
            <th style="text-align: right">Precio $</th>
            <th style="text-align: right">Precio Bs</th>
            <th style="text-align: right">Precio USDT</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in precios" :key="p.tipoPrecioId">
            <td>{{ p.tipoPrecioNombre }}</td>
            <td class="num" style="text-align: right">{{ p.margen }}%</td>
            <td><span class="tag" :class="p.margenOrigen === 'propio' ? 'tag-parcial' : 'tag-pendiente'">{{ p.margenOrigen === 'propio' ? 'Propio' : 'Por defecto' }}</span></td>
            <td class="num" style="text-align: right">{{ p.precioUsd == null ? '—' : formatUsd(p.precioUsd) }}</td>
            <td class="num" style="text-align: right">{{ formatMontoBs(p.precioBs) }}</td>
            <td class="num" style="text-align: right">{{ formatMontoUsdt(p.precioUsdt) }}</td>
          </tr>
          <tr v-if="precios.length === 0">
            <td colspan="6" class="muted">
              {{ producto.precio_compra_usd == null ? 'Sin costo de compra todavía: los precios nacen de la primera entrada.' : 'No hay tipos de precio activos.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="puedeVerMovimientos" class="ficha-movimientos">
      <span class="field-label">Movimientos de inventario</span>
      <button class="btn btn-outline" type="button" @click="emit('movimientos', producto)">
        Ver todos los movimientos →
      </button>
    </div>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('close')">Cerrar</button>
      <template v-if="!soloLectura">
        <button v-if="producto.activo" class="btn btn-danger-ghost" type="button" @click="emit('eliminar', producto)">Eliminar</button>
        <button v-else class="btn btn-outline" type="button" @click="emit('reactivar', producto)">Reactivar</button>
        <button v-if="producto.activo" class="btn btn-outline" type="button" @click="emit('editar', producto)">Editar producto</button>
        <button v-if="producto.activo" class="btn btn-primary" type="button" @click="emit('entrada', producto)">+ Registrar entrada</button>
      </template>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { formatUsd, formatMontoBs, formatMontoUsdt } from '../composables/useFormato'
import { mensajeError } from '../composables/useErrores'

const props = defineProps({
  producto: { type: Object, required: true },
  // Vendedor: ve la ficha sin acciones de edición/entrada/eliminación.
  soloLectura: { type: Boolean, default: false },
  // La pantalla de movimientos (entradas/ajustes) es solo de administradores.
  puedeVerMovimientos: { type: Boolean, default: true }
})
const emit = defineEmits(['close', 'editar', 'entrada', 'eliminar', 'reactivar', 'movimientos'])

const precios = ref([])
const cargandoPrecios = ref(true)
const errorPrecios = ref('')

// stock_bajo lo calcula el backend; se mantiene la regla local como
// respaldo (stock <= mínimo cuando el mínimo es > 0).
const stockBajo = computed(() =>
  Boolean(props.producto.stock_bajo) ||
  ((props.producto.stock_minimo ?? 0) > 0 && props.producto.stock <= props.producto.stock_minimo)
)

async function cargarPrecios() {
  cargandoPrecios.value = true
  errorPrecios.value = ''
  try {
    precios.value = await window.api.precios.listarPorProducto(props.producto.id)
  } catch (e) {
    errorPrecios.value = mensajeError(e)
  } finally {
    cargandoPrecios.value = false
  }
}

onMounted(cargarPrecios)
</script>

<style scoped>
.ficha-tags { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.ficha-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 8px;
}
.ficha-grid > div { min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius); }
.titulo-tabla { padding: 12px 16px; display: flex; align-items: center; min-height: 48px; margin: 0; }
.tabla-scroll { max-height: 220px; overflow-y: auto; }
.ficha-movimientos {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
@media (max-width: 700px) { .ficha-grid { grid-template-columns: 1fr; } }
</style>
