const SUBMIT_EMAIL = 'queencityconnect674@gmail.com';

let lastSubmission = null;

function buildSubmissionPayload() {
  return {
    submittedAt: new Date().toISOString(),
    organization: {
      name: document.getElementById('org-name')?.value.trim() || '',
      category: document.getElementById('org-category')?.value.trim() || '',
      phone: document.getElementById('org-phone')?.value.trim() || '',
      website: document.getElementById('org-website')?.value.trim() || '',
      address: document.getElementById('org-address')?.value.trim() || '',
      hours: document.getElementById('org-hours')?.value.trim() || '',
      serviceArea: document.getElementById('org-area')?.value.trim() || '',
      description: document.getElementById('org-description')?.value.trim() || ''
    },
    submitter: {
      name: document.getElementById('submitter-name')?.value.trim() || '',
      email: document.getElementById('submitter-email')?.value.trim() || '',
      role: document.getElementById('submitter-role')?.value.trim() || ''
    }
  };
}

function saveSubmission(payload) {
  if (window.QCCAuth && typeof QCCAuth.appendSubmission === 'function') {
    QCCAuth.appendSubmission(payload);
    return;
  }
  const existing = JSON.parse(localStorage.getItem('clt-submissions') || '[]');
  existing.push(payload);
  localStorage.setItem('clt-submissions', JSON.stringify(existing));
}

function emailFields(payload) {
  const org = payload.organization;
  const person = payload.submitter;
  return {
    _subject: `New QueenCityConnect resource: ${org.name}`,
    _template: 'table',
    _captcha: 'false',
    name: person.name,
    email: person.email || SUBMIT_EMAIL,
    'Organization Name': org.name,
    Category: org.category,
    Phone: org.phone,
    Website: org.website || 'Not provided',
    Address: org.address || 'Not provided',
    Hours: org.hours || 'Not provided',
    'Service Area': org.serviceArea || 'Not provided',
    Description: org.description,
    'Submitted By': person.name,
    'Submitter Email': person.email || 'Not provided',
    'Connection to Organization': person.role || 'Not provided',
    'Submitted At': payload.submittedAt
  };
}

async function sendSubmissionEmail(payload) {
  const response = await fetch(`https://formsubmit.co/ajax/${SUBMIT_EMAIL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(emailFields(payload))
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || String(data.success) === 'false') {
    const msg = String(data.message || '');
    if (msg.toLowerCase().includes('activation')) {
      throw new Error(
        'Check ' + SUBMIT_EMAIL + ' for an email from FormSubmit and click Activate Form. After that, submissions will arrive in the inbox.'
      );
    }
    throw new Error(msg || 'Email could not be sent.');
  }
}

function setSubmitBusy(busy) {
  const btn = document.getElementById('submit-resource-btn');
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? 'Sending...' : 'Submit Resource';
}

function showSubmitError(message) {
  const err = document.getElementById('submit-send-error');
  if (err) err.textContent = message || '';
}

function showSuccess() {
  const form = document.getElementById('submit-form');
  const success = document.getElementById('success-message');
  form.classList.add('hidden');
  success.classList.remove('hidden');
  window.scrollTo({
    top: success.getBoundingClientRect().top + window.scrollY - 120,
    behavior: 'smooth'
  });
}

async function submitForm() {
  let valid = true;
  showSubmitError('');

  ['org-name','org-category','org-phone','submitter-name','org-description'].forEach(id => {
    const err = document.getElementById('err-' + id);
    const el = document.getElementById(id);
    if (err) err.textContent = '';
    if (el) el.classList.remove('input-error');
  });

  const required = [
    { id: 'org-name',        err: 'err-org-name',        msg: 'Organization name is required.' },
    { id: 'org-category',    err: 'err-org-category',    msg: 'Please select a category.' },
    { id: 'org-phone',       err: 'err-org-phone',       msg: 'Phone number is required.' },
    { id: 'submitter-name',  err: 'err-submitter-name',  msg: 'Your name is required.' },
    { id: 'org-description', err: 'err-org-description', msg: 'A description is required.' }
  ];

  required.forEach(f => {
    const el = document.getElementById(f.id);
    const errEl = document.getElementById(f.err);
    if (!el || !el.value.trim()) {
      if (errEl) errEl.textContent = f.msg;
      if (el) el.classList.add('input-error');
      valid = false;
    }
  });

  const phone = document.getElementById('org-phone');
  if (phone && phone.value.trim() && !/^[\d\s\(\)\-\+\.]{7,}$/.test(phone.value.trim())) {
    const errPhone = document.getElementById('err-org-phone');
    if (errPhone) errPhone.textContent = 'Please enter a valid phone number.';
    phone.classList.add('input-error');
    valid = false;
  }

  const honeypot = document.getElementById('honeypot');
  if (honeypot && honeypot.value.trim()) {
    showSuccess();
    return;
  }

  if (!valid) {
    const firstError = document.querySelector('.input-error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const payload = buildSubmissionPayload();
  saveSubmission(payload);
  lastSubmission = payload;

  setSubmitBusy(true);
  try {
    await sendSubmissionEmail(payload);
    showSuccess();
  } catch (e) {
    showSubmitError(
      (e && e.message) ||
      ('We could not email this submission. Please try again, or send the details directly to ' + SUBMIT_EMAIL + '.')
    );
    console.error('Resource email failed', e);
  } finally {
    setSubmitBusy(false);
  }
}

function downloadLastSubmission() {
  if (!lastSubmission) return;
  const blob = new Blob([JSON.stringify(lastSubmission, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (lastSubmission.organization.name || 'resource-submission')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = `${name || 'resource-submission'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetForm() {
  const form = document.getElementById('submit-form');
  const success = document.getElementById('success-message');
  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.value = '';
    el.classList.remove('input-error');
  });
  form.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
  showSubmitError('');
  form.classList.remove('hidden');
  success.classList.add('hidden');
  const panel = document.getElementById('hub-submit');
  if (panel) {
    openHubSubmit(true);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openHubSubmit(open) {
  const panel = document.getElementById('hub-submit');
  const toggle = document.getElementById('hub-submit-toggle');
  const body = document.getElementById('hub-submit-body');
  if (!panel || !toggle || !body) return;
  const shouldOpen = open === undefined ? !panel.classList.contains('is-open') : !!open;
  panel.classList.toggle('is-open', shouldOpen);
  toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  body.hidden = !shouldOpen;
}

function toggleHubSubmit() {
  openHubSubmit();
}

document.addEventListener('DOMContentLoaded', function() {
  ['org-name','org-category','org-phone','submitter-name','org-description'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', function() {
      if (this.value.trim()) {
        this.classList.remove('input-error');
        const err = document.getElementById('err-' + id);
        if (err) err.textContent = '';
      }
    });
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('submit') === '1' || window.location.hash === '#submit') {
    openHubSubmit(true);
  }
});
