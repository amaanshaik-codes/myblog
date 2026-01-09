// Tooltip positioning for stamp avatar - moved to external file
(function() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  
  document.addEventListener('DOMContentLoaded', function() {
    const stampWrapper = document.querySelector('.stamp-wrapper');
    const tooltip = document.querySelector('.terminal-tooltip');
    const stamp = document.querySelector('.stamp');
    
    if (!stampWrapper || !tooltip || !stamp) return;
    
    const stampRadius = stamp.offsetWidth / 2;
    const tooltipOffset = 20;
    const padding = 8; // Viewport padding
    
    stampWrapper.addEventListener('mousemove', function(e) {
      const rect = stamp.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      
      let tooltipX, tooltipY;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          tooltipX = rect.width + tooltipOffset;
          tooltipY = (rect.height / 2) + (dy * 0.3);
        } else {
          tooltipX = -tooltip.offsetWidth - tooltipOffset;
          tooltipY = (rect.height / 2) + (dy * 0.3);
        }
      } else {
        if (dy > 0) {
          tooltipX = (rect.width / 2) - (tooltip.offsetWidth / 2) + (dx * 0.3);
          tooltipY = rect.height + tooltipOffset;
        } else {
          tooltipX = (rect.width / 2) - (tooltip.offsetWidth / 2) + (dx * 0.3);
          tooltipY = -tooltip.offsetHeight - tooltipOffset;
        }
      }
      
      // Constrain to viewport
      const tooltipRect = tooltip.getBoundingClientRect();
      const absX = rect.left + tooltipX;
      const absY = rect.top + tooltipY;
      
      // Clamp to viewport bounds
      if (absX + tooltip.offsetWidth + padding > window.innerWidth) {
        tooltipX = window.innerWidth - rect.left - tooltip.offsetWidth - padding;
      }
      if (absX < padding) {
        tooltipX = padding - rect.left;
      }
      if (absY + tooltip.offsetHeight + padding > window.innerHeight) {
        tooltipY = window.innerHeight - rect.top - tooltip.offsetHeight - padding;
      }
      if (absY < padding) {
        tooltipY = padding - rect.top;
      }
      
      tooltip.style.left = tooltipX + 'px';
      tooltip.style.top = tooltipY + 'px';
      tooltip.style.transform = 'none';
    });
    
    stampWrapper.addEventListener('mouseleave', function() {
      tooltip.style.left = '';
      tooltip.style.top = '';
      tooltip.style.transform = '';
    });
  });
})();
