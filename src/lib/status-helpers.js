/**
 * Status Helpers - Status enumerations and transition maps
 * These are the standard status values used by moonlanding parity entities
 */

// Engagement statuses
export const ENGAGEMENT_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

export const ENGAGEMENT_STAGE = {
  DRAFT: 'draft',
  SCOPE: 'scope',
  KICKOFF: 'kickoff',
  RFI: 'rfi',
  REVIEW: 'review',
  CLOSEOUT: 'closeout',
  CLOSED: 'closed',
};

// RFI statuses
export const RFI_STATUS = {
  DRAFT: 'draft',
  OPEN: 'open',
  DEFERRED: 'deferred',
  ANSWERED: 'answered',
  CLARIFICATION: 'clarification',
  CLOSED: 'closed',
};

export const RFI_CLIENT_STATUS = {
  PENDING: 'pending',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
};

export const RFI_AUDITOR_STATUS = {
  REVIEW: 'review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Review statuses
export const REVIEW_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  COMPLETED: 'completed',
};

// Highlight statuses
export const HIGHLIGHT_STATUS = {
  OPEN: 'open',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
};

// Standard stage transitions
export const STAGE_TRANSITIONS = {
  draft: 'scope',
  scope: 'kickoff',
  kickoff: 'rfi',
  rfi: 'review',
  review: 'closeout',
  closeout: 'closed',
};

/**
 * Get next stage in standard lifecycle
 * @param {string} currentStage
 * @returns {string|null}
 */
export function getNextStage(currentStage) {
  return STAGE_TRANSITIONS[currentStage] || null;
}

/**
 * Get all valid transitions for an engagement
 * @param {string} currentStage
 * @returns {Array<string>}
 */
export function getValidTransitions(currentStage) {
  const transitions = [];
  for (const [from, to] of Object.entries(STAGE_TRANSITIONS)) {
    if (from === currentStage) transitions.push(to);
  }
  // Also allow backward steps
  for (const [from, to] of Object.entries(STAGE_TRANSITIONS)) {
    if (to === currentStage) transitions.push(from);
  }
  return [...new Set(transitions)];
}
