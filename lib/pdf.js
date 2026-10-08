// Builds the PDF copy of one or more applications for the review page.

const path = require('path');
const PDFDocument = require('pdfkit');

const fontDir = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT = path.join(fontDir, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(fontDir, 'DejaVuSans-Bold.ttf');

const INK = '#12282c';
const MUTED = '#51666b';
const LINE = '#c5d1d3';
const ACCENT = '#8a1c3c';
const MARGIN = 54;
const FOOTER_SPACE = 30;
const LABEL_WIDTH = 190;
const GUTTER = 14;

function buildPdf(applications, ctx, out) {
  const { property, sections, agreements, money, day, when, fileSize, rowIsEmpty } = ctx;
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN + FOOTER_SPACE },
    bufferPages: true,
    info: {
      Title:
        applications.length === 1
          ? `Rental application - ${applications[0].full_name}`
          : `Rental applications - ${property.name}`,
    },
  });
  doc.registerFont('body', FONT);
  doc.registerFont('bold', FONT_BOLD);
  doc.pipe(out);

  const width = doc.page.width - MARGIN * 2;
  const valueWidth = width - LABEL_WIDTH - GUTTER;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const pageOwner = [];
  let owner = '';
  doc.on('pageAdded', () => pageOwner.push(owner));

  const room = (height) => {
    if (doc.y + height > bottom()) doc.addPage();
  };

  const sectionTitle = (text) => {
    room(170);
    doc.moveDown(1.1);
    doc.font('bold').fontSize(13).fillColor(INK).text(text, MARGIN, doc.y, { width });
    const y = doc.y + 3;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(1.5).strokeColor(INK).stroke();
    doc.y = y + 8;
  };

  const subTitle = (text) => {
    // Leave room for the first answer too, so a heading never sits alone at the foot of a page.
    room(100);
    doc.moveDown(0.5);
    doc.font('bold').fontSize(10).fillColor(MUTED).text(text, MARGIN, doc.y, { width });
    doc.moveDown(0.3);
  };

  // One answer: the question on the left, the answer on the right, with an
  // optional explanation under the answer.
  const row = (label, value, { flag = false, detail = '' } = {}) => {
    const shown = value || '—';
    const valueX = MARGIN + LABEL_WIDTH + GUTTER;
    doc.font('body').fontSize(9);
    const labelHeight = doc.heightOfString(label, { width: LABEL_WIDTH });
    doc.font(flag ? 'bold' : 'body').fontSize(10);
    const valueHeight = doc.heightOfString(shown, { width: valueWidth });
    doc.font('body').fontSize(10);
    const detailHeight = detail ? doc.heightOfString(detail, { width: valueWidth }) + 2 : 0;
    const height = Math.max(labelHeight, valueHeight + detailHeight);
    room(height + 8);
    const y = doc.y;
    doc.font('body').fontSize(9).fillColor(MUTED).text(label, MARGIN, y + 1, { width: LABEL_WIDTH });
    doc
      .font(flag ? 'bold' : 'body')
      .fontSize(10)
      .fillColor(flag ? ACCENT : INK)
      .text(shown, valueX, y, { width: valueWidth });
    if (detail) doc.font('body').fontSize(10).fillColor(INK).text(detail, valueX, y + valueHeight + 2, { width: valueWidth });
    const lineY = y + height + 4;
    doc.moveTo(MARGIN, lineY).lineTo(MARGIN + width, lineY).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.x = MARGIN;
    doc.y = lineY + 4;
  };

  const paragraph = (text, { color = INK, size = 9.5 } = {}) => {
    doc.font('body').fontSize(size).fillColor(color);
    room(doc.heightOfString(text, { width }) + 4);
    doc.text(text, MARGIN, doc.y, { width });
    doc.moveDown(0.3);
  };

  const display = (f, raw) => {
    let v = raw || '';
    if (!v) return '';
    if (f.type === 'money') v = '$' + v.replace(/^\$/, '');
    if (f.type === 'date') v = day(v);
    if (f.type === 'yesno' && v === 'No') v = f.noLabel;
    return v;
  };

  applications.forEach((application, index) => {
    const d = application.data;
    owner = application.full_name;
    if (index === 0) pageOwner.push(owner);
    else doc.addPage();

    // Heading
    doc.font('bold').fontSize(9).fillColor(ACCENT).text('Rental application', MARGIN, MARGIN, { width });
    doc.font('bold').fontSize(22).fillColor(INK).text(application.full_name, { width });
    doc.moveDown(0.2);
    doc
      .font('body')
      .fontSize(10)
      .fillColor(MUTED)
      .text(`${property.address}. Monthly rent ${money(property.rent)}.`, { width })
      .text(`Sent ${when(application.created_at)} Eastern. ${application.phone}, ${application.email}`, { width });

    sections.forEach((section) => {
      sectionTitle(section.title);
      section.blocks.forEach((block) => {
        if (block.type === 'group') {
          const answered = block.fields.some((f) => d[f.name]);
          if (block.title) subTitle(block.title);
          if (block.title && !answered) {
            paragraph('Not provided.', { color: MUTED });
            return;
          }
          block.fields.forEach((f) => {
            if (f.showWhen && d[f.showWhen.field] !== f.showWhen.equals) return;
            row(f.label, display(f, d[f.name]), {
              flag: f.type === 'yesno' && d[f.name] === 'Yes',
              detail: f.explain ? d[f.explain] || '' : '',
            });
          });
        } else if (block.type === 'repeat') {
          subTitle(block.title);
          const rows = (d[block.name] || []).filter((r) => !rowIsEmpty(block, r));
          if (!rows.length) {
            paragraph('None listed.', { color: MUTED });
            return;
          }
          rows.forEach((r, i) => {
            const value = block.fields
              .filter((f) => r[f.name])
              .map((f) => `${f.label.replace(/\?$/, '')}: ${display(f, r[f.name])}`)
              .join('\n');
            row(`${block.rowLabel} ${i + 1}`, value);
          });
        } else if (block.type === 'files') {
          subTitle(block.title);
          const files = application.files || [];
          if (!files.length) paragraph('No files attached.', { color: MUTED });
          else {
            files.forEach((f, i) => row(`File ${i + 1}`, `${f.filename} (${fileSize(f.size)})`));
            paragraph('Attached files are downloaded separately from the review page.', { color: MUTED, size: 8.5 });
          }
        } else if (block.type === 'note' && block.legal) {
          doc.moveDown(0.2);
          paragraph(`Notice shown to the applicant: ${block.text}`, { color: MUTED, size: 8.5 });
          doc.moveDown(0.4);
        }
      });
    });

    // Keep the signature block together on one page.
    room(260);
    sectionTitle('Signature');
    paragraph('The applicant agreed to the following:');
    agreements.forEach((a) => {
      doc.font('body').fontSize(9.5).fillColor(INK);
      room(doc.heightOfString(a, { width: width - 14 }) + 4);
      const y = doc.y;
      doc.text('•', MARGIN, y, { width: 10 });
      doc.text(a, MARGIN + 14, y, { width: width - 14 });
      doc.moveDown(0.25);
    });
    doc.moveDown(0.4);
    row('Signed as', d.signature);
    row('Signed', `${when(d.signed_at || application.created_at)} Eastern`);
    row('Signed from', application.signed_ip ? `IP address ${application.signed_ip}` : '');
  });

  // Footer on every page: whose application it is and the page number.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGIN - 4;
    doc.moveTo(MARGIN, y - 8).lineTo(MARGIN + width, y - 8).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('body').fontSize(8).fillColor(MUTED);
    doc.text(`${pageOwner[i] || ''}, rental application for ${property.name}`, MARGIN, y, {
      width: width - 80,
      lineBreak: false,
    });
    doc.text(`Page ${i + 1} of ${range.count}`, MARGIN + width - 80, y, { width: 80, align: 'right', lineBreak: false });
  }

  doc.end();
}

module.exports = { buildPdf };
