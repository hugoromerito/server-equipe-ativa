import { FastifyError } from 'fastify'

export class TooManyRequestsError extends Error implements FastifyError {
  code = 'TOO_MANY_REQUESTS'
  statusCode = 429

  constructor(message = 'Muitas requisições. Tente novamente mais tarde.') {
    super(message)
    this.name = 'TooManyRequestsError'
  }
}
