/**
 * Application Routes Configuration
 * 
 * Centralizes registration of all application routes
 */

import type { FastifyInstance } from 'fastify'

// Auth routes
import {
  authenticateWithPasswordRoute,
  authenticateWithGoogleRoute,
  getProfileRoute,
  updateProfileRoute,
  requestPasswordRecoverRoute,
  resetPasswordRoute,
} from '../http/routes/auth/index.ts'

// Organization routes
import {
  createOrganizationRoute,
  getMembershipRoute,
  getOrganizationRoute,
  getOrganizationsRoute,
  shutdownOrganizationRoute,
  updateOrganizationRoute,
} from '../http/routes/organizations/index.ts'

// Unit routes
import { createUnitRoute, getUnitsRoute } from '../http/routes/units/index.ts'

// User routes
import { createUserRoute, getUsersRoute } from '../http/routes/users/index.ts'

// Member routes
import {
  generateMemberTimesheetPDFRoute,
  getAvailableMembersRoute,
  getMemberAvailabilityScheduleRoute,
  getMembersOrganizationRoute,
  getMembersUnitRoute,
  getScheduleAvailabilityRoute,
  updateMemberJobTitleRoute,
  updateMemberWorkingDaysRoute,
} from '../http/routes/members/index.ts'

// Invite routes
import {
  acceptInviteRoute,
  createInviteRoute,
  getInviteRoute,
  getInvitesRoute,
  getOrganizationInvitesRoute,
  getPendingInvitesRoute,
  rejectInviteRoute,
} from '../http/routes/invites/index.ts'

// Job Title routes
import {
  createJobTitleRoute,
  deleteJobTitleRoute,
  getJobTitleRoute,
  getJobTitlesRoute,
  updateJobTitleRoute,
} from '../http/routes/job-titles/index.ts'

// Applicant routes
import {
  createApplicantRoute,
  getApplicantDemandsRoute,
  getApplicantRoute,
  getApplicantsRoute,
  getCheckApplicantRoute,
} from '../http/routes/applicants/index.ts'

// Demand routes
import {
  assignMemberToDemandRoute,
  createDemandRoute,
  getDemandRoute,
  getDemandsRoute,
  getMemberDemandsRoute,
  updateDemandRoute,
} from '../http/routes/demands/index.ts'

// Attachment routes
import {
  deleteAttachmentRoute,
  downloadAttachmentRoute,
  getAttachmentsRoute,
  uploadApplicantAvatarRoute,
  uploadApplicantDocumentRoute,
  uploadDemandDocumentRoute,
  uploadOrganizationAvatarRoute,
  uploadOrganizationDocumentRoute,
  uploadUserAvatarRoute,
} from '../http/routes/attachments/index.ts'

// Billing routes
import { billingRoutes } from '../http/routes/billing.ts'

// Usage routes
import { usageRoutes } from '../http/routes/usage.ts'

// Stripe webhook routes
import { stripeWebhookRoutes } from '../http/routes/stripe-webhook.ts'

// WebSocket routes
import { websocketInfoRoute } from '../http/routes/websocket/index.ts'

// TV Token routes
import {
  createTVTokenRoute,
  getTVTokensRoute,
  revokeTVTokenRoute,
  validateTVCodeRoute,
} from '../http/routes/tv-tokens/index.ts'

export async function registerRoutes(app: FastifyInstance) {
  await Promise.all([
    // Auth routes
    app.register(authenticateWithPasswordRoute),
    app.register(authenticateWithGoogleRoute),
    app.register(getProfileRoute),
    app.register(updateProfileRoute),
    app.register(requestPasswordRecoverRoute),
    app.register(resetPasswordRoute),

    // Organization routes
    app.register(createOrganizationRoute),
    app.register(getMembershipRoute),
    app.register(getOrganizationRoute),
    app.register(getOrganizationsRoute),
    app.register(shutdownOrganizationRoute),
    app.register(updateOrganizationRoute),

    // Unit routes
    app.register(createUnitRoute),
    app.register(getUnitsRoute),

    // User routes
    app.register(getUsersRoute),
    app.register(createUserRoute),

    // Member routes
    app.register(getMembersOrganizationRoute),
    app.register(getMembersUnitRoute),
    app.register(updateMemberJobTitleRoute),
    app.register(updateMemberWorkingDaysRoute),
    app.register(getAvailableMembersRoute),
    app.register(getMemberAvailabilityScheduleRoute),
    app.register(getScheduleAvailabilityRoute),
    app.register(generateMemberTimesheetPDFRoute),

    // Invite routes
    app.register(acceptInviteRoute),
    app.register(createInviteRoute),
    app.register(getInviteRoute),
    app.register(getInvitesRoute),
    app.register(getOrganizationInvitesRoute),
    app.register(getPendingInvitesRoute),
    app.register(rejectInviteRoute),

    // Job Title routes
    app.register(createJobTitleRoute),
    app.register(getJobTitlesRoute),
    app.register(getJobTitleRoute),
    app.register(updateJobTitleRoute),
    app.register(deleteJobTitleRoute),

    // Applicant routes
    app.register(createApplicantRoute),
    app.register(getApplicantDemandsRoute),
    app.register(getApplicantRoute),
    app.register(getApplicantsRoute),
    app.register(getCheckApplicantRoute),

    // Demand routes
    app.register(assignMemberToDemandRoute),
    app.register(createDemandRoute),
    app.register(getDemandRoute),
    app.register(getDemandsRoute),
    app.register(getMemberDemandsRoute),
    app.register(updateDemandRoute),

    // Attachment routes
    app.register(uploadUserAvatarRoute),
    app.register(uploadApplicantAvatarRoute),
    app.register(uploadOrganizationAvatarRoute),
    app.register(uploadDemandDocumentRoute),
    app.register(uploadApplicantDocumentRoute),
    app.register(uploadOrganizationDocumentRoute),
    app.register(getAttachmentsRoute),
    app.register(downloadAttachmentRoute),
    app.register(deleteAttachmentRoute),

    // Billing routes
    app.register(billingRoutes),

    // Usage routes
    app.register(usageRoutes),

    // Stripe webhook routes
    app.register(stripeWebhookRoutes),

    // WebSocket routes
    app.register(websocketInfoRoute),

    // TV Token routes
    app.register(createTVTokenRoute),
    app.register(getTVTokensRoute),
    app.register(revokeTVTokenRoute),
    app.register(validateTVCodeRoute),
  ])
}
