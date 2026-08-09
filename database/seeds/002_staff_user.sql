-- Usuário da camisaria para desenvolvimento. A senha é `123456`.
--
-- Este arquivo só roda por `npm run db:seed`, que recusa NODE_ENV=production. No servidor
-- publicado, o acesso nasce de `npm run user:admin`. Se este registro aparecer em produção,
-- a API avisa no boot: apague-o.

INSERT INTO users (name, email, password_hash, role) VALUES
  (
    'Equipe Mendes',
    'admin@teste.com',
    'scrypt$16384$3972c37da8a6473fe812d296ebf5db93$83529a5350bbe36540e4052c2f2efd305d58d4d93c343c0f58d467fc96b20ce0ee0bc91d040304e7b58db14b14ce1f7c8b923cd4f5c01b6af33d9a2bb8ac9a8e',
    'camisaria'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  active = TRUE;
