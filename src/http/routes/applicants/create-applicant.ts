import { and, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { isCPF, isTituloEleitor } from 'validation-br'
import { z } from 'zod/v4'

import { db } from '../../../db/connection.ts'
import { applicants } from '../../../db/schema/demands.ts'
import { auth, authPreHandler } from '../../middlewares/auth.ts'
import { getUserPermissions } from '../../utils/get-user-permissions.ts'
import { BadRequestError } from '../_errors/bad-request-error.ts'
import { UnauthorizedError } from '../_errors/unauthorized-error.ts'

// Constants
const MIN_NAME_LENGTH = 2
const MIN_YEAR = 1900
const PHONE_MIN_LENGTH = 10
const PHONE_MAX_LENGTH = 11
const MOBILE_PREFIX_POSITION = 2
const MOBILE_PREFIX = '9'

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

/**
 * Normaliza CPF removendo caracteres especiais
 */
function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/**
 * Normaliza título de eleitor removendo caracteres especiais
 */
function normalizeTicket(ticket: string): string {
  return ticket.replace(/\D/g, '')
}

/**
 * Normaliza telefone removendo caracteres especiais
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Normaliza nomes removendo espaços extras e convertendo para title case
 */
function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/**
 * Valida se o CPF já existe na organização
 */
async function validateCpfUniqueness(
  cpf: string,
  organizationId: string
): Promise<void> {
  const existingCpf = await db
    .select({ id: applicants.id })
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

/**
 * Valida se o título de eleitor já existe na organização
 */
async function validateTicketUniqueness(
  ticket: string,
  organizationId: string
): Promise<void> {
  const existingTicket = await db
    .select({ id: applicants.id })
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

/**
 * Valida se o CPF é válido
 */
function validateCpf(cpf: string): void {
  if (!isCPF(cpf)) {
    throw new BadRequestError('CPF inválido.')
  }
}

/**
 * Valida se o título de eleitor é válido
 */
function validateTicket(ticket: string): void {
  if (!isTituloEleitor(ticket)) {
    throw new BadRequestError('Título de Eleitor inválido.')
  }
}

/**
 * Valida formato do telefone
 */
function validatePhone(phone: string): void {
  const normalizedPhone = normalizePhone(phone)

  // Validação básica: deve ter entre 10 e 11 dígitos
  if (
    normalizedPhone.length < PHONE_MIN_LENGTH ||
    normalizedPhone.length > PHONE_MAX_LENGTH
  ) {
    throw new BadRequestError('Telefone deve conter 10 ou 11 dígitos.')
  }

  // Se tem 11 dígitos, deve começar com 9 (celular)
  if (
    normalizedPhone.length === PHONE_MAX_LENGTH &&
    !normalizedPhone.startsWith(MOBILE_PREFIX, MOBILE_PREFIX_POSITION)
  ) {
    throw new BadRequestError('Número de celular inválido.')
  }
}

/**
 * Valida data de nascimento
 */
function validateBirthdate(birthdate: Date): void {
  const today = new Date()
  const minDate = new Date(MIN_YEAR, 0, 1)

  if (birthdate > today) {
    throw new BadRequestError('Data de nascimento não pode ser no futuro.')
  }

  if (birthdate < minDate) {
    throw new BadRequestError('Data de nascimento inválida.')
  }
}

/**
 * Valida e normaliza todos os dados do solicitante
 */
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
  if (!normalizedData.name || normalizedData.name.length < MIN_NAME_LENGTH) {
    throw new BadRequestError(
      `Nome deve ter pelo menos ${MIN_NAME_LENGTH} caracteres.`
    )
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

/**
 * Cria um novo solicitante no banco de dados
 */
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

// Schema de validação para criação de solicitante
const createApplicantSchema = {
  tags: ['Applicants'],
  summary: 'Cadastra um novo solicitante na organização',
  security: [{ bearerAuth: [] }],
  body: z.object({
    name: z
      .string()
      .min(
        MIN_NAME_LENGTH,
        `Nome deve ter pelo menos ${MIN_NAME_LENGTH} caracteres`
      )
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
    cpf: z.string().min(11, 'CPF deve ter 11 dígitos').max(14, 'CPF inválido'),
    phone: z
      .string()
      .min(
        PHONE_MIN_LENGTH,
        `Telefone deve ter pelo menos ${PHONE_MIN_LENGTH} dígitos`
      )
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
    organizationSlug: z.string().min(1, 'Slug da organização é obrigatório'),
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
}

export const createApplicantRoute: FastifyPluginCallbackZod = (app) => {
  app.register(auth).post(
    '/organizations/:organizationSlug/applicants',
    {
      preHandler: [authPreHandler],
      schema: createApplicantSchema,
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
