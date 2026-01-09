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
    segs.forEach(function (s) { s.classList.remove('highlight'); });
  }

  function syncHighlights() {
    var t = audio.currentTime || 0;
    segs.forEach(function (s) {
      var start = Number(s.getAttribute('data-start')) || 0;
      var end = Number(s.getAttribute('data-end')) || 0;
      var on = t >= start && t < end;
      s.classList.toggle('highlight', on);
    });
  }
  
  if (!btn || !audio) return;
  
  btn.addEventListener('click', function() {
    if (audio.paused) {
      audio.play().catch(function(err) {
        console.error('Audio playback failed:', err);
        setPlayingUI(false);
      });
      setPlayingUI(true);
      syncHighlights();
    } else {
      audio.pause();
      setPlayingUI(false);
      clearHighlights();
    }
  });

  audio.addEventListener('timeupdate', function () {
    if (!audio.paused) syncHighlights();
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
