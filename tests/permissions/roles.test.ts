import { describe, expect, it } from 'vitest'
import { defineAbilityFor } from '../../src/db/auth/index.ts'
import type { User } from '../../src/db/auth/models/user.ts'

describe('Permissions - ADMIN Role', () => {
  const admin: User = {
    id: 'admin-id',
    role: 'ADMIN',
  }

  it('should allow admin to manage all resources', () => {
    const ability = defineAbilityFor(admin)

    expect(ability.can('manage', 'all')).toBe(true)
    expect(ability.can('create', 'User')).toBe(true)
    expect(ability.can('delete', 'User')).toBe(true)
    expect(ability.can('get', 'Applicant')).toBe(true)
    expect(ability.can('create', 'Demand')).toBe(true)
  })
})

describe('Permissions - MANAGER Role (RH)', () => {
  const manager: User = {
    id: 'manager-id',
    role: 'MANAGER',
  }

  it('should allow manager to view and create applicants', () => {
    const ability = defineAbilityFor(manager)

    expect(ability.can('get', 'Applicant')).toBe(true)
    expect(ability.can('create', 'Applicant')).toBe(true)
  })

  it('should allow manager to create and view demands', () => {
    const ability = defineAbilityFor(manager)

    expect(ability.can('create', 'Demand')).toBe(true)
    expect(ability.can('get', 'Demand')).toBe(true)
  })

  it('should allow manager to manage users', () => {
    const ability = defineAbilityFor(manager)

    expect(ability.can('manage', 'User')).toBe(true)
    expect(ability.can('create', 'User')).toBe(true)
    expect(ability.can('update', 'User')).toBe(true)
    expect(ability.can('get', 'User')).toBe(true)
  })

  it('should not allow manager to delete users', () => {
    const ability = defineAbilityFor(manager)

    expect(ability.can('delete', 'User')).toBe(false)
  })
})

describe('Permissions - CLERK Role (Recepcionista)', () => {
  const clerk: User = {
    id: 'clerk-id',
    role: 'CLERK',
  }

  it('should allow clerk to view and create applicants', () => {
    const ability = defineAbilityFor(clerk)

    expect(ability.can('get', 'Applicant')).toBe(true)
    expect(ability.can('create', 'Applicant')).toBe(true)
  })

  it('should allow clerk to create, view and update demands', () => {
    const ability = defineAbilityFor(clerk)

    expect(ability.can('create', 'Demand')).toBe(true)
    expect(ability.can('get', 'Demand')).toBe(true)
    expect(ability.can('update', 'Demand')).toBe(true)
  })

  it('should allow clerk to assign users to demands', () => {
    const ability = defineAbilityFor(clerk)

    expect(ability.can('assign', 'User')).toBe(true)
  })

  it('should not allow clerk to manage or delete users', () => {
    const ability = defineAbilityFor(clerk)

    expect(ability.can('manage', 'User')).toBe(false)
    expect(ability.can('delete', 'User')).toBe(false)
    expect(ability.can('create', 'User')).toBe(false)
  })

  it('should not allow clerk to manage billing', () => {
    const ability = defineAbilityFor(clerk)

    expect(ability.can('manage', 'Billing')).toBe(false)
  })
})

describe('Permissions - ANALYST Role (Médico)', () => {
  const analyst: User = {
    id: 'analyst-id',
    role: 'ANALYST',
  }

  it('should allow analyst to view and update demands (with conditions in real usage)', () => {
    const ability = defineAbilityFor(analyst)

    // Nota: as condições (memberId) são verificadas em runtime nas rotas
    // Aqui testamos apenas se a capacidade existe
    expect(ability.can('get', 'Demand')).toBe(true)
    expect(ability.can('update', 'Demand')).toBe(true)
  })

  it('should not allow analyst to create demands', () => {
    const ability = defineAbilityFor(analyst)

    expect(ability.can('create', 'Demand')).toBe(false)
  })

  it('should not allow analyst to view applicants', () => {
    const ability = defineAbilityFor(analyst)

    expect(ability.can('get', 'Applicant')).toBe(false)
    expect(ability.can('create', 'Applicant')).toBe(false)
  })

  it('should not allow analyst to manage users', () => {
    const ability = defineAbilityFor(analyst)

    expect(ability.can('manage', 'User')).toBe(false)
    expect(ability.can('create', 'User')).toBe(false)
    expect(ability.can('assign', 'User')).toBe(false)
  })
})

describe('Permissions - BILLING Role (Faturista)', () => {
  const billing: User = {
    id: 'billing-id',
    role: 'BILLING',
  }

  it('should allow billing to view applicants', () => {
    const ability = defineAbilityFor(billing)

    expect(ability.can('get', 'Applicant')).toBe(true)
  })

  it('should allow billing to view all demands', () => {
    const ability = defineAbilityFor(billing)

    expect(ability.can('get', 'Demand')).toBe(true)
  })

  it('should allow billing to update demands (for status change)', () => {
    const ability = defineAbilityFor(billing)

    expect(ability.can('update', 'Demand')).toBe(true)
  })

  it('should allow billing to manage billing resources', () => {
    const ability = defineAbilityFor(billing)

    expect(ability.can('manage', 'Billing')).toBe(true)
  })

  it('should not allow billing to create demands', () => {
    const ability = defineAbilityFor(billing)

    expect(ability.can('create', 'Demand')).toBe(false)
  })

  it('should not allow billing to create applicants', () => {
    const ability = defineAbilityFor(billing)

    expect(ability.can('create', 'Applicant')).toBe(false)
  })

  it('should not allow billing to manage users', () => {
    const ability = defineAbilityFor(billing)

    expect(ability.can('manage', 'User')).toBe(false)
    expect(ability.can('create', 'User')).toBe(false)
  })
})
