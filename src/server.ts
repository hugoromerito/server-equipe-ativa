import { fastifyCors } from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import { eq } from 'drizzle-orm'
import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from './config/env.ts'
import { db } from './db/connection.ts'
import { users } from './db/schema/auth.ts'
import { auth } from './http/middlewares/auth.ts'
import { createApplicantRoute } from './http/routes/applicants/create-applicant.ts'
import { getApplicantRoute } from './http/routes/applicants/get-applicant.ts'
import { getApplicantDemandsRoute } from './http/routes/applicants/get-applicant-demands.ts'
import { getCheckApplicantRoute } from './http/routes/applicants/get-check-applicant.ts'
import { authenticateWithPasswordRoute } from './http/routes/auth/authenticate-with-password.ts'
import { getProfileRoute } from './http/routes/auth/get-profile.ts'
import { requestPasswordRecoverRoute } from './http/routes/auth/request-password-recover.ts'
import { resetPasswordRoute } from './http/routes/auth/reset-password.ts'
import { createDemandRoute } from './http/routes/demands/create-demand.ts'
import { getDemandRoute } from './http/routes/demands/get-demand.ts'
import { getDemandsRoute } from './http/routes/demands/get-demands.ts'
import { updateDemandRoute } from './http/routes/demands/update-demand.ts'
import { acceptInviteRoute } from './http/routes/invites/accept-invite.ts'
import { createInviteRoute } from './http/routes/invites/create-invite.ts'
import { getInviteRoute } from './http/routes/invites/get-invite.ts'
import { getInvitesRoute } from './http/routes/invites/get-invites.ts'
import { getPendingInvitesRoute } from './http/routes/invites/get-pending-invites.ts'
import { rejectInviteRoute } from './http/routes/invites/reject-invite.ts'
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

// ✅ Hook para atualizar o last_seen
app.addHook('onRequest', async (request, _reply) => {
  if (typeof request.getCurrentUserId !== 'function') {
    return
  }
  try {
    const userId = await request.getCurrentUserId()
    if (userId) {
      await db
        .update(users)
        .set({ last_seen: new Date() })
        .where(eq(users.id, userId))
    }
  } catch {
    // ignorar erro de token inválido aqui, pois pode ser rota pública
  }
})

app.register(auth)

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

app.get('/health', () => {
  return 'OK'
})

// Applicants
app.register(createApplicantRoute)
app.register(getApplicantDemandsRoute)
app.register(getApplicantRoute)
app.register(getCheckApplicantRoute)

// Auth
app.register(authenticateWithPasswordRoute)
app.register(getProfileRoute)
app.register(requestPasswordRecoverRoute)
app.register(resetPasswordRoute)

// Demands
app.register(createDemandRoute)
app.register(getDemandRoute)
app.register(getDemandsRoute)
app.register(updateDemandRoute)

// Invites
app.register(acceptInviteRoute)
app.register(createInviteRoute)
app.register(getInviteRoute)
app.register(getInvitesRoute)
app.register(getPendingInvitesRoute)
app.register(rejectInviteRoute)

// Members
app.register(getMembersOrganizationRoute)
app.register(getMembersUnitRoute)

// Organizations
app.register(createOrganizationRoute)
app.register(getMembershipRoute)
app.register(getOrganizationRoute)
app.register(getOrganizationsRoute)
app.register(shutdownOrganizationRoute)
app.register(updateOrganizationRoute)

// Units
app.register(createUnitRoute)
app.register(getUnitsRoute)

// Users
app.register(getUsersRoute)
app.register(createUserRoute)

app.listen({ port: env.PORT })
