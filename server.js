const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieSession = require('cookie-session');
const multer = require('multer');

const db = require('./lib/db');
const form = require('./lib/form');
const { buildPdf } = require('./lib/pdf');

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const STATUSES = ['New', 'Reviewing', 'Approved', 'Declined'];
const MAX_FILES = 5;
const MAX_FILE_MB = 8;
const FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif', '.heic'],
  'image/webp': ['.webp'],
};

const dollars = (v, fallback) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
const rent = dollars(process.env.MONTHLY_RENT, 3200);
const property = {
  name: process.env.PROPERTY_NAME || 'Deer Crossing',
  address: process.env.PROPERTY_ADDRESS || 'Deer Crossing condominium, Mashpee, MA 02649',
  rent,
  lastMonth: Math.min(dollars(process.env.LAST_MONTH_RENT, rent), rent),
  deposit: Math.min(dollars(process.env.SECURITY_DEPOSIT, rent), rent),
  contactEmail: process.env.CONTACT_EMAIL || '',
};
const sections = form.buildSections(property);
const agreements = form.AGREEMENTS(property);

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
  })
);
// Applications are private paperwork, so keep every page out of search engines.
app.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: IS_PROD ? '1h' : 0 }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')],
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 12 * 60 * 60 * 1000,
  })
);

const money = (n) => {
  const whole = Number.isInteger(Number(n));
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
};
const day = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  if (!m) return v || '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'medium' });
};
const fileSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const when = (d) =>
  new Date(d).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
app.locals.property = property;
app.locals.money = money;
app.locals.when = when;
app.locals.day = day;
app.locals.fileSize = fileSize;
app.locals.rowIsEmpty = form.rowIsEmpty;
app.locals.MAX_FILES = MAX_FILES;
app.locals.MAX_FILE_MB = MAX_FILE_MB;

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ---------- Public form ----------

function renderForm(res, { data = {}, errors = {}, notice = '' } = {}, status = 200) {
  res.status(status).render('apply', {
    sections,
    agreements,
    fairHousing: form.FAIR_HOUSING,
    data,
    errors,
    notice,
  });
}

app.get('/', (req, res) => renderForm(res));

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    renderForm(res, { notice: 'Too many applications were sent from this connection. Wait an hour and send it again.' }, 429),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_FILES, fields: 300, fieldSize: 20 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = FILE_TYPES[file.mimetype];
    if (allowed && allowed.includes(ext)) return cb(null, true);
    req.rejectedFiles = (req.rejectedFiles || []).concat(file.originalname || 'a file');
    cb(null, false);
  },
});

function receiveForm(req, res, next) {
  upload.array('proof', MAX_FILES)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') req.uploadError = `One of the files is larger than ${MAX_FILE_MB} MB. Attach a smaller copy.`;
      else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') req.uploadError = `Attach up to ${MAX_FILES} files.`;
      else req.uploadError = 'The upload did not go through. Attach the files and send it again.';
    }
    next();
  });
}

async function notify(id, data) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Contact details only. The full application stays in the review page.
      body: JSON.stringify({
        event: 'application.submitted',
        application_id: id,
        property: property.name,
        name: data.full_name,
        email: data.email,
        phone: data.phone,
        move_in_date: data.move_in_date,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('Notification webhook failed:', err.message);
  }
}

app.post(
  '/apply',
  submitLimiter,
  receiveForm,
  wrap(async (req, res) => {
    const body = req.body || {};
    // Hidden field that people never see. Bots fill it in; we quietly drop those.
    if (body.website) return res.redirect(303, '/thanks');

    const data = form.clean(body, sections);
    const errors = form.validate(data, sections);
    if (req.uploadError) errors.proof = req.uploadError;
    if (req.rejectedFiles) errors.proof = `${req.rejectedFiles.join(', ')} could not be attached. Use PDF, JPG, PNG or HEIC files.`;

    if (Object.keys(errors).length) {
      const count = Object.keys(errors).length;
      const hadFiles = (req.files || []).length > 0;
      return renderForm(
        res,
        {
          data,
          errors,
          notice:
            `${count === 1 ? 'One answer needs' : `${count} answers need`} a fix before this can be sent.` +
            (hadFiles ? ' Attach your proof of income files again before sending.' : ''),
        },
        422
      );
    }

    data.signed_at = new Date().toISOString();
    const files = (req.files || []).map((f) => ({
      filename: path.basename(Buffer.from(f.originalname, 'latin1').toString('utf8')).slice(0, 200),
      mimetype: f.mimetype,
      size: f.size,
      buffer: f.buffer,
    }));
    const id = await db.createApplication({
      data,
      ip: req.ip,
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
      files,
    });
    notify(id, data);
    res.redirect(303, '/thanks');
  })
);

