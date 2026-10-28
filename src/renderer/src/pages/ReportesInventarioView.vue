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
        <h1>Reportes de inventario</h1>
        <p>
          {{ descripcionReporte }}
          <span class="muted">
            Montos en USD · equivalente en Bs a tasa BCV {{ tasaBcv ? formatMontoBs(tasaBcv) : '(sin tasa registrada)' }}.
          </span>
        </p>
      </div>
      <button class="btn btn-outline" type="button" :disabled="reporte.detalle.length === 0" @click="exportarExcel">
        Exportar a Excel
      </button>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="card filtros">
      <div class="filtro">
        <label class="field-label" for="rep-tipo">Reporte</label>
        <SearchSelect v-model="tipo" input-id="rep-tipo" :options="OPCIONES_TIPO" placeholder="Reporte…" />
      </div>
      <div class="filtro">
        <label class="field-label" for="rep-agrupar">Agrupar por</label>
        <SearchSelect v-model="agrupar" input-id="rep-agrupar" :options="OPCIONES_AGRUPAR" placeholder="Sin agrupar" />
      </div>
      <div v-if="agrupar" class="filtro">
        <label class="field-label" for="rep-filtro">{{ agrupar === 'categoria' ? 'Categoría' : 'Proveedor' }}</label>
        <SearchSelect
          v-model="filtroId"
          input-id="rep-filtro"
          :options="opcionesFiltro"
          :placeholder="agrupar === 'categoria' ? 'Todas las categorías' : 'Todos los proveedores'"
        />
      </div>
    </div>

    <p v-if="cargando" class="muted">Cargando…</p>
    <template v-else>
      <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr)">
        <template v-if="tipo === 'minimos'">
          <KpiCard lbl="Productos en mínimo" :val="String(reporte.totales.productos)" sub="Stock en el mínimo o por debajo" />
          <KpiCard lbl="Unidades faltantes" :val="String(reporte.totales.faltante)" sub="Para llegar al mínimo" />
          <KpiCard
            lbl="Costo de reposición"
            :val="formatUsd(reporte.totales.reposicion_usd)"
            :sub-bold="formatMontoBs(reporte.totales.reposicion_bs)"
            sub="· al último costo"
          />
          <KpiCard lbl="Sin stock" :val="String(sinStock)" sub="Productos agotados" />
        </template>
        <template v-else>
          <KpiCard lbl="Productos" :val="String(reporte.totales.productos)" sub="Activos en el reporte" />
          <KpiCard lbl="Unidades en stock" :val="String(reporte.totales.unidades)" sub="Existencia total" />
          <KpiCard
            lbl="Valor del inventario"
            :val="formatUsd(reporte.totales.valor_usd)"
            :sub-bold="formatMontoBs(reporte.totales.valor_bs)"
            sub="· al último costo"
          />
          <KpiCard lbl="En mínimo" :val="String(reporte.totales.en_minimo)" sub="Requieren reposición" />
        </template>
      </div>

      <p v-if="reporte.totales.sin_costo > 0" class="muted aviso">
        {{ reporte.totales.sin_costo }} {{ reporte.totales.sin_costo === 1 ? 'producto no tiene' : 'productos no tienen' }}
        costo de compra registrado: no suman en los montos.
      </p>

      <div v-if="agrupar" class="card">
        <h3 class="titulo-tabla">Resumen por {{ agrupar === 'categoria' ? 'categoría' : 'proveedor' }}</h3>
        <table>
          <thead>
            <tr>
              <th>{{ agrupar === 'categoria' ? 'Categoría' : 'Proveedor' }}</th>
              <th style="text-align: right">Productos</th>
              <th style="text-align: right">{{ tipo === 'minimos' ? 'Faltante' : 'Unidades' }}</th>
              <th v-if="tipo === 'total'" style="text-align: right">En mínimo</th>
              <th style="text-align: right">{{ tipo === 'minimos' ? 'Costo reposición' : 'Valor al costo' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="g in reporte.grupos"
              :key="g.id"
              class="fila-grupo"
              :class="{ activa: filtroId === g.id }"
              tabindex="0"
              :title="filtroId === g.id ? 'Quitar filtro' : `Ver solo ${g.nombre}`"
              @click="alternarFiltro(g.id)"
              @keydown.enter="alternarFiltro(g.id)"
            >
              <td>{{ g.nombre }}</td>
              <td class="num" style="text-align: right">{{ g.totales.productos }}</td>
              <td class="num" style="text-align: right">{{ tipo === 'minimos' ? g.totales.faltante : g.totales.unidades }}</td>
              <td v-if="tipo === 'total'" class="num" style="text-align: right">{{ g.totales.en_minimo }}</td>
              <td class="num" style="text-align: right">
                <span class="monto">
                  <strong>{{ formatUsd(tipo === 'minimos' ? g.totales.reposicion_usd : g.totales.valor_usd) }}</strong>
                  <small>{{ formatMontoBs(tipo === 'minimos' ? g.totales.reposicion_bs : g.totales.valor_bs) }}</small>
                </span>
              </td>
            </tr>
            <tr v-if="reporte.grupos.length === 0">
              <td :colspan="tipo === 'total' ? 5 : 4" class="muted">Sin datos para este filtro.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3 class="titulo-tabla">Detalle de productos</h3>
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Producto</th>
                <th>Marca</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th style="text-align: right">Stock</th>
                <th style="text-align: right">Mínimo</th>
                <th style="text-align: right">Faltante</th>
                <th style="text-align: right">Costo</th>
                <th style="text-align: right">{{ tipo === 'minimos' ? 'Costo reposición' : 'Valor al costo' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in reporte.detalle" :key="p.id" :class="{ 'fila-stock-bajo': p.en_minimo }">
                <td class="num">{{ p.codigo || '—' }}</td>
                <td>{{ p.nombre }}</td>
                <td>{{ p.marca || '—' }}</td>
                <td>{{ p.categoria_nombre || '—' }}</td>
                <td>{{ p.proveedor_nombre || '—' }}</td>
                <td class="num" style="text-align: right">{{ p.stock }}</td>
                <td class="num" style="text-align: right">{{ p.stock_minimo ?? 0 }}</td>
                <td class="num" style="text-align: right">{{ p.faltante || '—' }}</td>
                <td class="num" style="text-align: right">
                  <span v-if="p.precio_compra_usd != null" class="monto">
                    <strong>{{ formatUsd(p.precio_compra_usd) }}</strong>
                    <small>{{ formatMontoBs(p.costo_bs) }}</small>
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="num" style="text-align: right">
                  <span v-if="(tipo === 'minimos' ? p.reposicion_usd : p.valor_usd) != null" class="monto">
                    <strong>{{ formatUsd(tipo === 'minimos' ? p.reposicion_usd : p.valor_usd) }}</strong>
                    <small>{{ formatMontoBs(tipo === 'minimos' ? p.reposicion_bs : p.valor_bs) }}</small>
                  </span>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
              <tr v-if="reporte.detalle.length === 0">
                <td colspan="10" class="muted">
                  {{ tipo === 'minimos' ? 'Ningún producto está en su mínimo con este filtro.' : 'No hay productos para este filtro.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import KpiCard from '../components/KpiCard.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { formatUsd, formatMontoBs } from '../composables/useFormato'
import { exportarXlsx } from '../composables/useExportarXlsx'
import { mensajeError } from '../composables/useErrores'
import { construirReporte, SIN_GRUPO } from '../../../shared/reporte.inventario.js'

const OPCIONES_TIPO = [
  { value: 'total', label: 'Inventario total' },
  { value: 'minimos', label: 'Productos en mínimo' }
]
const OPCIONES_AGRUPAR = [
  { value: 'categoria', label: 'Categoría' },
  { value: 'proveedor', label: 'Proveedor' }
]

const productos = ref([])
const tasaBcv = ref(null)
const cargando = ref(true)
const error = ref('')

const tipo = ref('total')
const agrupar = ref(null)
const filtroId = ref(null)

// El reporte siempre tiene un tipo: si se borra el texto del dropdown vuelve
// al inventario total. Cambiar el agrupado limpia el filtro concreto.
watch(tipo, (v) => {
  if (!v) tipo.value = 'total'
})
watch(agrupar, () => {
  filtroId.value = null
})

const descripcionReporte = computed(() => {
  const base = tipo.value === 'minimos' ? 'Productos en su stock mínimo o por debajo' : 'Inventario total valorizado al último costo'
  if (!agrupar.value) return `${base}.`
  return `${base}, agrupado por ${agrupar.value === 'categoria' ? 'categoría' : 'proveedor'}.`
})

// Opciones del filtro concreto: todas las categorías/proveedores presentes
// en el inventario (no solo los del reporte actual), más "Sin …".
const opcionesFiltro = computed(() => {
  const esCategoria = agrupar.value === 'categoria'
  const mapa = new Map()
  for (const p of productos.value) {
    const id = esCategoria ? p.categoria_id : p.proveedor_id
    if (id != null) mapa.set(id, esCategoria ? p.categoria_nombre : p.proveedor_nombre)
  }
  const opciones = [...mapa].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  return [...opciones, { value: SIN_GRUPO, label: esCategoria ? 'Sin categoría' : 'Sin proveedor' }]
})

const reporte = computed(() =>
  construirReporte(productos.value, {
    tipo: tipo.value,
    agrupar: agrupar.value,
    filtroId: filtroId.value,
    tasaBcv: tasaBcv.value
  })
)

const sinStock = computed(() => reporte.value.detalle.filter((p) => p.stock <= 0).length)

function alternarFiltro(id) {
  filtroId.value = filtroId.value === id ? null : id
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const datos = await window.api.inventario.reporte()
    productos.value = datos.productos
    tasaBcv.value = datos.tasaBcv
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
}

function exportarExcel() {
  const esMinimos = tipo.value === 'minimos'
  const montoUsd = esMinimos ? 'reposicion_usd' : 'valor_usd'
  const montoBs = esMinimos ? 'reposicion_bs' : 'valor_bs'
  const etiquetaMonto = esMinimos ? 'Costo reposición' : 'Valor al costo'
  const pestanas = []

  if (agrupar.value) {
    pestanas.push({
      nombre: 'Resumen',
      encabezados: [
        agrupar.value === 'categoria' ? 'Categoría' : 'Proveedor',
        'Productos', 'Unidades', 'En mínimo', 'Faltante', `${etiquetaMonto} (USD)`, `${etiquetaMonto} (Bs)`
      ],
      filas: reporte.value.grupos.map((g) => [
        g.nombre, g.totales.productos, g.totales.unidades, g.totales.en_minimo, g.totales.faltante,
        g.totales[montoUsd], g.totales[montoBs]
      ])
    })
  }

  const t = reporte.value.totales
  pestanas.push({
    nombre: 'Detalle',
    encabezados: [
      'Referencia', 'Producto', 'Marca', 'Categoría', 'Proveedor', 'Ubicación', 'Stock', 'Mínimo', 'Faltante',
      'Costo (USD)', 'Costo (Bs)', `${etiquetaMonto} (USD)`, `${etiquetaMonto} (Bs)`
    ],
    filas: [
      ...reporte.value.detalle.map((p) => [
        p.codigo || '', p.nombre, p.marca || '', p.categoria_nombre || '', p.proveedor_nombre || '', p.ubicacion || '',
        p.stock, p.stock_minimo ?? 0, p.faltante, p.precio_compra_usd, p.costo_bs, p[montoUsd], p[montoBs]
      ]),
      [],
      ['', 'TOTAL', '', '', '', '', t.unidades, '', t.faltante, '', '', t[montoUsd], t[montoBs]]
    ]
  })

  const fecha = new Date().toISOString().slice(0, 10)
  const sufijo = [esMinimos ? 'minimos' : 'total', agrupar.value].filter(Boolean).join('-')
  exportarXlsx(`reporte-inventario-${sufijo}-${fecha}.xlsx`, pestanas)
}

onMounted(cargar)
</script>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.filtro {
  width: 240px;
}
.aviso {
  font-size: 11.5px;
  margin: -6px 0 12px;
}
.card + .card {
  margin-top: 16px;
}
.tabla-scroll {
  max-height: calc(100vh - 360px);
  overflow-y: auto;
}
.monto {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
}
.monto small {
  color: var(--text-muted);
  font-size: 11px;
}
.fila-grupo {
  cursor: pointer;
}
.fila-grupo:hover td,
.fila-grupo.activa td {
  background: var(--surface-alt);
}
.fila-grupo.activa td:first-child {
  font-weight: 700;
}
.fila-grupo:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
