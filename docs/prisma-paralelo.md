# Prisma 7 y Prisma 8 en paralelo

Prisma 7 atiende las rutas actuales y administra las migraciones en
`prisma/migrations`. Prisma 8 está instalado como versión candidata y dispone de
un cliente independiente para incorporar nuevas consultas gradualmente.

Las dos versiones usan `DATABASE_URL` y el esquema `prisma/schema.prisma`.

| Recurso               | Prisma 7               | Prisma 8                |
| --------------------- | ---------------------- | ----------------------- |
| CLI                   | `pnpm exec prisma7`    | `pnpm exec prisma`      |
| Configuración         | `prisma7.config.ts`    | `prisma.config.ts`      |
| Cliente generado      | `src/generated/prisma` | `src/generated/prisma8` |
| Cliente de aplicación | `@/lib/prisma`         | `@/lib/prisma8`         |

## Generación y migraciones

`pnpm db:generate` genera los dos clientes. También se ejecuta al instalar
dependencias y antes de compilar. Para generarlos por separado:

```bash
pnpm db:7:generate
pnpm db:8:generate
```

`pnpm db:migrate` aplica cambios de desarrollo con Prisma 7. Después de modificar
el esquema o aplicar una migración, ejecuta `pnpm db:generate` para actualizar los
dos clientes. En despliegue se usa `prisma7 migrate deploy`; Vercel ya está
configurado con ese comando.

El contrato de Prisma 8 se deriva del esquema de Prisma 7; no hay que duplicar
modelos ni mantener un segundo esquema. Los archivos generados se excluyen de Git.

## Uso desde componentes de servidor y acciones

```ts
import { prisma } from '@/lib/prisma'
import { prisma8 } from '@/lib/prisma8'

const users7 = await prisma.user.findMany({ select: { id: true } })
const users8 = await prisma8.orm.public.User.select('id').all()
```

Prisma 8 tiene una API de consultas diferente. Los campos `DateTime` del esquema
compartido se representan como cadenas en su cliente, mientras Prisma 7 devuelve
objetos `Date`. Revisa esas diferencias al trasladar una consulta.

La instalación no transfiere la gestión de migraciones ni firma la base de datos
con Prisma 8. La firma y el cambio de propietario de las migraciones son pasos
posteriores de la [guía oficial de convivencia](https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql).
