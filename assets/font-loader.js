(function () {
  // Load Libertinus and JetBrains Mono fonts from Google Fonts
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

  Promise.all([
    loadFont('Libertinus Serif', '400'),
    loadFont('JetBrains Mono', '400')
  ]).then(function () {
    document.documentElement.classList.add('fonts-loaded');
    console.info('Custom fonts loaded');
  }).catch(function () {
    console.info('Custom fonts did not finish loading');
  });
})();
