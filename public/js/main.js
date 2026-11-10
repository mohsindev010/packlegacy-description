// ---------------------------------------------------------------------------
// Topbar announcement slider
// ---------------------------------------------------------------------------
function initAnnouncements() {
  const textEl = document.querySelector('[data-announce-text]');
  if (!textEl) return;

  const messages = [
    'No Minimum Order Quantity',
    'Free Design Support',
    'Free Shipping on All Orders',
  ];
  let index = 0;
  let timer;

  const show = (i) => {
    index = (i + messages.length) % messages.length;
    textEl.textContent = messages[index];
  };

  const restart = () => {
    clearInterval(timer);
    timer = setInterval(() => show(index + 1), 4000);
  };

  document.querySelector('[data-announce="prev"]').addEventListener('click', () => { show(index - 1); restart(); });
  document.querySelector('[data-announce="next"]').addEventListener('click', () => { show(index + 1); restart(); });

  restart();
}

// ---------------------------------------------------------------------------
// Mobile navigation toggle
// ---------------------------------------------------------------------------
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
    nav.classList.toggle('is-open', !isOpen);
  });
}

// ---------------------------------------------------------------------------
// Quote form: upload toggle, validation, submission
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;

// Each rule returns an error message, or '' when the value is valid
const rules = {
  fullName: (v) => (v.trim().length < 2 ? 'Please enter your full name.' : ''),
  email: (v) => (!EMAIL_PATTERN.test(v.trim()) ? 'Please enter a valid email address.' : ''),
  phone: (v) => (!PHONE_PATTERN.test(v.trim()) ? 'Please enter a valid phone number.' : ''),
  quantity: (v) => (!v ? 'Please select a quantity.' : ''),
  length: (v) => dimension(v),
  width: (v) => dimension(v),
  height: (v) => dimension(v),
};

function dimension(value) {
  const n = Number(value);
  return !value || !Number.isFinite(n) || n <= 0 ? 'Required' : '';
}

function setError(field, message) {
  const errorEl = document.getElementById(`${field.id}-error`);
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (errorEl) errorEl.textContent = message;
}

function validateField(field) {
  const rule = rules[field.name];
  if (!rule) return true;
  const message = rule(field.value);
  setError(field, message);
  return !message;
}

function validateFile(input) {
  const file = input.files[0];
  let message = '';
  if (!file) message = 'Please choose a PDF file.';
  else if (file.type !== 'application/pdf') message = 'Only PDF files are allowed.';
  else if (file.size > MAX_FILE_SIZE) message = 'File must be 10 MB or smaller.';
  setError(input, message);
  return !message;
}

function initQuoteForm() {
  const form = document.querySelector('[data-quote-form]');
  if (!form) return;

  const uploadField = form.querySelector('[data-upload-field]');
  const fileInput = form.querySelector('#artwork');
  const status = form.querySelector('[data-quote-status]');
  const submitBtn = form.querySelector('[type="submit"]');

  const isUploadSelected = () => form.elements.designMethod.value === 'upload';

  // Show the file input only for "Upload PDF File"
  form.addEventListener('change', (e) => {
    if (e.target.name === 'designMethod') {
      uploadField.hidden = !isUploadSelected();
      if (!isUploadSelected()) {
        fileInput.value = '';
        setError(fileInput, '');
      }
    }
  });

  // Validate a field when the user leaves it, and re-check while they fix it
  form.addEventListener('focusout', (e) => validateField(e.target));
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.className = 'quote__status';

    // namedItem() instead of form.elements[name]: a field called "length"
    // would otherwise return the elements count, not the input
    const fields = Object.keys(rules).map((name) => form.elements.namedItem(name));
    let valid = fields.map(validateField).every(Boolean);
    if (isUploadSelected() && !validateFile(fileInput)) valid = false;

    if (!valid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      const data = await res.json().catch(() => ({}));

      // Show field errors returned by the server (e.g. if browser checks were bypassed)
      if (data.errors) {
        for (const [name, message] of Object.entries(data.errors)) {
          const field = form.elements.namedItem(name);
          if (field instanceof Element) setError(field, message);
        }
        form.querySelector('[aria-invalid="true"]')?.focus();
      }

      if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');

      form.reset();
      uploadField.hidden = true;
      status.textContent = data.message || "Thanks! We'll send your quote within 24 hours.";
      status.classList.add('is-success');
    } catch (err) {
      status.textContent = err.message;
      status.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get My Quote';
    }
  });
}

// ---------------------------------------------------------------------------
// Tabs (WAI-ARIA tabs pattern): click or use Left/Right/Home/End keys
// ---------------------------------------------------------------------------
function initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((root) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];

    const select = (tab) => {
      tabs.forEach((t) => {
        const isActive = t === tab;
        t.setAttribute('aria-selected', String(isActive));
        t.tabIndex = isActive ? 0 : -1; // only the active tab is in the Tab order
        document.getElementById(t.getAttribute('aria-controls')).hidden = !isActive;
      });
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));

      tab.addEventListener('keydown', (e) => {
        const keys = {
          ArrowRight: tabs[(i + 1) % tabs.length],
          ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
          Home: tabs[0],
          End: tabs[tabs.length - 1],
        };
        const next = keys[e.key];
        if (!next) return;
        e.preventDefault();
        select(next);
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // keep it visible in the scrollable tab bar
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Desktop scaling: lay the page out at the 1920px design width and scale it to
// the screen, so it keeps the design's exact alignment on 1366/1440/1536 screens.
// Tablet/mobile (<= 1024px) use the normal responsive CSS instead.
// ---------------------------------------------------------------------------
function initPageScale() {
  const DESIGN_WIDTH = 1920;
  const MIN_ZOOM = 0.7; // below this, text gets too small; the fluid layout takes over
  const root = document.documentElement;

  const update = () => {
    root.style.setProperty('--page-zoom', '1');
    // clientWidth excludes the scrollbar, so the scaled page never overflows sideways
    const width = root.clientWidth;
    const zoom = width > 1024 ? Math.min(1, Math.max(MIN_ZOOM, width / DESIGN_WIDTH)) : 1;
    root.style.setProperty('--page-zoom', String(zoom));
  };

  update();
  let frame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  });
}

initPageScale();
initAnnouncements();
initMobileNav();
initQuoteForm();
initTabs();
