(function () {
  // Load Geist fonts from local assets if present and add .fonts-loaded class when ready
  if (!('fonts' in document)) {
    // Older browsers: still safe to use CSS font-face with swap
    return;
  }

  function loadFont(name, weight) {
    try {
      return document.fonts.load((weight || '') + ' 1rem "' + name + '"');
    } catch (e) {
      return Promise.resolve();
    }
  }

  Promise.all([loadFont('Geist Sans', 400), loadFont('Geist Mono', 400)]).then(function () {
    document.documentElement.classList.add('fonts-loaded');
    console.info('Geist fonts loaded');
  }).catch(function () {
    console.info('Geist fonts did not finish loading');
  });
})();
