import { z } from 'zod/v4'
import { applicantSchema } from '../models/applicant.ts'

export const applicantSubject = z.tuple([
  z.union([
    z.literal('create'), // Registra applicant
    z.literal('get'), // Visualiza applicant
    z.literal('update'), // Atualiza applicant
    z.literal('delete'), // Deleta applicant
    z.literal('manage'), // Gerencia uma unidade (geralmente é usado para permissões de administrador)
  ]),
  z.union([z.literal('Applicant'), applicantSchema]),
])

export type ApplicantSubject = z.infer<typeof applicantSubject>
