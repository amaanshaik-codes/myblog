// Voice note player for home page
(function() {
  var audio = document.getElementById('voicenote-audio');
  var btn = document.getElementById('play-voicenote');
  var segs = Array.prototype.slice.call(document.querySelectorAll('.bio-seg'));

  function setPlayingUI(isPlaying) {
    btn.classList.toggle('playing', isPlaying);
    var glyph = btn.querySelector('.listen-glyph');
    if (glyph) glyph.textContent = isPlaying ? '❚❚' : '▶';
    btn.setAttribute('aria-label', isPlaying ? 'Pause voice note' : 'Play voice note');
  }

  function clearHighlights() {
    // Highlighting disabled (timing drift looked bad). Ensure nothing remains highlighted.
    segs.forEach(function (s) { s.classList.remove('highlight'); });
  }
  
  if (!btn || !audio) return;

  // Make sure we never start in a highlighted state.
  clearHighlights();
  
  btn.addEventListener('click', function() {
    if (audio.paused) {
      audio.play().catch(function(err) {
        console.error('Audio playback failed:', err);
        setPlayingUI(false);
      });
      setPlayingUI(true);
    } else {
      audio.pause();
      setPlayingUI(false);
      clearHighlights();
    }
  });

  audio.addEventListener('pause', function () {
    setPlayingUI(false);
  });
  
  audio.addEventListener('ended', function() {
    setPlayingUI(false);
    clearHighlights();
  });

  audio.addEventListener('error', function() {
    console.error('Audio loading failed');
    setPlayingUI(false);
    clearHighlights();
  });
})();
