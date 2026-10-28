// Mismo orden de categorías que Docs/casmar-pos-demo.html (Planta hielo,
// Calle). tiposPrecio.repo.listar() devuelve orden alfabético,
// así que se reordena aquí solo para la presentación.
const ORDEN = ['Planta hielo', 'Calle']

export function ordenarCategorias(categorias) {
  return [...categorias].sort((a, b) => {
    const ia = ORDEN.indexOf(a.nombre)
    const ib = ORDEN.indexOf(b.nombre)
    if (ia === -1 && ib === -1) return a.nombre.localeCompare(b.nombre)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}
