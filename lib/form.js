// The whole application form is described here once.
// The public form, the review page and the CSV export are all drawn from it,
// so adding or rewording a question means editing this file only.

const MAX_LEN = 2000;

function residence(prefix, title, required) {
  return {
    type: 'group',
    title,
    fields: [
      { name: `${prefix}_address`, label: 'Street address', required, autocomplete: required ? 'street-address' : 'off' },
      { name: `${prefix}_city`, label: 'City, state, ZIP', required },
      { name: `${prefix}_dates`, label: 'Dates lived there', hint: 'For example, June 2023 to present', half: true },
      { name: `${prefix}_tenure`, label: 'Own or rent?', type: 'select', options: ['Rent', 'Own', 'Other'], half: true },
      { name: `${prefix}_payment`, label: 'Monthly rent or mortgage', type: 'money', half: true },
      { name: `${prefix}_landlord`, label: 'Landlord or manager name', half: true },
      { name: `${prefix}_landlord_contact`, label: 'Landlord phone and email' },
      { name: `${prefix}_reason`, label: 'Reason for leaving' },
    ],
  };
}

function employer(prefix, title) {
  return {
    type: 'group',
    title,
    fields: [
      { name: `${prefix}_name`, label: 'Employer or business name', half: true },
      { name: `${prefix}_position`, label: 'Position', half: true },
      { name: `${prefix}_address`, label: 'Employer address' },
      { name: `${prefix}_dates`, label: 'Dates employed', hint: 'For example, March 2021 to present', half: true },
      { name: `${prefix}_income`, label: 'Gross monthly income', type: 'money', half: true },
      { name: `${prefix}_contact_name`, label: 'Supervisor or HR contact', half: true },
      { name: `${prefix}_contact`, label: 'Contact phone and email', half: true },
    ],
  };
}

function yesNo(name, label, { noLabel = 'No', explainRequired = true } = {}) {
  return { name, label, type: 'yesno', required: true, noLabel, explain: `${name}_explain`, explainRequired };
}

