export function validateBusinessRules(entityName, data, existingRecord) {
  const errors = {};
  
  if (entityName === 'engagement') {
    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date * 1000);
      const end = new Date(data.end_date * 1000);
      if (end < start) {
        errors.end_date = 'End date must be after start date';
      }
    }
    
    if (data.budget && data.budget < 0) {
      errors.budget = 'Budget cannot be negative';
    }
    
    if (data.status && existingRecord?.status) {
      const validTransitions = {
        draft: ['active', 'cancelled'],
        active: ['completed', 'on_hold', 'cancelled'],
        on_hold: ['active', 'cancelled'],
        completed: [],
        cancelled: []
      };
      const allowed = validTransitions[existingRecord.status] || [];
      if (!allowed.includes(data.status) && data.status !== existingRecord.status) {
        errors.status = `Cannot transition from ${existingRecord.status} to ${data.status}`;
      }
    }
  }
  
  if (entityName === 'rfi') {
    if (data.deadline) {
      const deadline = new Date(data.deadline * 1000);
      const now = new Date();
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      
      if (deadline < now) {
        errors.deadline = 'Deadline cannot be in the past';
      }
      if (deadline > twoYearsFromNow) {
        errors.deadline = 'Deadline cannot be more than 2 years in future';
      }
    }
  }
  
  if (entityName === 'user') {
    if (data.role && !['admin', 'manager', 'reviewer', 'client_user'].includes(data.role)) {
      errors.role = 'Invalid user role';
    }
  }
  
  if (entityName === 'review') {
    if (data.score && (data.score < 0 || data.score > 100)) {
      errors.score = 'Score must be between 0 and 100';
    }
  }
  
  return errors;
}
