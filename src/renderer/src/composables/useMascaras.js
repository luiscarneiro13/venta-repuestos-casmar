// Máscaras de entrada compartidas entre el login y las pantallas del sistema.

// Máscara de monto en bolívares: se escriben solo dígitos y los dos últimos
// son siempre los decimales, sin separador de miles.
// "7601" → "76,01" | "98798723476" → "987987234,76"
export function aplicarMascaraTasa(entrada) {
  let raw = String(entrada ?? '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
  if (!raw) raw = '0'
  while (raw.length < 3) raw = '0' + raw

  const entero = raw.slice(0, -2)
  const decimales = raw.slice(-2)

  return { texto: `${entero},${decimales}`, valor: Number(`${entero}.${decimales}`) }
}

// Pasa un número ya guardado (ej. la tasa vigente) al texto de la máscara.
export function mascaraTasaDesdeNumero(valor) {
  return aplicarMascaraTasa(Math.round(Number(valor || 0) * 100).toString())
}

// Bloquea en el teclado todo lo que no sea un dígito, dejando pasar las
// teclas de edición y los atajos con Ctrl/Cmd.
export function bloquearNoDigitos(e) {
  const permitidas = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End']
  if (permitidas.includes(e.key) || e.ctrlKey || e.metaKey) return
  if (!/^\d$/.test(e.key)) {
    e.preventDefault()
  }
}

// Nombre de usuario: minúsculas, sin acentos, sin espacios ni caracteres
// especiales (solo letras y números).
export function normalizarUsuario(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}
