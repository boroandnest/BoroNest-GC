import { getCollection } from './mongo.js';
import { v4 as uuid } from 'uuid';

let seeded = false;

export async function ensureSeeded() {
  if (seeded) return;
  const meta = await getCollection('meta');
  const marker = await meta.findOne({ _id: 'seeded_v3' });
  if (marker) { seeded = true; return; }

  const projects = await getCollection('projects');
  const milestones = await getCollection('milestones');
  const documents = await getCollection('documents');
  const messages = await getCollection('messages');
  const photos = await getCollection('photos');
  const changeOrders = await getCollection('change_orders');

  // Seed demo projects. Visible to B&N staff (and to everyone only when SHOW_DEMO_PROJECTS=true).
  // The admin account is created from env by ensureAdmin() in lib/auth.js.
  const now = new Date();
  const sampleProjects = [
    {
      id: 'proj-lume-cafe',
      name: 'Lume Café — Williamsburg',
      address: '287 Bedford Ave, Brooklyn, NY 11211',
      type: 'Commercial',
      subType: 'Café',
      phase: 'Construction',
      gmpCeiling: 312000,
      actualSpend: 187400,
      percentComplete: 62,
      clientEmail: 'client@demo.com',
      pmName: 'M. Reyes',
      pmEmail: 'pm@boronest.co',
      softOpen: '2025-09-15',
      publicDemo: true,
      createdAt: now
    },
    {
      id: 'proj-noho-loft',
      name: 'Noho Loft — Gut Reno',
      address: '412 Broadway, New York, NY 10013',
      type: 'Residential',
      subType: 'Gut Renovation',
      phase: 'Permitting',
      gmpCeiling: 485000,
      actualSpend: 42800,
      percentComplete: 18,
      clientEmail: 'client@demo.com',
      pmName: 'S. Okafor',
      pmEmail: 'pm2@boronest.co',
      softOpen: '2026-01-20',
      publicDemo: true,
      createdAt: now
    },
    {
      id: 'proj-flatiron-medspa',
      name: 'Sable Med-Spa — Flatiron',
      address: '19 W 24th St, New York, NY 10010',
      type: 'Commercial',
      subType: 'Med-Spa',
      phase: 'Design',
      gmpCeiling: 268000,
      actualSpend: 14200,
      percentComplete: 8,
      clientEmail: 'client@demo.com',
      pmName: 'M. Reyes',
      pmEmail: 'pm@boronest.co',
      softOpen: '2025-12-05',
      publicDemo: true,
      createdAt: now
    },
    {
      id: 'proj-ues-ll11',
      name: '425 East 79th St — LL11 Compliance',
      address: '425 East 79th Street, New York, NY 10075',
      type: 'Compliance',
      subType: 'LL11 / LL97',
      phase: 'Permitting',
      gmpCeiling: 890000,
      actualSpend: 68000,
      percentComplete: 22,
      clientEmail: 'board@425east79.co',
      pmName: 'S. Okafor',
      pmEmail: 'pm2@boronest.co',
      softOpen: '2026-05-01',
      complianceType: 'LL11 Cycle 10B + LL97',
      filingStatus: 'QEWI report submitted — DOB review in progress',
      shareToken: 'demo-board-portal-425',
      shareCreatedAt: now,
      publicDemo: true,
      createdAt: now
    }
  ];
  // Only ever touch demo rows — never real project data.
  const demoIds = sampleProjects.map(p => p.id);
  await projects.deleteMany({ id: { $in: demoIds } });
  for (const col of [milestones, documents, messages, photos, changeOrders]) {
    await col.deleteMany({ projectId: { $in: demoIds } });
  }
  await projects.insertMany(sampleProjects);

  // Milestones
  const phases = ['Discovery', 'Design', 'Permitting', 'Procurement', 'Construction', 'Punch List', 'Close-Out'];
  const msRecords = [];
  for (const p of sampleProjects) {
    const idx = phases.indexOf(p.phase);
    phases.forEach((phase, i) => {
      msRecords.push({
        id: uuid(),
        projectId: p.id,
        name: phase + ' Sign-Off',
        phase,
        status: i < idx ? 'complete' : i === idx ? 'in_progress' : 'upcoming',
        dueDate: new Date(now.getTime() + (i - idx) * 14 * 86400000),
        completedAt: i < idx ? new Date(now.getTime() - (idx - i) * 14 * 86400000) : null,
        amount: Math.round(p.gmpCeiling / phases.length),
        paymentStatus: i < idx ? 'paid' : i === idx ? 'pending' : 'not_started'
      });
    });
  }
  await milestones.insertMany(msRecords);

  // Sample documents
  const catList = ['Contracts', 'Permits', 'Drawings', 'Photos', 'Change Orders', 'Invoices'];
  const docRecords = [];
  for (const p of sampleProjects) {
    catList.forEach((cat, i) => {
      docRecords.push({
        id: uuid(),
        projectId: p.id,
        category: cat,
        name: `${cat.replace(' ', '_')}_${p.id.split('-').pop()}_v1.pdf`,
        uploadedBy: p.pmName,
        uploadedAt: new Date(now.getTime() - (6 - i) * 3 * 86400000),
        size: (Math.random() * 8 + 0.5).toFixed(2) + ' MB'
      });
    });
  }
  await documents.insertMany(docRecords);

  // Sample messages
  const msgRecords = [];
  for (const p of sampleProjects) {
    msgRecords.push(
      { id: uuid(), projectId: p.id, fromName: p.pmName, fromRole: 'pm', body: 'Weekly update: framing complete on the east wall. Electrical rough-in starts Monday. Photos in the log.', createdAt: new Date(now.getTime() - 4 * 86400000) },
      { id: uuid(), projectId: p.id, fromName: 'Demo Client', fromRole: 'client', body: 'Looks great. Any update on the storefront glazing lead time?', createdAt: new Date(now.getTime() - 3 * 86400000) },
      { id: uuid(), projectId: p.id, fromName: p.pmName, fromRole: 'pm', body: 'Glazing confirmed for delivery on the 22nd — within GMP. No cost impact.', createdAt: new Date(now.getTime() - 2 * 86400000) }
    );
  }
  await messages.insertMany(msgRecords);

  // Sample photos (using unsplash construction imagery)
  const photoUrls = [
    'https://images.unsplash.com/photo-1597498178146-3e9378203bc9?w=800',
    'https://images.pexels.com/photos/7055821/pexels-photo-7055821.jpeg?auto=compress&w=800',
    'https://images.pexels.com/photos/12381213/pexels-photo-12381213.jpeg?auto=compress&w=800',
    'https://images.pexels.com/photos/18290521/pexels-photo-18290521.jpeg?auto=compress&w=800',
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800'
  ];
  const photoRecords = [];
  for (const p of sampleProjects) {
    photoUrls.forEach((u, i) => {
      photoRecords.push({
        id: uuid(),
        projectId: p.id,
        url: u,
        caption: `Week ${i + 1} progress — ${p.phase}`,
        uploadedBy: p.pmName,
        uploadedAt: new Date(now.getTime() - (5 - i) * 7 * 86400000)
      });
    });
  }
  await photos.insertMany(photoRecords);

  // Change orders
  const coRecords = [];
  for (const p of sampleProjects) {
    coRecords.push(
      { id: uuid(), projectId: p.id, description: 'Upgrade to commercial-grade HVAC unit', costImpact: 8400, status: 'Approved', requestedBy: 'Client', createdAt: new Date(now.getTime() - 20 * 86400000) },
      { id: uuid(), projectId: p.id, description: 'Additional recessed lighting in retail area', costImpact: 2100, status: 'Proposed', requestedBy: 'Client', createdAt: new Date(now.getTime() - 5 * 86400000) }
    );
  }
  await changeOrders.insertMany(coRecords);

  await meta.insertOne({ _id: 'seeded_v3', at: new Date() });
  seeded = true;
}
