-- Niveles de acceso. `usuarios.rol` guarda la clave del rol.
--   sistema       Admin de Sistema: acceso total. Cuenta raíz: nadie la puede
--                 editar ni eliminar, y no se pueden crear más con este rol.
--   administrador Acceso total; gestiona administradores y vendedores.
--   vendedor      Vende y consulta; no crea ni edita productos ni registra
--                 entradas (ver src/shared/permisos.js).
CREATE TABLE roles (
  clave TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nivel INTEGER NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  asignable INTEGER NOT NULL DEFAULT 1
);

INSERT INTO roles (clave, nombre, nivel, descripcion, asignable) VALUES
  ('sistema', 'Admin de Sistema', 3, 'Acceso total. Cuenta raíz protegida: nadie la puede editar ni eliminar.', 0),
  ('administrador', 'Administrador', 2, 'Acceso total. Gestiona administradores y vendedores.', 1),
  ('vendedor', 'Vendedor', 1, 'Vende y consulta. No crea ni edita productos ni registra entradas.', 1);

-- La cuenta raíz existente pasa a Admin de Sistema; cualquier rol desconocido
-- queda como vendedor (el de menos privilegios).
UPDATE usuarios SET rol = 'sistema' WHERE usuario = 'admin';
UPDATE usuarios SET rol = 'vendedor' WHERE rol NOT IN (SELECT clave FROM roles);
