// Electron envuelve los errores lanzados en ipcMain.handle con el prefijo
// "Error invoking remote method 'canal': Error: ...". Se quita para mostrar
// al usuario solo el mensaje de negocio.
export function mensajeError(error) {
  const texto = error?.message || String(error || '')
  return texto.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
