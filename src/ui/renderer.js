import { renderDialog } from '@/ui/dialog-engine.js'
import { renderComponent, getComponentConfig, validateComponentProps } from '@/ui/component-engine.js'

export const REDIRECT = Symbol('REDIRECT')
export { renderDialog, renderComponent, getComponentConfig, validateComponentProps }

export { STAGE_COLORS, STATUS_COLORS, TOAST_SCRIPT, fmtVal, statusLabel } from '@/ui/render-helpers.js'
export { generateHtml, breadcrumb, nav, page, fullPage, statCards, confirmDialog, dataTable } from '@/ui/layout.js'
export { renderLogin, renderPasswordReset, renderPasswordResetConfirm, renderAccessDenied } from '@/ui/auth-pages.js'
export { renderDashboard, renderAuditDashboard, renderSystemHealth } from '@/ui/dashboard-renderer.js'
export { renderEntityList, renderEntityDetail, renderEntityForm, renderSettings } from '@/ui/entity-renderer.js'

export {
  linearProgress, circularProgress, engagementProgress, emptyState,
  getUserAvatarUrl, userAvatar, teamAvatarGroup, infoBubble,
  sortableList, responseChoiceBox, responseAttachment,
  accordion, divider, responsiveClass, reviewCalcFields
} from '@/ui/widgets.js'

export { dataGridAdvanced, collapsibleSidebar } from '@/ui/advanced-widgets.js'

export {
  engagementCard, mobileEngagementCard, stagePipeline,
  activityTimeline, splashScreen, swUpdateBanner
} from '@/ui/engagement-cards.js'

export {
  mobileReviewCard, sidebarReviewDetails, archiveReviewDialog,
  reviewOpenCloseToggle, reviewPrivateToggle, markAllHighlightsResolved
} from '@/ui/review-widgets.js'

export {
  colorPickerDialog, dateChoiceDialog, stageTransitionDialog,
  teamAssignmentDialog, teamSelector
} from '@/ui/picker-dialogs.js'