app.get('/thanks', (req, res) => res.render('thanks'));
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---------- Private review pages ----------

const admin = express.Router();
admin.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('admin-login', { error: 'Too many tries. Wait 15 minutes and sign in again.' }),
});

admin.get('/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.render('admin-login', {
    error: ADMIN_PASSWORD ? '' : 'Set the ADMIN_PASSWORD variable in Railway, then reload this page.',
  });
});

admin.post('/login', loginLimiter, (req, res) => {
  if (!ADMIN_PASSWORD) return res.redirect('/admin/login');
  if (!safeEqual(req.body.password || '', ADMIN_PASSWORD)) {
    return res.status(401).render('admin-login', { error: 'That password did not match.' });
  }
  req.session.admin = true;
  req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.redirect('/admin');
});

admin.use((req, res, next) => {
  if (!ADMIN_PASSWORD || !req.session || !req.session.admin) return res.redirect('/admin/login');
  res.locals.csrf = req.session.csrf;
  if (req.method === 'POST' && !safeEqual(req.body._csrf || '', req.session.csrf || 'x')) {
    return res.status(403).send('This page expired. Go back, reload and try again.');
  }
  next();
});

admin.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

admin.get(
  '/',
  wrap(async (req, res) => {
    const applications = (await db.listApplications()).map((a) => ({
      ...a,
      income: form.monthlyIncome(a.data),
    }));
    res.render('admin-list', { applications, STATUSES });
  })
);

admin.get(
  '/applications/:id',
  wrap(async (req, res, next) => {
    if (!isUuid(req.params.id)) return next();
    const application = await db.getApplication(req.params.id);
    if (!application) return next();
    res.render('admin-detail', {
      application,
      sections,
      agreements,
      STATUSES,
      income: form.monthlyIncome(application.data),
    });
  })
);

const pdfContext = { property, sections, agreements, money, day, when, fileSize, rowIsEmpty: form.rowIsEmpty };
const safeName = (v) => String(v).replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 80) || 'applicant';
function sendPdf(res, filename, applications) {
  res.set('Content-Type', 'application/pdf');
  res.set(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  buildPdf(applications, pdfContext, res);
}

admin.get(
  '/applications/:id/pdf',
  wrap(async (req, res, next) => {
    if (!isUuid(req.params.id)) return next();
    const application = await db.getApplication(req.params.id);
    if (!application) return next();
    sendPdf(res, `Rental application - ${safeName(application.full_name)}.pdf`, [application]);
  })
);

admin.get(
  '/applications.pdf',
  wrap(async (req, res) => {
    const applications = await db.listApplicationsWithFiles();
    if (!applications.length) return res.redirect('/admin');
    sendPdf(res, `Rental applications - ${safeName(property.name)}.pdf`, applications);
  })
);

admin.post(
  '/applications/:id/status',
  wrap(async (req, res, next) => {
    if (!isUuid(req.params.id) || !STATUSES.includes(req.body.status)) return next();
    await db.setStatus(req.params.id, req.body.status);
    res.redirect(303, req.body.back === 'list' ? '/admin' : `/admin/applications/${req.params.id}`);
  })
);

admin.post(
  '/applications/:id/delete',
  wrap(async (req, res, next) => {
    if (!isUuid(req.params.id)) return next();
    await db.deleteApplication(req.params.id);
    res.redirect(303, '/admin');
  })
);

admin.get(
  '/files/:id',
  wrap(async (req, res, next) => {
    if (!isUuid(req.params.id)) return next();
    const file = await db.getFile(req.params.id);
    if (!file) return next();
    res.set('Content-Type', file.mimetype);
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.send(file.content);
  })
);

admin.get(
  '/export.csv',
  wrap(async (req, res) => {
    const applications = await db.listApplications();
    const cell = (v) => {
      let s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
      // Stops spreadsheet apps from treating an answer as a formula.
      if (/^[=+\-@\t]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ['Submitted', 'Status', ...form.flatten({}, sections).map(([label]) => label), 'Files attached'];
    const lines = [header.map(cell).join(',')];
    for (const a of applications) {
      lines.push(
        [when(a.created_at), a.status, ...form.flatten(a.data, sections).map(([, value]) => value), a.file_count]
          .map(cell)
          .join(',')
      );
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="rental-applications.csv"');
    res.send('﻿' + lines.join('\r\n'));
  })
);

app.use('/admin', admin);

app.use((req, res) => res.status(404).render('message', { title: 'Page not found', body: 'That page does not exist.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('message', {
    title: 'Something went wrong',
    body: 'That did not go through. Go back and try again in a minute.',
  });
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Rental application running on port ${PORT}`);
      if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD is not set. The review page is locked until it is.');
    });
  })
  .catch((err) => {
    console.error('Could not connect to the database. Check DATABASE_URL.', err.message);
    process.exit(1);
  });
