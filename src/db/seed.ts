import { reset, seed } from 'drizzle-seed'
import { db, sql } from './connection.ts'
import { schema } from './schema/index.ts'

await reset(db, schema)

await seed(db, schema).refine((f) => {
  return {
    // Usuários
    users: {
      count: 10,
      columns: {
        id: f.uuid(),
        name: f.fullName(),
        email: f.email(),
        password_hash: '$2a$10$HASHED123456',
        avatar_url: 'https://github.com/diego3g.png',
      },
    },

    // Organizações
    organizations: {
      count: 10,
      columns: {
        id: f.uuid(),
        name: f.companyName(),
        slug: f.companyName(),
        domain: f.companyName(),
        avatar_url: 'https://github.com/diego3g.png',
        should_attach_users_by_domain: f.boolean(),
        owner_id: f.uuid(),
      },
    },

    // Unidades
    units: {
      count: 10,
      columns: {
        id: f.uuid(),
        name: f.firstName(),
        slug: f.companyName(),
        domain: f.companyName(),
        description: f.loremIpsum(),
        location: f.state(),
        owner_id: f.uuid(),
        organization_id: f.uuid(),
      },
    },
  }
})

await sql.end()
