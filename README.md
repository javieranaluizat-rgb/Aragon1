# Samara III · Pagos de alícuota

App web para que los residentes del conjunto registren el pago de su alícuota
subiendo el comprobante, y para que la administración lo verifique cruzándolo
con el estado de cuenta del banco.

## Qué hace

**Residentes** (sin usuario ni contraseña)

1. Escriben el número de su casa.
2. Toman una foto o suben el PDF del comprobante. La app les explica cómo hacerlo bien.
3. La app lee el comprobante y llena sola el monto, la fecha, el número de
   comprobante, el banco y quién pagó. El residente solo revisa y confirma.
4. El pago queda como **Pendiente**. En **Mis pagos** ven cuándo pasa a **Aprobado**.

Controles automáticos: no se puede registrar dos veces el mismo comprobante,
se avisa si la cuenta destino no es la del conjunto y si el monto es menor que la alícuota.

**Administración** (`/admin`, con contraseña)

- Sube el estado de cuenta del banco (Excel `.xlsx`, CSV o PDF).
- La app cruza cada depósito con los comprobantes por monto, fecha, número de
  comprobante y número de casa en la descripción ("Casa 12", "C-12").
  - Los cruces seguros se aprueban solos.
  - Los dudosos aparecen como **Posibles coincidencias** para confirmar con un clic.
  - Muestra comprobantes que no aparecen en el banco y depósitos que nadie reportó.
- Puede aprobar o rechazar a mano, con una nota que el residente ve.
- Administra las casas y sus alícuotas.

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
