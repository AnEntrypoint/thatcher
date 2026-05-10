export function createStagePipeline(options = {}) {
  const {
    stages = [],
    currentStageIndex = 0,
    onStageClick = null,
    readOnly = false
  } = options;

  const container = document.createElement('div');
  container.className = 'stage-pipeline';
  container.style.cssText = `
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 8px;
    border: 1px solid #eee;
  `;

  stages.forEach((stage, idx) => {
    const isComplete = idx < currentStageIndex;
    const isCurrent = idx === currentStageIndex;
    const isUpcoming = idx > currentStageIndex;

    const stageItem = document.createElement('div');
    stageItem.className = `stage-item stage-${isComplete ? 'complete' : isCurrent ? 'current' : 'upcoming'}`;
    stageItem.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      cursor: ${!readOnly && onStageClick ? 'pointer' : 'default'};
      transition: all 0.2s;
    `;

    const circle = document.createElement('div');
    circle.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
      color: white;
      background: ${isComplete ? '#28a745' : isCurrent ? '#007bff' : '#e0e0e0'};
      border: 2px solid ${isCurrent ? '#0056b3' : 'transparent'};
      transition: all 0.2s;
    `;

    if (isComplete) {
      circle.textContent = '✓';
    } else {
      circle.textContent = idx + 1;
    }

    const label = document.createElement('div');
    label.style.cssText = `
      text-align: center;
      font-size: 0.75rem;
      font-weight: ${isCurrent ? '600' : '500'};
      color: ${isCurrent ? '#007bff' : isComplete ? '#28a745' : '#999'};
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    label.textContent = stage.label || stage.name || `Stage ${idx + 1}`;

    if (idx < stages.length - 1) {
      const connector = document.createElement('div');
      connector.style.cssText = `
        position: absolute;
        width: calc(100% / ${stages.length} - 1rem);
        height: 2px;
        top: 20px;
        left: calc(${idx * (100 / stages.length) + 50 / stages.length}%);
        background: ${isComplete || (isCurrent && idx < currentStageIndex) ? '#28a745' : '#e0e0e0'};
        transition: all 0.2s;
      `;
    }

    stageItem.appendChild(circle);
    stageItem.appendChild(label);

    if (!readOnly && onStageClick) {
      stageItem.onmouseover = () => {
        circle.style.transform = 'scale(1.1)';
      };
      stageItem.onmouseout = () => {
        circle.style.transform = 'scale(1)';
      };
      stageItem.onclick = () => {
        onStageClick(idx, stage);
      };
    }

    container.appendChild(stageItem);
  });

  return {
    element: container,
    setCurrentStage: (idx) => {
      container.querySelectorAll('.stage-item').forEach((el, i) => {
        const circle = el.querySelector('div:first-child');
        const label = el.querySelector('div:last-child');

        if (i < idx) {
          circle.style.background = '#28a745';
          circle.textContent = '✓';
          label.style.color = '#28a745';
        } else if (i === idx) {
          circle.style.background = '#007bff';
          label.style.color = '#007bff';
          label.style.fontWeight = '600';
        } else {
          circle.style.background = '#e0e0e0';
          label.style.color = '#999';
          label.style.fontWeight = '500';
        }
      });
    }
  };
}

export function renderStageSelector(stages, currentIndex, onChange) {
  const select = document.createElement('select');
  select.style.cssText = `
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  `;

  stages.forEach((stage, idx) => {
    const option = document.createElement('option');
    option.value = idx;
    option.textContent = stage.label || stage.name || `Stage ${idx + 1}`;
    if (idx === currentIndex) option.selected = true;
    select.appendChild(option);
  });

  select.onchange = () => {
    const newIdx = parseInt(select.value);
    if (onChange) onChange(newIdx, stages[newIdx]);
  };

  return select;
}
