import { ValidationRules } from '@/ui/validation-rules';

export const ClientValidator = {
  validateField(input, rules) {
    const errors = [];
    const value = input.type === 'file' ? input.files[0] : input.value;
    
    for (const rule of rules) {
      let error;
      if (typeof rule === 'string') {
        error = ValidationRules[rule]?.(value);
      } else if (typeof rule === 'object') {
        const [ruleName, ...args] = Object.entries(rule)[0];
        error = ValidationRules[ruleName]?.(value, ...args);
      }
      if (error) errors.push(error);
    }
    
    return errors;
  },
  
  showFieldError(input, errors) {
    ClientValidator.clearFieldError(input);

    if (errors.length === 0) {
      input.classList.remove('input-error', 'select-error', 'textarea-error');
      input.classList.add('input-success');
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      return;
    }

    input.classList.remove('input-success');
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');

    const errorId = 'err-' + (input.id || input.name);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error text-error text-xs mt-1';
    errorDiv.id = errorId;
    errorDiv.setAttribute('role', 'alert');
    errorDiv.textContent = errors[0];
    errorDiv.dataset.fieldError = input.id || input.name;

    input.setAttribute('aria-describedby', errorId);
    input.parentNode.insertBefore(errorDiv, input.nextSibling);
  },
  
  clearFieldError(input) {
    const existingError = input.parentNode.querySelector(`[data-field-error="${input.id || input.name}"]`);
    if (existingError) existingError.remove();
    input.classList.remove('input-error', 'input-success', 'select-error', 'textarea-error');
  },
  
  attachRealTimeValidation(form) {
    const inputs = form.querySelectorAll('[data-validate]');
    
    inputs.forEach(input => {
      const rules = JSON.parse(input.dataset.validate || '[]');
      
      const validate = () => {
        const errors = ClientValidator.validateField(input, rules);
        ClientValidator.showFieldError(input, errors);
      };
      
      input.addEventListener('blur', validate);
      input.addEventListener('input', () => {
        if (input.classList.contains('input-error')) {
          validate();
        }
      });
    });
  },
  
  validateForm(form) {
    const inputs = form.querySelectorAll('[data-validate]');
    let allValid = true;
    const allErrors = {};
    
    inputs.forEach(input => {
      const rules = JSON.parse(input.dataset.validate || '[]');
      const errors = ClientValidator.validateField(input, rules);
      
      ClientValidator.showFieldError(input, errors);
      
      if (errors.length > 0) {
        allValid = false;
        allErrors[input.id || input.name] = errors;
      }
    });
    
    return { valid: allValid, errors: allErrors };
  },
  
  showFormSummary(form, errors) {
    ClientValidator.clearFormSummary(form);

    if (Object.keys(errors).length === 0) return;

    const summary = document.createElement('div');
    summary.className = 'alert alert-error mb-4';
    summary.dataset.formSummary = 'true';

    const heading = document.createElement('strong');
    heading.textContent = 'Please fix the following errors:';

    const ul = document.createElement('ul');
    ul.className = 'list-disc ml-4 mt-2';

    Object.entries(errors).forEach(([field, errs]) => {
      const li = document.createElement('li');
      li.textContent = `${field}: ${errs[0]}`;
      ul.appendChild(li);
    });

    const wrapper = document.createElement('div');
    wrapper.appendChild(heading);
    wrapper.appendChild(ul);
    summary.appendChild(wrapper);

    form.insertBefore(summary, form.firstChild);
  },
  
  clearFormSummary(form) {
    const existing = form.querySelector('[data-form-summary]');
    if (existing) existing.remove();
  }
};

if (typeof window !== 'undefined') {
  window.ClientValidator = ClientValidator;
  
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-validate-form]').forEach(form => {
      ClientValidator.attachRealTimeValidation(form);
      
      form.addEventListener('submit', (e) => {
        const result = ClientValidator.validateForm(form);
        if (!result.valid) {
          e.preventDefault();
          ClientValidator.showFormSummary(form, result.errors);
          form.querySelector('.input-error')?.focus();
        }
      });
    });
  });
}
