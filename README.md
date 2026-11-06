# Samara III · Pagos de alícuota

App web para que los residentes del conjunto registren el pago de su alícuota
subiendo el comprobante, y para que la administración lo verifique cruzándolo
con el estado de cuenta del banco.

## Qué hace

**Residentes** (con su propio usuario)

1. Entran con el usuario y la contraseña temporal que les da la administración.
   La primera vez, la app les pide crear su propia contraseña.
2. La app ya sabe cuál es su casa (si tienen varias, eligen de una lista).
3. Toman una foto o suben el PDF del comprobante. La app les explica cómo hacerlo bien.
4. La app lee el comprobante y llena sola el monto, la fecha, el número de
   comprobante, el banco y quién pagó. El residente solo revisa y confirma.
5. El pago queda como **Pendiente**. En **Mis pagos** ven solo los pagos de sus casas.

Controles automáticos: no se puede registrar dos veces el mismo comprobante,
nadie puede subir pagos de una casa que no tenga asignada, y se avisa si la
cuenta destino no es la del conjunto o si el monto es menor que la alícuota.

**Administración** (`/admin`)

- **Usuarios:** crear usuarios (residentes o administradores), asignar y
  reasignar casas, restablecer contraseñas y desactivar cuentas.
- **Casas:** crear casas, cambiar la alícuota de una casa o de todas a la vez.
- **Cruce con el banco:** sube el estado de cuenta (Excel `.xlsx`, CSV o PDF) y
  la app cruza cada depósito con los comprobantes por monto, fecha, número de
  comprobante y número de casa en la descripción ("Casa 12", "C-12").
  - Los cruces seguros se aprueban solos.
  - Los dudosos aparecen como **Posibles coincidencias** para confirmar con un clic.
  - Muestra comprobantes que no aparecen en el banco y depósitos que nadie reportó.
- **Pagos:** aprobar o rechazar a mano, con una nota que el residente ve.

**Primer ingreso:** usuario `admin` con la contraseña de la variable
`ADMIN_PASSWORD`. Esa cuenta siempre funciona y sirve para recuperar el acceso.
Desde ahí puedes crear cuentas de administrador con nombre propio.

## Probar en tu computadora

Necesitas [Node.js 20 o superior](https://nodejs.org).

```bash
npm install
cp .env.example .env.local   # y edita los valores
npm run dev
```

Abre http://localhost:3000. Sin `DATABASE_URL`, la app guarda los datos en la
carpeta `.data/` y crea las casas 1 a 20 de ejemplo.

## Publicar con dominio propio

Recomendado: **Vercel** (la app) + **Supabase** (la base de datos). Ambos tienen plan gratuito.

1. **Base de datos:** crea un proyecto en [supabase.com](https://supabase.com).
   En *Connect* copia la cadena de conexión **Transaction pooler** (puerto 6543).
2. **App:** en [vercel.com](https://vercel.com), *Add New → Project* e importa
   el repositorio `Aragon1` de GitHub.
3. En *Environment Variables* agrega las de `.env.example`:
   `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `CONJUNTO_NOMBRE`,
   `CONJUNTO_BANCO`, `CONJUNTO_CUENTA`, `ANTHROPIC_API_KEY` y
   `SEMBRAR_CASAS_DEMO=false` si vas a cargar las casas reales.
4. *Deploy*. Las tablas se crean solas la primera vez.
5. **Dominio:** en Vercel, *Settings → Domains*, agrega tu dominio (por ejemplo
   `samara3.com`) y copia en tu proveedor de dominio los registros DNS que te indique.

Cada cambio que se suba a GitHub se publica solo.

**Otros hostings:** la app funciona en cualquier servidor con Node.js 20+
(`npm run build` y `npm start`) apuntando `DATABASE_URL` a un PostgreSQL.
Un hosting compartido solo con PHP/cPanel no sirve.

## Lectura automática

La lectura de comprobantes y de estados de cuenta en PDF usa la API de Claude
(`ANTHROPIC_API_KEY`, se obtiene en https://console.anthropic.com). Cuesta
centavos por comprobante. Sin la clave, todo funciona igual, pero el residente
escribe los datos a mano y el estado de cuenta debe subirse en Excel o CSV.

Los comprobantes contienen datos personales: incluye en la política de
privacidad del conjunto (LOPDP) que se procesan con un servicio externo.
