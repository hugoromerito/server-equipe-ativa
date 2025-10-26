import { describe, expect, it } from 'vitest'
import {
  getAvailableStatusTransitions,
  validateCompleteStatusTransition,
  validateRoleStatusPermission,
  validateStatusTransition,
} from '../../src/utils/demand-status-transitions.ts'

describe('Status Transitions Validation', () => {
  describe('validateStatusTransition', () => {
    it('should allow valid transitions from PENDING', () => {
      expect(() => validateStatusTransition('PENDING', 'CHECK_IN')).not.toThrow()
      expect(() => validateStatusTransition('PENDING', 'IN_PROGRESS')).not.toThrow()
      expect(() => validateStatusTransition('PENDING', 'RESOLVED')).not.toThrow()
    })

    it('should allow valid transitions from CHECK_IN', () => {
      expect(() => validateStatusTransition('CHECK_IN', 'IN_PROGRESS')).not.toThrow()
      expect(() => validateStatusTransition('CHECK_IN', 'RESOLVED')).not.toThrow()
    })

    it('should allow valid transition from IN_PROGRESS to RESOLVED', () => {
      expect(() => validateStatusTransition('IN_PROGRESS', 'RESOLVED')).not.toThrow()
    })

    it('should allow valid transition from RESOLVED to BILLED', () => {
      expect(() => validateStatusTransition('RESOLVED', 'BILLED')).not.toThrow()
    })

    it('should throw error for invalid transitions', () => {
      expect(() => validateStatusTransition('BILLED', 'PENDING')).toThrow(
        'Transição de status inválida'
      )
      expect(() => validateStatusTransition('RESOLVED', 'PENDING')).toThrow(
        'Transição de status inválida'
      )
      expect(() => validateStatusTransition('IN_PROGRESS', 'CHECK_IN')).toThrow(
        'Transição de status inválida'
      )
    })

    it('should not throw error when status does not change', () => {
      expect(() => validateStatusTransition('PENDING', 'PENDING')).not.toThrow()
      expect(() => validateStatusTransition('BILLED', 'BILLED')).not.toThrow()
    })
  })

  describe('validateRoleStatusPermission - CLERK', () => {
    it('should allow CLERK to change status to CHECK_IN, IN_PROGRESS, RESOLVED', () => {
      expect(() =>
        validateRoleStatusPermission('CLERK', 'PENDING', 'CHECK_IN')
      ).not.toThrow()
      expect(() =>
        validateRoleStatusPermission('CLERK', 'CHECK_IN', 'IN_PROGRESS')
      ).not.toThrow()
      expect(() =>
        validateRoleStatusPermission('CLERK', 'IN_PROGRESS', 'RESOLVED')
      ).not.toThrow()
    })

    it('should not allow CLERK to change status to BILLED', () => {
      // CLERK não pode alterar demands com status RESOLVED (validação FROM vem primeiro)
      expect(() =>
        validateRoleStatusPermission('CLERK', 'RESOLVED', 'BILLED')
      ).toThrow('Você não tem permissão para alterar demands com status "RESOLVED"')
    })

    it('should not allow CLERK to change from RESOLVED', () => {
      expect(() =>
        validateRoleStatusPermission('CLERK', 'RESOLVED', 'BILLED')
      ).toThrow()
    })
  })

  describe('validateRoleStatusPermission - ANALYST', () => {
    it('should allow ANALYST to change from CHECK_IN to IN_PROGRESS', () => {
      expect(() =>
        validateRoleStatusPermission('ANALYST', 'CHECK_IN', 'IN_PROGRESS')
      ).not.toThrow()
    })

    it('should allow ANALYST to change from IN_PROGRESS to RESOLVED', () => {
      expect(() =>
        validateRoleStatusPermission('ANALYST', 'IN_PROGRESS', 'RESOLVED')
      ).not.toThrow()
    })

    it('should not allow ANALYST to change from PENDING', () => {
      expect(() =>
        validateRoleStatusPermission('ANALYST', 'PENDING', 'CHECK_IN')
      ).toThrow('Você não tem permissão para alterar demands com status "PENDING"')
    })

    it('should not allow ANALYST to change to BILLED', () => {
      expect(() =>
        validateRoleStatusPermission('ANALYST', 'RESOLVED', 'BILLED')
      ).toThrow()
    })
  })

  describe('validateRoleStatusPermission - BILLING', () => {
    it('should allow BILLING to change from RESOLVED to BILLED', () => {
      expect(() =>
        validateRoleStatusPermission('BILLING', 'RESOLVED', 'BILLED')
      ).not.toThrow()
    })

    it('should not allow BILLING to change from other status', () => {
      expect(() =>
        validateRoleStatusPermission('BILLING', 'PENDING', 'CHECK_IN')
      ).toThrow('Você não tem permissão para alterar demands com status "PENDING"')

      expect(() =>
        validateRoleStatusPermission('BILLING', 'CHECK_IN', 'IN_PROGRESS')
      ).toThrow()
    })

    it('should not allow BILLING to change to status other than BILLED', () => {
      expect(() =>
        validateRoleStatusPermission('BILLING', 'RESOLVED', 'IN_PROGRESS')
      ).toThrow('Você não tem permissão para alterar status para "IN_PROGRESS"')
    })
  })

  describe('validateRoleStatusPermission - ADMIN', () => {
    it('should allow ADMIN to make most transitions', () => {
      expect(() =>
        validateRoleStatusPermission('ADMIN', 'PENDING', 'CHECK_IN')
      ).not.toThrow()
      expect(() =>
        validateRoleStatusPermission('ADMIN', 'CHECK_IN', 'IN_PROGRESS')
      ).not.toThrow()
      expect(() =>
        validateRoleStatusPermission('ADMIN', 'IN_PROGRESS', 'RESOLVED')
      ).not.toThrow()
      expect(() =>
        validateRoleStatusPermission('ADMIN', 'RESOLVED', 'BILLED')
      ).not.toThrow()
    })
  })

  describe('validateRoleStatusPermission - MANAGER', () => {
    it('should not allow MANAGER to change status directly', () => {
      expect(() =>
        validateRoleStatusPermission('MANAGER', 'PENDING', 'CHECK_IN')
      ).toThrow('Você não tem permissão para alterar demands com status "PENDING"')
    })
  })

  describe('validateCompleteStatusTransition', () => {
    it('should validate both transition and role permission', () => {
      // Válido: Médico pode mudar de CHECK_IN para IN_PROGRESS
      expect(() =>
        validateCompleteStatusTransition('ANALYST', 'CHECK_IN', 'IN_PROGRESS')
      ).not.toThrow()

      // Inválido: Transição não permitida
      expect(() =>
        validateCompleteStatusTransition('ADMIN', 'BILLED', 'PENDING')
      ).toThrow('Transição de status inválida')

      // Inválido: Role não tem permissão
      expect(() =>
        validateCompleteStatusTransition('CLERK', 'RESOLVED', 'BILLED')
      ).toThrow('Você não tem permissão')
    })
  })

  describe('getAvailableStatusTransitions', () => {
    it('should return available transitions for CLERK from PENDING', () => {
      const transitions = getAvailableStatusTransitions('CLERK', 'PENDING')
      expect(transitions).toContain('CHECK_IN')
      expect(transitions).toContain('IN_PROGRESS')
      expect(transitions).toContain('RESOLVED')
      expect(transitions).not.toContain('BILLED')
    })

    it('should return available transitions for ANALYST from CHECK_IN', () => {
      const transitions = getAvailableStatusTransitions('ANALYST', 'CHECK_IN')
      expect(transitions).toContain('IN_PROGRESS')
      expect(transitions).not.toContain('CHECK_IN')
      expect(transitions).not.toContain('BILLED')
    })

    it('should return available transitions for BILLING from RESOLVED', () => {
      const transitions = getAvailableStatusTransitions('BILLING', 'RESOLVED')
      expect(transitions).toContain('BILLED')
      expect(transitions).toHaveLength(1)
    })

    it('should return empty array for MANAGER', () => {
      const transitions = getAvailableStatusTransitions('MANAGER', 'PENDING')
      expect(transitions).toHaveLength(0)
    })

    it('should return empty array for final status', () => {
      const transitions = getAvailableStatusTransitions('ADMIN', 'BILLED')
      expect(transitions).toHaveLength(0)
    })
  })
})
