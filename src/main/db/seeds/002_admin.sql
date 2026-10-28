-- Usuario administrador por defecto del sistema. Se ejecuta en cada arranque
-- (igual que 001_catalogo.sql); usa INSERT OR IGNORE sobre "usuario" (UNIQUE)
-- para ser idempotente y segura de re-ejecutar.
--
-- Credenciales por defecto: usuario "admin", contraseña "admin123"
-- (cámbiala después de la primera instalación). Hash generado con el mismo
-- esquema scrypt de src/main/services/usuarios.service.js (salt:hash).
--
-- Es el "Admin de Sistema" (rol 'sistema', ver migración 024_roles.sql): la
-- cuenta raíz que nadie puede editar ni eliminar.

INSERT OR IGNORE INTO usuarios (nombre, usuario, password_hash, rol) VALUES
  ('Admin de Sistema', 'admin', 'f097d11642f3e2ec56c697400eef7abd:02f175eda77817e52592743de732dcad761294e4a44364a2d333093a51ba7ae6c346a7a015e494f716ba96f436ef57060748dec4aaba44be515ef78c2f49db0e', 'sistema');
