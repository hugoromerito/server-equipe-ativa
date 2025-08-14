import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { isCPF, isTituloEleitor } from 'validation-br'
import { z } from 'zod/v4'
import { db } from '../../../db/connection.ts'
import { applicants } from '../../../db/schema/demands.ts'
import { auth } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

interface ApplicantData {
  name: string
  birthdate: Date
  cpf: string
  phone: string
  mother: string | null
  father: string | null
  ticket: string | null
  observation: string | null
}

// Função para normalizar CPF (remove caracteres especiais)
function normalizeCpf(cpf: string): string {
  return cpf.replace(/[^\d]/g, '')
}

// Função para normalizar ticket (remove caracteres especiais)
function normalizeTicket(ticket: string): string {
  return ticket.replace(/[^\d]/g, '')
}

// Função para normalizar telefone
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

// Função para normalizar nomes (remove espaços extras e converte para title case)
function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

async function validateCpfUniqueness(
  cpf: string,
  organizationId: string
): Promise<void> {
  const existingCpf = await db
    .select()
    .from(applicants)
    .where(
      and(
        eq(applicants.cpf, cpf),
        eq(applicants.organization_id, organizationId)
      )
    )
    .limit(1)

  if (existingCpf.length > 0) {
    throw new BadRequestError('CPF já cadastrado.')
  }
}

async function validateTicketUniqueness(
  ticket: string,
  organizationId: string
): Promise<void> {
  const existingTicket = await db
    .select()
    .from(applicants)
    .where(
      and(
        eq(applicants.ticket, ticket),
        eq(applicants.organization_id, organizationId)
      )
    )
    .limit(1)

  if (existingTicket.length > 0) {
    throw new BadRequestError('Título de eleitor já cadastrado.')
  }
}

function validateCpf(cpf: string): void {
  if (!isCPF(cpf)) {
    throw new BadRequestError('CPF inválido.')
  }
}

function validateTicket(ticket: string): void {
  if (!isTituloEleitor(ticket)) {
    throw new BadRequestError('Título de Eleitor inválido.')
  }
}

function validatePhone(phone: string): void {
  const normalizedPhone = normalizePhone(phone)

  // Validação básica: deve ter entre 10 e 11 dígitos
  if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
    throw new BadRequestError('Telefone deve conter 10 ou 11 dígitos.')
  }

  // Se tem 11 dígitos, deve começar com 9 (celular)
  if (normalizedPhone.length === 11 && !normalizedPhone.startsWith('9', 2)) {
    throw new BadRequestError('Número de celular inválido.')
  }
}

function validateBirthdate(birthdate: Date): void {
  const today = new Date()
  const minDate = new Date(1900, 0, 1)

  if (birthdate > today) {
    throw new BadRequestError('Data de nascimento não pode ser no futuro.')
  }

  if (birthdate < minDate) {
    throw new BadRequestError('Data de nascimento inválida.')
  }
}

function validateAndNormalizeData(data: ApplicantData): ApplicantData {
  // Normalizar dados
  const normalizedData: ApplicantData = {
    name: normalizeName(data.name),
    birthdate: data.birthdate,
    cpf: normalizeCpf(data.cpf),
    phone: normalizePhone(data.phone),
    mother: data.mother ? normalizeName(data.mother) : null,
    father: data.father ? normalizeName(data.father) : null,
    ticket: data.ticket ? normalizeTicket(data.ticket) : null,
    observation: data.observation?.trim() || null,
  }

  // Validações
  if (!normalizedData.name || normalizedData.name.length < 2) {
    throw new BadRequestError('Nome deve ter pelo menos 2 caracteres.')
  }

  validateCpf(normalizedData.cpf)
  validatePhone(normalizedData.phone)
  validateBirthdate(normalizedData.birthdate)

  // Se o ticket foi fornecido, validar
  if (normalizedData.ticket) {
    validateTicket(normalizedData.ticket)
  }

  return normalizedData
}

async function createApplicant(
  data: ApplicantData,
  organizationId: string
): Promise<string> {
  const [applicant] = await db
    .insert(applicants)
    .values({
      name: data.name,
      birthdate: data.birthdate.toISOString(),
      cpf: data.cpf,
      phone: data.phone,
      mother: data.mother,
      father: data.father,
      ticket: data.ticket,
      observation: data.observation,
      organization_id: organizationId,
    })
    .returning({ id: applicants.id })

  return applicant.id
}

export const createApplicantRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/applicants',
    {
      schema: {
        tags: ['applicants'],
        summary: 'Cadastra um novo solicitante na organização',
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z
            .string()
            .min(2, 'Nome deve ter pelo menos 2 caracteres')
            .trim(),
          birthdate: z.preprocess((arg) => {
            if (typeof arg === 'string') {
              const date = new Date(arg)
              if (Number.isNaN(date.getTime())) {
                throw new Error('Data inválida')
              }
              return date
            }
            if (arg instanceof Date) {
              return arg
            }
            throw new Error('Data deve ser uma string ou Date')
          }, z.date()),
          cpf: z
            .string()
            .min(11, 'CPF deve ter 11 dígitos')
            .max(14, 'CPF inválido'),
          phone: z
            .string()
            .min(10, 'Telefone deve ter pelo menos 10 dígitos')
            .max(15, 'Telefone muito longo'),
          mother: z
            .string()
            .trim()
            .min(1)
            .nullable()
            .optional()
            .transform((val) => val || null),
          father: z
            .string()
            .trim()
            .min(1)
            .nullable()
            .optional()
            .transform((val) => val || null),
          ticket: z
            .string()
            .trim()
            .min(12, 'Título de eleitor deve ter 12 dígitos')
            .max(15, 'Título de eleitor inválido')
            .nullable()
            .optional()
            .transform((val) => {
              // Se for string vazia, undefined ou null, retorna null
              if (!val || val.trim() === '') {
                return null
              }
              return val
            }),
          observation: z
            .string()
            .trim()
            .min(1)
            .nullable()
            .optional()
            .transform((val) => val || null),
        }),
        params: z.object({
          organizationSlug: z
            .string()
            .min(1, 'Slug da organização é obrigatório'),
        }),
        response: {
          201: z.object({
            applicantId: z.string().uuid(),
          }),
          400: z.object({
            message: z.string(),
          }),
          401: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await request.getCurrentUserId()
        const { organizationSlug } = request.params
        const rawData = request.body as ApplicantData

        const { organization, membership } =
          await request.getUserMembership(organizationSlug)

        if (!organization) {
          throw new BadRequestError('Organização não encontrada.')
        }

        const { cannot } = getUserPermissions(
          userId,
          membership.unit_role || membership.organization_role
        )

        if (cannot('create', 'Applicant')) {
          throw new UnauthorizedError(
            'Você não tem permissão para criar um novo solicitante.'
          )
        }

        // Validar e normalizar dados
        const applicantData = validateAndNormalizeData(rawData)

        // Verificar unicidade do CPF
        await validateCpfUniqueness(applicantData.cpf, organization.id)

        // Verificar unicidade do ticket (se fornecido)
        if (applicantData.ticket) {
          await validateTicketUniqueness(applicantData.ticket, organization.id)
        }

        // Criar solicitante
        const applicantId = await createApplicant(
          applicantData,
          organization.id
        )

        return reply.status(201).send({ applicantId })
      } catch (error) {
        if (
          error instanceof BadRequestError ||
          error instanceof UnauthorizedError
        ) {
          throw error
        }

        // Log do erro interno
        request.log.error(error, 'Erro interno ao criar solicitante')

        throw new BadRequestError('Erro interno do servidor.')
      }
    }
  )
}
