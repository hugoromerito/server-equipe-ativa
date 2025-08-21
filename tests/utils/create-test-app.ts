import { fastifyCors } from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from '../../src/config/env.ts'
import { errorHandler } from '../../src/http/routes/_errors/error-handler.ts'

export function createTestApp() {
  const app = fastify().withTypeProvider<ZodTypeProvider>()

  app.register(fastifyMultipart)
  app.register(fastifyCors, {
    origin: true,
    credentials: true,
  })

  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Registra o error handler
  app.setErrorHandler(errorHandler)

  return app
}
