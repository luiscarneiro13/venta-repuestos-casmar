import { registerUsuariosIpc } from './usuarios.ipc.js'
import { registerPreciosIpc } from './precios.ipc.js'
import { registerClientesIpc } from './clientes.ipc.js'
import { registerTasasIpc } from './tasas.ipc.js'
import { registerVentasIpc } from './ventas.ipc.js'
import { registerCajaIpc } from './caja.ipc.js'
import { registerImpresoraIpc } from './impresora.ipc.js'
import { registerInventarioIpc } from './inventario.ipc.js'
import { registerSistemaIpc } from './sistema.ipc.js'
import { registerProveedoresIpc } from './proveedores.ipc.js'
import { registerConfiguracionIpc } from './configuracion.ipc.js'
import { registerCategoriasIpc } from './categorias.ipc.js'
import { registerAuthIpc } from './auth.ipc.js'
import { registerAppConfigIpc } from './appConfig.ipc.js'

// Llena el mapa de canales (registro.js). En el servidor, instalarIpc() los
// conecta a la ventana y el servidor HTTP los ejecuta para los esclavos; en
// el cliente, prepararModoCliente() sustituye los remotos por el proxy antes
// de instalarIpc(). Registrar en ambos modos también le da al cliente la
// lista completa de canales sin duplicarla a mano.
export function registrarCanales() {
  registerUsuariosIpc()
  registerPreciosIpc()
  registerClientesIpc()
  registerTasasIpc()
  registerVentasIpc()
  registerCajaIpc()
  registerImpresoraIpc()
  registerInventarioIpc()
  registerSistemaIpc()
  registerProveedoresIpc()
  registerConfiguracionIpc()
  registerCategoriasIpc()
  registerAuthIpc()
  registerAppConfigIpc()
}
