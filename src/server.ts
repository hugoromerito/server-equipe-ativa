import { fastifyCors } from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from './config/env.ts'
import { auth } from './http/middlewares/auth.ts'
import { authenticateWithPasswordRoute } from './http/routes/auth/authenticate-with-password.ts'
import { getProfileRoute } from './http/routes/auth/get-profile.ts'
import { requestPasswordRecoverRoute } from './http/routes/auth/request-password-recover.ts'
import { resetPasswordRoute } from './http/routes/auth/reset-password.ts'
import { getMembersOrganizationRoute } from './http/routes/members/get-members-organization.ts'
import { getMembersUnitRoute } from './http/routes/members/get-members-unit.ts'
import { createOrganizationRoute } from './http/routes/organizations/create-organization.ts'
import { getMembershipRoute } from './http/routes/organizations/get-membership.ts'
import { getOrganizationRoute } from './http/routes/organizations/get-organization.ts'
import { getOrganizationsRoute } from './http/routes/organizations/get-organizations.ts'
import { shutdownOrganizationRoute } from './http/routes/organizations/shutdown-organization.ts'
import { updateOrganizationRoute } from './http/routes/organizations/update-organization.ts'
import { createUnitRoute } from './http/routes/units/create_unit.ts'
import { getUnitsRoute } from './http/routes/units/get-units.ts'
import { createUserRoute } from './http/routes/users/create-user.ts'
import { getUsersRoute } from './http/routes/users/get-users.ts'

const app = fastify().withTypeProvider<ZodTypeProvider>()

app.register(fastifyCors, {
  origin: 'http://localhost:5173', //URL do Frontend
})

app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
})
app.register(auth)

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

app.get('/health', () => {
  return 'OK'
})

app.register(getUsersRoute)
app.register(createUserRoute)
app.register(authenticateWithPasswordRoute)

app.register(requestPasswordRecoverRoute)
app.register(resetPasswordRoute)

app.register(getProfileRoute)

app.register(createOrganizationRoute)
app.register(createUnitRoute)
app.register(getUnitsRoute)

app.register(getOrganizationRoute)
app.register(getOrganizationsRoute)
app.register(shutdownOrganizationRoute)
app.register(updateOrganizationRoute)

app.register(getMembersOrganizationRoute)
app.register(getMembersUnitRoute)

app.register(getMembershipRoute)

app.listen({ port: env.PORT })
