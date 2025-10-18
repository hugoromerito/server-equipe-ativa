import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth.ts'
import { roleEnum } from './enums.ts'
import { jobTitles } from './job-titles.ts'

export const organizations = pgTable('organizations', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().unique().notNull(),
  domain: text().unique(),
  should_attach_users_by_domain: boolean().default(false),
  avatar_url: text(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp(),
  owner_id: uuid().notNull(),
})

export const units = pgTable(
  'units',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
    domain: text().unique(),
    description: text(),
    location: text().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp(),
    owner_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
  },

  (table) => [
    uniqueIndex('unit_slug_org_id').on(table.slug, table.organization_id),
  ]
)

export const members = pgTable(
  'members',
  {
    id: uuid().primaryKey().defaultRandom(),
    organization_role: roleEnum().default('CLERK').notNull(),
    unit_role: roleEnum(),
    job_title_id: uuid().references(() => jobTitles.id, { onDelete: 'set null' }), // Cargo/função específica
    working_days: integer().array(), // Array de dias da semana: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    unit_id: uuid().references(() => units.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('user_id_organization_id_unit_id').on(
      table.user_id,
      table.organization_id,
      table.unit_id
    ),
  ]
)

export const invites = pgTable(
  'invites',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    role: roleEnum().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    author_id: uuid().references(() => users.id, { onDelete: 'cascade' }),
    organization_id: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    unit_id: uuid().references(() => units.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('email_organization_id_unit_id').on(
      table.email,
      table.organization_id,
      table.unit_id
    ),
    index('email').on(table.email),
  ]
)
