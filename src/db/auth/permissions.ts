import type { AbilityBuilder } from '@casl/ability'
import type { RoleType } from '../schema/enums.ts'
import type { AppAbility } from './index.ts'
import type { User } from './models/user.ts'

type PermissionsByRole = (
  user: User,
  builder: AbilityBuilder<AppAbility>
) => void

export const permissions: Record<RoleType, PermissionsByRole> = {
  ADMIN: (user, { can, cannot }) => {
    can('manage', 'all')
    cannot(['transfer_ownership', 'update'], 'Unit')
    can(['transfer_ownership', 'update'], 'Unit', { ownerId: { $eq: user.id } })
    can(['transfer_ownership', 'update'], 'Organization', {
      owner_id: { $eq: user.id },
    })
  },
  MANAGER: (_, { can, cannot }) => {
    can('create', 'Applicant') // Pode criar demandas
    can('create', 'Demand') // Pode criar demandas
    can('get', 'Demand') // Pode listar demandas da unidade a qual pertence
    can('manage', 'User') // Pode gerenciar usuários
    cannot('delete', 'User') // Não pode deletar um usuário
  },
  CLERK: (user, { can }) => {
    can('get', 'Applicant') // Pode visualizar applicant
    can('create', 'Applicant') // Pode criar applicant
    can('create', 'Demand') // Pode criar demandas
    can('get', 'Demand', { ownerId: { $eq: user.id } }) // Pode listar demandas próprias
    can(['assign', 'create'], 'User') // Pode atribuir demandas e criar usuários
  },
  ANALYST: (_, { can }) => {
    can(['get', 'update'], 'Demand') // Pode listar e atualizar demandas
  },
  // APPLICANT: (user, { can }) => {
  //   can('get', 'Demand', { ownerId: { $eq: user.id } }) // Pode listar demandas
  // },
  BILLING: (_, { can }) => {
    can('manage', 'Billing')
  },
}
