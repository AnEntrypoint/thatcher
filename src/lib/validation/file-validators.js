import { detectPathTraversal } from '@/lib/validation/security-validators';

export function validateFileUpload(file, options = {}) {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options;
  const errors = [];
  
  if (file.size > maxSize) {
    errors.push(`File size ${file.size} exceeds maximum ${maxSize} bytes`);
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} not allowed. Allowed: ${allowedTypes.join(', ')}`);
  }
  
  if (allowedExtensions.length > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      errors.push(`File extension not allowed. Allowed: ${allowedExtensions.join(', ')}`);
    }
  }
  
  const pathCheck = detectPathTraversal(file.name);
  if (!pathCheck.safe) {
    errors.push(pathCheck.reason);
  }
  
  const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'scr', 'com', 'pif', 'msi'];
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && DANGEROUS_EXTENSIONS.includes(ext)) {
    errors.push(`Dangerous file extension: ${ext}`);
  }
  
  return { valid: errors.length === 0, errors };
}
