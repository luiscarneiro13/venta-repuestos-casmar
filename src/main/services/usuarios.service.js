import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import * as usuariosRepo from '../repositories/usuarios.repo.js'
import { ROLES_ASIGNABLES, nombreRol } from '../../shared/permisos.js'

// El Admin de Sistema (rol 'sistema') es la cuenta raíz: nadie la puede
// editar ni eliminar, y no se pueden crear otras con ese rol. Desde la
// pantalla de usuarios solo se asignan 'administrador' y 'vendedor'.
const esSistema = (usuario) => usuario?.rol === 'sistema'

function validarRol(rol) {
  if (!ROLES_ASIGNABLES.includes(rol)) {
    throw new Error(`El rol debe ser ${ROLES_ASIGNABLES.map((r) => `"${nombreRol(r)}"`).join(' o ')}`)
  }
}

// El nombre de usuario se guarda siempre en minúsculas y sin caracteres
// especiales; se valida también acá porque el renderer no es la única puerta
// de entrada a los servicios.
function validarNombreUsuario(usuario) {
  if (!/^[a-z0-9]+$/.test(usuario)) {
    throw new Error('El usuario solo puede tener letras y números en minúsculas, sin espacios')
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verificarPassword(password, passwordHash) {
  if (!password || !passwordHash || !passwordHash.includes(':')) return false
  const [salt, hash] = passwordHash.split(':')
  const hashCalculado = scryptSync(password, salt, 64)
  const hashEsperado = Buffer.from(hash, 'hex')
  return hashCalculado.length === hashEsperado.length && timingSafeEqual(hashCalculado, hashEsperado)
}

// Verifica que la contraseña coincida con la del Admin de Sistema (la cuenta
// raíz). Usado para operaciones sensibles como borrar las ventas.
export function verificarPasswordAdmin(password) {
  const admin = usuariosRepo.buscarSistema()
  if (!admin || !admin.password_hash) return false
  return verificarPassword(password, admin.password_hash)
}

export function listarUsuarios() {
  return usuariosRepo.listar()
}

export function crearUsuario({ nombre, usuario, password, rol = 'vendedor' }) {
  if (!nombre || !usuario || !password) {
    throw new Error('nombre, usuario y password son obligatorios')
  }

  validarRol(rol)
  validarNombreUsuario(usuario)

  if (usuariosRepo.buscarPorUsuario(usuario)) {
    throw new Error(`el usuario "${usuario}" ya existe`)
  }

  return usuariosRepo.crear({ nombre, usuario, passwordHash: hashPassword(password), rol })
}

function traducirErrorSqlite(error) {
  if (/UNIQUE constraint failed: usuarios\.usuario/.test(error.message)) {
    return new Error('Ya existe un usuario con ese nombre de usuario')
  }
  return error
}

export function actualizarUsuario(id, { nombre, usuario, rol, password }) {
  const existente = usuariosRepo.buscarPorId(id)
  if (!existente) {
    throw new Error('El usuario no existe')
  }
  if (esSistema(existente)) {
    throw new Error('El Admin de Sistema no se puede editar')
  }
  if (!nombre || !usuario) {
    throw new Error('nombre y usuario son obligatorios')
  }
  validarRol(rol)

  validarNombreUsuario(usuario)

  const otro = usuariosRepo.buscarPorUsuario(usuario)
  if (otro && otro.id !== id) {
    throw new Error(`el usuario "${usuario}" ya existe`)
  }

  try {
    return usuariosRepo.actualizar(id, {
      nombre,
      usuario,
      rol,
      passwordHash: password ? hashPassword(password) : null
    })
  } catch (error) {
    throw traducirErrorSqlite(error)
  }
}

// `actorId` = quien elimina (sesión): nadie se elimina a sí mismo.
export function eliminarUsuario(id, actorId = null) {
  const existente = usuariosRepo.buscarPorId(id)
  if (!existente) {
    throw new Error('El usuario no existe')
  }
  if (esSistema(existente)) {
    throw new Error('El Admin de Sistema no se puede eliminar')
  }
  if (actorId != null && actorId === id) {
    throw new Error('No puedes eliminar tu propio usuario')
  }
  usuariosRepo.eliminar(id)
}

export function listarRoles() {
  return usuariosRepo.listarRoles()
}
