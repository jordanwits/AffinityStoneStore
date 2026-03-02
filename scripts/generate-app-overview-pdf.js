/**
 * Generates a one-page PDF overview of the Affinity Stone Rewards app.
 * Run: node scripts/generate-app-overview-pdf.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'Affinity-Stone-App-Overview.pdf');
const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Title
doc.fontSize(24).font('Helvetica-Bold').text('Affinity Stone Rewards', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(11).font('Helvetica').fillColor('#6b7280').text('Employee Rewards & Merchandise Shop', { align: 'center' });
doc.moveDown(1);

// What It Is
doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('What It Is');
doc.fontSize(10).font('Helvetica').fillColor('#374151');
doc.text(
  'Affinity Stone Rewards is an employee rewards program that lets staff redeem earned points for company-branded merchandise. Employees request access, earn points through accomplishments, and shop a catalog of apparel, drinkware, bags, electronics, and office supplies—all paid with points, not cash.',
  { width: 500, align: 'justify' }
);
doc.moveDown(0.8);

// How It Works
doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('How It Works');
doc.fontSize(10).font('Helvetica').fillColor('#374151');

const steps = [
  '1. Request Access — Users submit their work email; admins review and approve, then send login instructions via email.',
  '2. Earn Points — Points are awarded for achievements and contributions. Admins can add points manually or via bulk upload.',
  '3. Shop — Browse the catalog with filters (category, collections, size, color, price). Products display point prices based on a configurable USD-to-points conversion rate.',
  '4. Checkout — Add items to cart, choose delivery or pickup, enter shipping address, and place order. Points are deducted on order placement.',
  '5. Track — Users view order history and points transaction history. Admins manage orders, update statuses, and fulfill shipments.',
];

steps.forEach((s) => {
  doc.text(s, { width: 500, indent: 0 });
  doc.moveDown(0.4);
});
doc.moveDown(0.5);

// Tech Stack
doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('Tech Stack');
doc.fontSize(10).font('Helvetica').fillColor('#374151');
doc.text(
  'Next.js 15 • React 19 • Supabase (auth, database) • Resend (email) • Tailwind CSS • pnpm monorepo with shared core package',
  { width: 500 }
);
doc.moveDown(0.8);

// User & Admin Features
doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('User Features');
doc.fontSize(10).font('Helvetica').fillColor('#374151');
doc.text(
  'Marketing home • Request access • Login / forgot password • Dashboard (product catalog) • Product detail with variants (size/color) • Cart • Checkout (delivery/pickup) • Order history • Profile & address • Points history',
  { width: 500 }
);
doc.moveDown(0.5);

doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('Admin Features');
doc.fontSize(10).font('Helvetica').fillColor('#374151');
doc.text(
  'Dashboard (users, products, orders) • User management (create, invite) • Product CRUD with variant matrix • Points adjustments & bulk upload • Order management & status updates • Reports • CSV exports • Conversion rate config • Monthly export (Supabase Edge Function)',
  { width: 500 }
);

doc.end();

stream.on('finish', () => {
  console.log(`PDF saved to: ${path.resolve(outputPath)}`);
});
