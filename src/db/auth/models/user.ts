import { z } from 'zod/v4'
import { roleZodEnum } from '../../schema/enums.ts'

/*
  Roles de sistema de assistencialismo político
  ADMIN - Administrador - Possui todas as permissões
  MANAGER - Gestor - Pode visualizar todas demandas, registrar solicitações de demandas da população e cadastrar o solicitante da demanda
  CLERK - Atendente - Pode registrar solicitações de demandas da população e cadastrar o solicitante da demanda
  ANALYST - Analista - Pode atualizar o status da demanda
  APPLICANT - Solicitante - Pode visualizar as demandas registradas por ele
*/
export const userSchema = z.object({
  id: z.string(),
  role: roleZodEnum,
})

export type User = z.infer<typeof userSchema>