function buildSections(property) {
  return [
    {
      id: 'lease',
      title: 'Move-in details',
      blocks: [
        {
          type: 'group',
          fields: [
            { name: 'move_in_date', label: 'Desired move-in date', type: 'date', required: true, half: true },
            { name: 'lease_term', label: 'Desired lease term', type: 'select', options: ['12 months', 'Other'], required: true, half: true },
            { name: 'lease_term_other', label: 'If other, how long?', showWhen: { field: 'lease_term', equals: 'Other' } },
          ],
        },
      ],
    },
    {
      id: 'applicant',
      title: 'About you',
      blocks: [
        {
          type: 'group',
          fields: [
            { name: 'full_name', label: 'Full legal name', required: true, autocomplete: 'name' },
            { name: 'other_names', label: 'Other names used in the past 7 years' },
            { name: 'phone', label: 'Mobile phone', type: 'tel', required: true, autocomplete: 'tel', half: true },
            { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email', half: true },
            { name: 'id_type', label: 'Photo ID type and issuing state', hint: 'You will show it at lease signing. For example, Massachusetts driver’s license.', half: true },
            { name: 'best_time', label: 'Best time to reach you', half: true },
          ],
        },
        {
          type: 'note',
          text: 'There is no need to give your Social Security number here. If a credit or background check is run, you enter it yourself through the screening service.',
        },
        {
          type: 'repeat',
          name: 'occupants',
          title: 'Everyone else who will live in the unit',
          rowLabel: 'Person',
          rows: 4,
          fields: [
            { name: 'name', label: 'Full name', half: true },
            { name: 'adult', label: 'Adult (18 or older)?', type: 'select', options: ['Yes', 'No'], half: true },
          ],
        },
      ],
    },
    {
      id: 'residence',
      title: 'Where you have lived',
      intro: 'Cover the past 3 years, starting with where you live now.',
      blocks: [
        residence('cur', 'Current residence', true),
        residence('prev', 'Previous residence', false),
      ],
    },
    {
      id: 'income',
      title: 'Work and income',
      blocks: [
        employer('emp', 'Current employer'),
        employer('prev_emp', 'Previous employer, if under 2 years at your current one'),
        {
          type: 'repeat',
          name: 'other_income',
          title: 'Other income you would like considered',
          intro: 'All lawful, verifiable income counts, including self-employment, retirement, Social Security, child support, and rental assistance or housing vouchers.',
          rowLabel: 'Source',
          rows: 2,
          fields: [
            { name: 'source', label: 'Source', half: true },
            { name: 'amount', label: 'Monthly amount', type: 'money', half: true },
          ],
        },
        {
          type: 'files',
          name: 'proof',
          title: 'Proof of income',
          intro: 'Attach your two most recent pay stubs. If you are self-employed, attach your most recent tax return or two months of bank statements. A benefit or voucher award letter also works.',
        },
      ],
    },
    {
      id: 'references',
      title: 'References, vehicles and pets',
      blocks: [
        {
          type: 'repeat',
          name: 'refs',
          title: 'Personal references',
          intro: 'Two people who know you and are not relatives.',
          rowLabel: 'Reference',
          rows: 2,
          fields: [
            { name: 'name', label: 'Name', half: true },
            { name: 'relation', label: 'How they know you', half: true },
            { name: 'phone', label: 'Phone', type: 'tel', half: true },
            { name: 'email', label: 'Email', type: 'email', half: true },
          ],
        },
        {
          type: 'group',
          title: 'Emergency contact',
          fields: [
            { name: 'emergency_name', label: 'Name', half: true },
            { name: 'emergency_relation', label: 'Relationship', half: true },
            { name: 'emergency_phone', label: 'Phone', type: 'tel', half: true },
          ],
        },
        {
          type: 'repeat',
          name: 'vehicles',
          title: 'Vehicles to be kept at the property',
          rowLabel: 'Vehicle',
          rows: 2,
          fields: [
            { name: 'make_model', label: 'Make and model', half: true },
            { name: 'year', label: 'Year', half: true },
            { name: 'color', label: 'Color', half: true },
            { name: 'plate', label: 'Plate and state', half: true },
          ],
        },
        {
          type: 'repeat',
          name: 'pets',
          title: 'Pets',
          intro: `Pets need the owner’s approval and must follow the ${property.name} condominium rules. Service and assistance animals are not pets and do not need to be listed.`,
          rowLabel: 'Pet',
          rows: 2,
          fields: [
            { name: 'type', label: 'Type and breed', half: true },
            { name: 'weight', label: 'Weight', half: true },
            { name: 'age', label: 'Age', half: true },
          ],
        },
      ],
    },
    {
      id: 'background',
      title: 'Background questions',
      blocks: [
        {
          type: 'group',
          fields: [
            yesNo('q_eviction', 'Have you ever been a party to an eviction case?', { noLabel: 'No, or no record' }),
          ],
        },
        {
          type: 'note',
          legal: true,
          text: 'An applicant for housing or credit with a sealed record on file with the court pursuant to section 16 of chapter 239 of the General Laws may answer ‘no record’ to an inquiry relative to that sealed court record.',
        },
        {
          type: 'group',
          fields: [
            yesNo('q_owe', 'Do you currently owe money to a current or former landlord?'),
            yesNo('q_bankruptcy', 'Have you filed for bankruptcy in the past 7 years?'),
            yesNo('q_smoke', 'Will anyone in the household smoke or vape?', { explainRequired: false }),
            { name: 'anything_else', label: 'Is there anything else you would like the owner to know?', type: 'textarea' },
          ],
        },
      ],
    },
  ];
}

const AGREEMENTS = (property) => [
  'The information in this application is true and complete. False or missing information may be grounds to decline the application or end a tenancy.',
  'The owner or the owner’s agent may verify this information by contacting my current and former landlords, employers and references.',
  'The owner or the owner’s agent may obtain a consumer credit report and tenant screening report about me, as permitted by law, for the purpose of evaluating this application.',
  'This application is not a lease and does not reserve the unit. No fee is charged to apply, and no money is due until a lease is signed.',
  `Any tenancy is subject to the ${property.name} condominium documents and rules, which I agree to follow.`,
  'Typing my name below counts as my signature.',
];

const FAIR_HOUSING =
  'Equal housing opportunity. Applications are considered without regard to race, color, religion, national origin, ancestry, sex, sexual orientation, gender identity, age, marital status, familial status, veteran or military status, disability, genetic information, source of income (including public or rental assistance), or any other basis protected by federal or Massachusetts law.';

function str(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n/g, '\n').trim().slice(0, MAX_LEN);
}

