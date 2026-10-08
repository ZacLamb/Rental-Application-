(function () {
  // Show follow-up fields only when the answer that calls for them is chosen.
  var conditional = document.querySelectorAll('[data-show-when]');
  function currentValue(name) {
    var inputs = document.getElementsByName(name);
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.type === 'radio') {
        if (el.checked) return el.value;
      } else {
        return el.value;
      }
    }
    return '';
  }
  function refresh() {
    conditional.forEach(function (box) {
      var show = currentValue(box.getAttribute('data-show-when')) === box.getAttribute('data-show-equals');
      box.hidden = !show;
      box.querySelectorAll('[data-required-when-shown]').forEach(function (el) {
        el.required = show;
      });
    });
  }
  if (conditional.length) {
    document.addEventListener('change', refresh);
    refresh();
  }

  // Catch oversized or too many files before the form is sent.
  var fileInput = document.querySelector('input[type="file"][data-max-mb]');
  if (fileInput) {
    var fileError = document.getElementById(fileInput.id + '-err');
    var checkFiles = function () {
      var maxMb = Number(fileInput.getAttribute('data-max-mb'));
      var maxFiles = Number(fileInput.getAttribute('data-max-files'));
      var message = '';
      if (fileInput.files.length > maxFiles) {
        message = 'Attach up to ' + maxFiles + ' files.';
      } else {
        for (var i = 0; i < fileInput.files.length; i++) {
          if (fileInput.files[i].size > maxMb * 1024 * 1024) {
            message = fileInput.files[i].name + ' is larger than ' + maxMb + ' MB. Attach a smaller copy.';
            break;
          }
        }
      }
      fileInput.setCustomValidity(message);
      fileError.textContent = message;
      fileError.hidden = !message;
      return !message;
    };
    fileInput.addEventListener('change', checkFiles);
  }

  // Stop a double tap from sending the application twice.
  var form = document.getElementById('application');
  if (form) {
    form.addEventListener('submit', function () {
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Sending application';
    });
  }

  var notice = document.getElementById('notice');
  if (notice) {
    var firstError = document.querySelector('.field-error input, .field-error select, .field-error textarea');
    (firstError || notice).focus();
    (firstError || notice).scrollIntoView({ block: 'center' });
  }

  // Mark the section being filled in, in the side list.
  var links = document.querySelectorAll('.rail a');
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) {
      byId[a.getAttribute('href').slice(1)] = a;
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            a.removeAttribute('aria-current');
          });
          byId[entry.target.id].setAttribute('aria-current', 'step');
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    document.querySelectorAll('.step').forEach(function (s) {
      observer.observe(s);
    });
  }

  // Review pages
  document.querySelectorAll('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () {
      el.form.submit();
    });
  });
  document.querySelectorAll('[data-print]').forEach(function (el) {
    el.addEventListener('click', function () {
      window.print();
    });
  });
})();
