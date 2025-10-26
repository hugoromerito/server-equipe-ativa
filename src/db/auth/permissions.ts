import type { AbilityBuilder } from '@casl/ability'
import type { RoleType } from '../schema/enums.ts'
import type { AppAbility } from './index.ts'
import type { User } from './models/user.ts'

type PermissionsByRole = (
  user: User,
  builder: AbilityBuilder<AppAbility>
) => void

export const permissions: Record<RoleType, PermissionsByRole> = {
  /**
   * ADMIN - Administrador
   * - Se for dono da organização: pode fazer tudo
   * - Se não for dono: pode gerenciar a unidade, mas não pode transferir propriedade
   */
  ADMIN: (user, { can, cannot }) => {
    can('manage', 'all')
    cannot(['transfer_ownership', 'update'], 'Unit')
    can(['transfer_ownership', 'update'], 'Unit', { ownerId: { $eq: user.id } })
    can(['transfer_ownership', 'update'], 'Organization', {
      owner_id: { $eq: user.id },
    })
  },

  /**
   * MANAGER - RH (Recursos Humanos)
   * - Gerencia usuários (members) da unit
   * - Pode criar, editar e visualizar applicants
   * - Pode criar e visualizar demands
   * - Gera folha de ponto dos members
   * - Altera dias e horários de trabalho dos members
   * - NÃO pode deletar usuários
   */
  MANAGER: (_, { can, cannot }) => {
    can('get', 'Applicant') // Visualizar pacientes
    can('create', 'Applicant') // Criar pacientes
    can('create', 'Demand') // Criar atendimentos
    can('get', 'Demand') // Visualizar atendimentos da unit
    can('manage', 'User') // Gerenciar usuários (criar, editar, gerar folha de ponto, alterar horários)
    cannot('delete', 'User') // Não pode deletar usuários
  },

  /**
   * CLERK - Recepcionista
   * - Cadastra e visualiza applicants (pacientes) da unit
   * - Cria e visualiza demands (atendimentos) da unit
   * - Altera status das demands: PENDING → CHECK_IN, IN_PROGRESS, RESOLVED
   * - NÃO pode gerenciar usuários
   * - NÃO pode alterar status para BILLED ou REJECTED
   */
  CLERK: (_, { can }) => {
    can('get', 'Applicant') // Visualizar pacientes
    can('create', 'Applicant') // Criar pacientes
    can('create', 'Demand') // Criar atendimentos
    can('get', 'Demand') // Visualizar atendimentos da unit
    can('update', 'Demand') // Atualizar status das demands (CHECK_IN, IN_PROGRESS, RESOLVED)
    can('assign', 'User') // Atribuir demands a médicos
  },

  /**
   * ANALYST - Médico
   * - Visualiza apenas as demands (atendimentos) atribuídas a ele
   * - Altera status: CHECK_IN → IN_PROGRESS
   * - Altera status: IN_PROGRESS → RESOLVED
   * - NÃO visualiza applicants diretamente
   * - NÃO cria demands
   * - NÃO pode alterar status para REJECTED
   */
  ANALYST: (user, { can }) => {
    can('get', 'Demand', { memberId: { $eq: user.id } }) // Visualizar apenas demands atribuídas a ele
    can('update', 'Demand', { memberId: { $eq: user.id } }) // Atualizar status (CHECK_IN → IN_PROGRESS → RESOLVED)
  },

  /**
   * BILLING - Faturista
   * - Visualiza todas as demands da unit (prioriza RESOLVED)
   * - Visualiza applicants (pacientes)
   * - Altera status: RESOLVED → BILLED
   * - Gerencia faturamento
   */
  BILLING: (_, { can }) => {
    can('get', 'Applicant') // Visualizar pacientes
    can('get', 'Demand') // Visualizar atendimentos da unit
    can('update', 'Demand') // Atualizar status (RESOLVED → BILLED)
    can('manage', 'Billing') // Gerenciar faturamento
  },
}