// Keep only the questions we asked, trimmed. Anything else in the request is dropped.
function clean(body, sections) {
  const data = {};
  for (const section of sections) {
    for (const block of section.blocks) {
      if (block.type === 'group') {
        for (const f of block.fields) {
          data[f.name] = str(body[f.name]);
          if (f.explain) data[f.explain] = str(body[f.explain]);
        }
      } else if (block.type === 'repeat') {
        const rows = Array.isArray(body[block.name])
          ? body[block.name]
          : body[block.name] && typeof body[block.name] === 'object'
            ? Object.values(body[block.name])
            : [];
        data[block.name] = [];
        for (let i = 0; i < block.rows; i++) {
          const src = rows[i] && typeof rows[i] === 'object' ? rows[i] : {};
          const row = {};
          for (const f of block.fields) row[f.name] = str(src[f.name]);
          data[block.name].push(row);
        }
      }
    }
  }
  data.agree = body.agree === 'yes' ? 'yes' : '';
  data.signature = str(body.signature);
  return data;
}

function rowIsEmpty(block, row) {
  // A select left on its default does not make a row "filled in".
  return block.fields.every((f) => f.type === 'select' || !row[f.name]);
}

function validate(data, sections) {
  const errors = {};
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  for (const section of sections) {
    for (const block of section.blocks) {
      if (block.type !== 'group') continue;
      for (const f of block.fields) {
        const v = data[f.name];
        if (f.required && !v) {
          errors[f.name] = f.type === 'yesno' ? 'Choose an answer.' : `Enter ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}.`;
          continue;
        }
        if (v && f.type === 'email' && !emailOk(v)) errors[f.name] = 'Enter an email address like name@example.com.';
        if (v && f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[f.name] = 'Pick a date.';
        if (v && f.type === 'select' && !f.options.includes(v)) errors[f.name] = 'Choose one of the options.';
        if (v && f.type === 'yesno' && !['Yes', 'No'].includes(v)) errors[f.name] = 'Choose an answer.';
        if (f.type === 'yesno' && v === 'Yes' && f.explainRequired && !data[f.explain]) {
          errors[f.explain] = 'Add a short explanation.';
        }
      }
    }
  }
  if (!data.agree) errors.agree = 'Check the box to confirm.';
  if (!data.signature) errors.signature = 'Type your full name to sign.';
  return errors;
}

function monthlyIncome(data) {
  const num = (v) => {
    const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  let total = num(data.emp_income);
  for (const row of data.other_income || []) total += num(row.amount);
  return total;
}

// One flat row per application, for the spreadsheet export.
function flatten(data, sections) {
  const out = [];
  for (const section of sections) {
    for (const block of section.blocks) {
      if (block.type === 'group') {
        for (const f of block.fields) {
          const title = block.title ? `${block.title}: ${f.label}` : f.label;
          let value = data[f.name] || '';
          if (f.type === 'yesno' && f.noLabel !== 'No' && value === 'No') value = f.noLabel;
          out.push([title, value]);
          if (f.explain) out.push([`${f.label} (explanation)`, data[f.explain] || '']);
        }
      } else if (block.type === 'repeat') {
        const rows = (data[block.name] || []).filter((r) => !rowIsEmpty(block, r));
        out.push([
          block.title,
          rows.map((r) => block.fields.map((f) => r[f.name]).filter(Boolean).join(', ')).join(' | '),
        ]);
      }
    }
  }
  out.push(['Signed as', data.signature || '']);
  return out;
}

module.exports = { buildSections, AGREEMENTS, FAIR_HOUSING, clean, validate, rowIsEmpty, monthlyIncome, flatten };
