import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import {
  jobTitles,
  members,
  organizations,
  units,
  users,
} from '../../../db/schema/index.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { ForbiddenError } from '../_errors/forbidden-error.ts'
import { NotFoundError } from '../_errors/not-found-error.ts'
import { generateTimesheetPDF } from '../../../utils/generate-timesheet-pdf.ts'

/**
 * Converte array de dias da semana para string legível
 */
function formatWorkDays(workingDays: string[] | null): string {
  if (!workingDays || workingDays.length === 0) {
    return 'TODOS OS DIAS'
  }

  const dayMap: Record<string, string> = {
    DOMINGO: 'DOM',
    SEGUNDA: 'SEG',
    TERCA: 'TER',
    QUARTA: 'QUA',
    QUINTA: 'QUI',
    SEXTA: 'SEX',
    SABADO: 'SÁB',
  }

  const days = workingDays.map((d) => dayMap[d] || d)

  // Detectar padrões comuns
  const weekDays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX']
  const hasAllWeekDays = weekDays.every((d) => days.includes(d))

  if (hasAllWeekDays && days.length === 5) {
    return 'SEG. A SEXTA-FEIRA'
  }

  if (hasAllWeekDays && days.includes('SÁB') && days.length === 6) {
    return 'SEG. A SÁBADO'
  }

  return days.join(', ')
}

/**
 * Rota para gerar PDF de folha de ponto de um membro
 *
 * @route GET /organizations/:slug/units/:unitSlug/members/:memberId/timesheet-pdf
 * @description Gera um PDF de folha de ponto mensal para um membro específico
 */
export const generateMemberTimesheetPDFRoute: FastifyPluginCallbackZod = (
  app
) => {
  app.register(auth).get(
    '/organizations/:slug/units/:unitSlug/members/:memberId/timesheet-pdf',
    {
      preHandler: [authPreHandler],
      schema: {
        tags: ['Members', 'Timesheet'],
        summary: 'Gerar PDF de folha de ponto do membro',
        description:
          'Gera um arquivo PDF com a folha de ponto mensal de um membro, incluindo todos os dias do mês com campos para assinatura. ' +
          'Finais de semana são destacados com fundo cinza.',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string().describe('Slug da organização'),
          unitSlug: z.string().describe('Slug da unidade'),
          memberId: z.string().uuid().describe('ID do membro'),
        }),
        querystring: z.object({
          month: z
            .coerce
            .number()
            .int()
            .min(1)
            .max(12)
            .optional()
            .describe('Mês (1-12), padrão: mês atual'),
          year: z
            .coerce
            .number()
            .int()
            .min(2020)
            .max(2100)
            .optional()
            .describe('Ano, padrão: ano atual'),
        }),
      },
    },
    async (request, reply) => {
      const { slug, unitSlug, memberId } = request.params
      const userId = await request.getCurrentUserId()

      // Usar mês/ano atual se não especificado
      const now = new Date()
      const month = request.query.month || now.getMonth() + 1
      const year = request.query.year || now.getFullYear()

      // Verificar permissões
      const { organization, membership } = await request.getUserMembership(
        slug,
        unitSlug
      )

      const { cannot } = getUserPermissions(
        userId,
        membership.unit_role || membership.organization_role
      )

      // Apenas ADMIN e MANAGER podem gerar PDFs
      if (cannot('get', 'User')) {
        throw new ForbiddenError(
          'Você não possui autorização para gerar folhas de ponto.'
        )
      }

      // Buscar unidade
      const [unit] = await db
        .select({
          id: units.id,
          name: units.name,
        })
        .from(units)
        .where(
          and(
            eq(units.slug, unitSlug),
            eq(units.organization_id, organization.id)
          )
        )
        .limit(1)

      if (!unit) {
        throw new NotFoundError('Unidade não encontrada.')
      }

      // Buscar dados do membro
      const [memberData] = await db
        .select({
          memberId: members.id,
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          userCreatedAt: users.created_at,
          jobTitleId: jobTitles.id,
          jobTitleName: jobTitles.name,
          workingDays: members.working_days,
        })
        .from(members)
        .innerJoin(users, eq(members.user_id, users.id))
        .leftJoin(jobTitles, eq(members.job_title_id, jobTitles.id))
        .where(and(eq(members.id, memberId), eq(members.unit_id, unit.id)))
        .limit(1)

      if (!memberData) {
        throw new NotFoundError(
          'Membro não encontrado nesta unidade.'
        )
      }

      // Buscar dados da organização
      const [orgData] = await db
        .select({
          name: organizations.name,
          domain: organizations.domain,
        })
        .from(organizations)
        .where(eq(organizations.id, organization.id))
        .limit(1)

      // Formatar dados para o PDF
      const workDaysStr = formatWorkDays(memberData.workingDays)

      // Gerar PDF
      const pdfStream = generateTimesheetPDF({
        organization: {
          name: orgData?.name || 'Organização',
          cnpj: undefined, // Você pode adicionar este campo no schema se necessário
          address: unit.name, // Usando o nome da unidade como "endereço"
        },
        member: {
          name: memberData.userName || 'Funcionário',
          cpf: undefined, // CPF não está disponível no schema atual
          jobTitle: memberData.jobTitleName || 'Não definido',
          admissionDate: memberData.userCreatedAt
            ? new Date(memberData.userCreatedAt).toLocaleDateString('pt-BR')
            : undefined,
          workingDays: memberData.workingDays || undefined,
        },
        schedule: {
          workDays: workDaysStr,
          entryTime: '08:00h',
          exitTime: '17:30h',
          intervalStart: '12:00h',
          intervalEnd: '13:00h',
        },
        month,
        year,
      })

      // Configurar headers para download do PDF
      const fileName = `folha-ponto-${memberData.userName?.replace(/\s+/g, '-').toLowerCase() || 'membro'}-${month}-${year}.pdf`

      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return reply.send(pdfStream)
    }
  )
}
