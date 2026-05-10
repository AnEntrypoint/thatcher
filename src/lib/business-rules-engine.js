export class BusinessRulesEngine {
  constructor(config = {}) {
    this.businessRules = config.businessRules || {};
    this.rules = new Map();
    this.initializeDefaultRules();
  }

  initializeDefaultRules() {
    this.registerRule('recreationAllowed', (engagement) => {
      const rule = this.businessRules.recreationRules.engagement[engagement.repeat_interval];
      return rule && !this.isDuplicateEngagement(engagement);
    });

    this.registerRule('daysOutstandingNotificationNeeded', (rfi) => {
      return this.businessRules.rfiDaysOutstanding.enabled;
    });

    this.registerRule('clientCanViewRfi', (user, rfi) => {
      if (user.type === 'client') {
        const role = this.businessRules.clientRoles[user.role];
        return role?.rowAccess === 'all' || rfi.assigned_to?.includes(user.id);
      }
      return true;
    });

    this.registerRule('clientCanRate', (user, engagement) => {
      return user.type === 'client' && user.role === 'client_admin';
    });

    this.registerRule('tenderWarningNeeded', (review) => {
      if (!this.businessRules.tenderDeadlines.enabled) return false;
      if (review.type !== 'tender') return false;

      const now = Date.now();
      const deadline = review.deadline_date * 1000;
      const daysUntil = (deadline - now) / (1000 * 60 * 60 * 24);

      return daysUntil <= this.businessRules.tenderDeadlines.warningDays;
    });
  }

  registerRule(name, evaluator) {
    this.rules.set(name, evaluator);
    return this;
  }

  async evaluateRule(ruleName, context) {
    const rule = this.rules.get(ruleName);
    if (!rule) throw new Error(`Unknown rule: ${ruleName}`);
    return await rule(context);
  }

  getDefaultRole() {
    return this.businessRules.defaultRoleAssignment;
  }

  getDefaultUserType() {
    return this.businessRules.defaultUserType;
  }

  getClientRoleConfig(role) {
    return this.businessRules.clientRoles[role];
  }

  getRecreationConfig(interval) {
    return this.businessRules.recreationRules.engagement[interval];
  }

  isDuplicateEngagement(engagement) {
    return false;
  }

  getDaysOutstandingConfig() {
    return this.businessRules.rfiDaysOutstanding;
  }

  getTenderConfig() {
    return this.businessRules.tenderDeadlines;
  }

  getGoogleDriveConfig() {
    return this.businessRules.googleDriveIntegration;
  }
}

export default BusinessRulesEngine;
