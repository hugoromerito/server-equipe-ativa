import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations, units } from './organization.ts'

/**
 * Tabela de cargos/funções específicas dentro de unidades
 * Exemplos: Recepcionista, Gestor de Dados, Zelador, Coordenador, etc.
 */
export const jobTitles = pgTable(
  'job_titles',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(), // Nome do cargo (ex: "Recepcionista")
    description: text(), // Descrição opcional do cargo
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp(),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Opcional: se quiser cargos específicos por unidade
    unit_id: uuid().references(() => units.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // Garante que não haja cargos duplicados na mesma organização/unidade
    uniqueIndex('job_title_name_org_unit').on(
      table.name,
      table.organization_id,
      table.unit_id
    ),
  ]
)
