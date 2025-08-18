import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth.ts'
import { applicants, demands } from './demands.ts'
import { attachmentTypeEnum } from './enums.ts'
import { organizations } from './organization.ts'

export const attachments = pgTable('attachments', {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique(),
  url: text().notNull(),
  original_name: text('original_name').notNull(),
  size: integer().notNull(),
  mime_type: text('mime_type').notNull(),
  type: attachmentTypeEnum().default('DOCUMENT').notNull(),
  encrypted: boolean().default(false).notNull(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  applicant_id: uuid('applicant_id').references(() => applicants.id, {
    onDelete: 'cascade',
  }),
  demand_id: uuid('demand_id').references(() => demands.id, {
    onDelete: 'cascade',
  }),
  uploaded_by: uuid('uploaded_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at'),
})

export type Attachment = typeof attachments.$inferSelect
export type CreateAttachment = typeof attachments.$inferInsert
