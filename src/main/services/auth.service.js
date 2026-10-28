import { randomUUID } from 'node:crypto'
import * as usuariosRepo from '../repositories/usuarios.repo.js'
import { verificarPassword } from './usuarios.service.js'
import { puede } from '../../shared/permisos.js'
import { contextoRemoto } from '../ipc/contexto.js'
import { esCliente } from '../config.js'

// Sesiones del sistema:
//   usuarioActual  la sesión de la ventana de ESTA app en modo servidor.
//   sesiones       token → usuario de las PCs esclavas conectadas por HTTP.
//                  Sin vencimiento: es una red local (los tokens mueren al
//                  cerrar sesión o al reiniciar el servidor).
//   sesionCliente  en modo esclavo: el usuario/token de ESTA PC, que el main
//                  cliente adjunta a cada llamada remota.
let usuarioActual = null
let tokenActual = null
const sesiones = new Map()
let sesionCliente = null

const publico = (u) => ({ id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol })

function verificar({ usuario, password } = {}) {
  const fila = usuariosRepo.buscarPorUsuario(String(usuario || '').trim().toLowerCase())
  // Mismo mensaje si no existe o si la clave falla: no revela qué usuarios hay.
  if (!fila || !verificarPassword(String(password || ''), fila.password_hash)) {
    throw new Error('Usuario o contraseña incorrectos')
  }
  return publico(fila)
}

// Login de la ventana local (PC servidor).
export function login(credenciales) {
  const u = verificar(credenciales)
  usuarioActual = u
  return u
}

// Login de una PC esclava vía HTTP: devuelve usuario + token sin tocar la
// sesión local del servidor.
export function loginConToken(credenciales) {
  const u = verificar(credenciales)
  const token = randomUUID()
  sesiones.set(token, u)
  return { usuario: u, token }
}

export function usuarioDeToken(token) {
  return sesiones.get(token) ?? null
}

export function logout() {
  usuarioActual = null
  return { ok: true }
}

// Cierra solo la sesión remota del token; la sesión local del servidor no
// se toca.
export function logoutToken(token) {
  sesiones.delete(token)
  return { ok: true }
}

// Modo esclavo: el main cliente guarda aquí su usuario y token tras el login.
export function setSesionCliente(sesion) {
  sesionCliente = sesion
}
export function getSesionCliente() {
  return sesionCliente
}

// Quién actúa: remoto (cliente HTTP), la ventana local del servidor, o la
// sesión de esta PC esclava. Usado por las guardas y por IPC que necesitan
// saber quién es el actor (p. ej. no eliminarse a sí mismo).
export function actorActual() {
  return contextoRemoto.getStore()?.usuario ?? usuarioActual ?? sesionCliente?.usuario ?? null
}

export function sesionActual() {
  return actorActual()
}

// Lanza si no hay sesión o si el rol no tiene el permiso.
export function exigirPermiso(permiso) {
  const actor = actorActual()
  if (!actor) throw new Error('Debes iniciar sesión')

  // En la PC esclava no hay BD local: se valida con el rol de la sesión.
  if (esCliente()) {
    if (!puede(actor.rol, permiso)) throw new Error('No tienes permiso para realizar esta acción')
    return actor
  }

  // El rol se relee de la BD: si un administrador lo cambió, aplica ya.
  const fila = usuariosRepo.buscarPorId(actor.id)
  if (!fila) {
    if (!contextoRemoto.getStore()?.usuario) usuarioActual = null
    throw new Error('Tu usuario ya no existe: inicia sesión de nuevo')
  }
  const u = publico(fila)
  const remoto = contextoRemoto.getStore()
  if (remoto) remoto.usuario = u
  else usuarioActual = u
  if (!puede(fila.rol, permiso)) throw new Error('No tienes permiso para realizar esta acción')
  return u
}
