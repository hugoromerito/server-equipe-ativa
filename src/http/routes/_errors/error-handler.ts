import type { FastifyInstance } from 'fastify'
import { treeifyError, ZodError } from 'zod/v4'
import { BadRequestError } from './bad-request-error.ts'
import { UnauthorizedError } from './unauthorized-error.ts'

type FastifyErrorHandler = FastifyInstance['errorHandler']
export const errorHandler: FastifyErrorHandler = (error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error',
      errors: treeifyError(error),
    })
  }

  if (error instanceof BadRequestError) {
    return reply.status(400).send({
      message: error.message,
    })
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({
      message: error.message,
    })
  }

  return reply.status(500).send({ message: 'Internal server error.' })
}
