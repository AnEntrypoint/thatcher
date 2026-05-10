export function createLinearProgress(options = {}) {
  const {
    percentage = 0,
    label = '',
    color = '#007bff',
    height = 8,
    showLabel = true
  } = options;

  const container = document.createElement('div');
  container.className = 'linear-progress-container';
  container.style.cssText = `
    width: 100%;
  `;

  const bar = document.createElement('div');
  bar.className = 'linear-progress-bar';
  bar.style.cssText = `
    width: 100%;
    height: ${height}px;
    background: #e0e0e0;
    border-radius: ${height / 2}px;
    overflow: hidden;
    position: relative;
  `;

  const fill = document.createElement('div');
  fill.className = 'linear-progress-fill';
  fill.style.cssText = `
    height: 100%;
    width: ${Math.min(100, Math.max(0, percentage))}%;
    background: ${color};
    border-radius: ${height / 2}px;
    transition: width 0.3s ease;
    position: relative;
  `;

  bar.appendChild(fill);

  if (showLabel) {
    const labelEl = document.createElement('div');
    labelEl.className = 'linear-progress-label';
    labelEl.style.cssText = `
      text-align: center;
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #666;
      font-weight: 500;
    `;
    labelEl.textContent = label || `${percentage}%`;

    container.appendChild(bar);
    container.appendChild(labelEl);
  } else {
    container.appendChild(bar);
  }

  return {
    element: container,
    setPercentage: (newPercentage) => {
      const clamped = Math.min(100, Math.max(0, newPercentage));
      fill.style.width = clamped + '%';
      const labelEl = container.querySelector('.linear-progress-label');
      if (labelEl) {
        labelEl.textContent = label || `${clamped}%`;
      }
    }
  };
}

export function createCircularProgress(options = {}) {
  const {
    percentage = 0,
    radius = 50,
    strokeWidth = 4,
    color = '#007bff',
    backgroundColor = '#e0e0e0',
    showLabel = true
  } = options;

  const size = radius * 2 + strokeWidth;
  const circumference = 2 * Math.PI * (radius - strokeWidth / 2);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.cssText = `
    transform: rotate(-90deg);
  `;

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', size / 2);
  bgCircle.setAttribute('cy', size / 2);
  bgCircle.setAttribute('r', radius - strokeWidth / 2);
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', backgroundColor);
  bgCircle.setAttribute('stroke-width', strokeWidth);

  const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progressCircle.setAttribute('cx', size / 2);
  progressCircle.setAttribute('cy', size / 2);
  progressCircle.setAttribute('r', radius - strokeWidth / 2);
  progressCircle.setAttribute('fill', 'none');
  progressCircle.setAttribute('stroke', color);
  progressCircle.setAttribute('stroke-width', strokeWidth);
  progressCircle.setAttribute('stroke-dasharray', circumference);
  progressCircle.setAttribute('stroke-linecap', 'round');

  const offset = circumference - (percentage / 100) * circumference;
  progressCircle.setAttribute('stroke-dashoffset', offset);
  progressCircle.style.cssText = `
    transition: stroke-dashoffset 0.3s ease;
  `;

  svg.appendChild(bgCircle);
  svg.appendChild(progressCircle);

  const container = document.createElement('div');
  container.className = 'circular-progress-container';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  `;

  const svgWrapper = document.createElement('div');
  svgWrapper.style.cssText = `
    position: relative;
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  svgWrapper.appendChild(svg);

  if (showLabel) {
    const label = document.createElement('div');
    label.className = 'circular-progress-label';
    label.style.cssText = `
      position: absolute;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 600;
      color: ${color};
    `;
    label.textContent = `${percentage}%`;
    svgWrapper.appendChild(label);
  }

  container.appendChild(svgWrapper);

  return {
    element: container,
    setPercentage: (newPercentage) => {
      const clamped = Math.min(100, Math.max(0, newPercentage));
      const newOffset = circumference - (clamped / 100) * circumference;
      progressCircle.setAttribute('stroke-dashoffset', newOffset);

      const labelEl = svgWrapper.querySelector('.circular-progress-label');
      if (labelEl) {
        labelEl.textContent = `${clamped}%`;
      }
    }
  };
}

export function renderProgressBar(percentage, label = '') {
  const html = `
    <div style="width: 100%; background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;">
      <div style="height: 100%; width: ${percentage}%; background: #007bff; border-radius: 4px; transition: width 0.3s;"></div>
    </div>
    <div style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; color: #666;">
      ${label || percentage + '%'}
    </div>
  `;
  return html;
}
