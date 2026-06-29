// Mobile nav toggle
document.addEventListener('click', function (e) {
  var toggle = e.target.closest('.nav-toggle');
  if (toggle) {
    toggle.closest('.nav').classList.toggle('open');
  }
});

// Dojo region tabs
document.querySelectorAll('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    var region = tab.getAttribute('data-region');
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    tab.classList.add('active');
    document.querySelectorAll('.dojo-group').forEach(function (g) {
      g.classList.toggle('active', g.getAttribute('data-region') === region);
    });
  });
});
