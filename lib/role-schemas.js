// Schema definitions for role-based onboarding wizards.
// 'instant' = create profile + immediate access. 'apply' = application requiring B&N verification.
export const ROLE_SCHEMAS = {
  'client': {
    label: 'Client',
    mode: 'instant',
    headline: 'Create your client profile',
    subhead: 'Set up your account and get workspace access immediately.',
    steps: [
      {
        title: 'About you',
        fields: [
          { name: 'fullName', label: 'Full name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'company', label: 'Company (optional)', type: 'text' }
        ]
      },
      {
        title: 'Project basics',
        fields: [
          { name: 'projectType', label: 'Project type', type: 'select', required: true, options: ['Commercial', 'Residential'] },
          { name: 'subType', label: 'Sub-type (if commercial)', type: 'select', options: ['Café', 'Med-Spa', 'Clinic', 'Boutique Fitness', 'Restaurant', 'Retail', 'Other'] },
          { name: 'borough', label: 'NYC borough', type: 'select', required: true, options: ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'] },
          { name: 'address', label: 'Project address', type: 'text', required: true },
          { name: 'neighborhood', label: 'Neighborhood', type: 'text' }
        ]
      },
      {
        title: 'Scope & timing',
        fields: [
          { name: 'leaseStatus', label: 'Lease status (commercial)', type: 'select', options: ['Signed', 'In Negotiation', 'Not Yet', 'N/A - Residential'] },
          { name: 'budgetRange', label: 'Estimated budget', type: 'select', required: true, options: ['< $150K', '$150K – $250K', '$250K – $500K', '$500K+'] },
          { name: 'softOpen', label: 'Target soft-open date', type: 'date' },
          { name: 'hasDesigner', label: 'Do you have a designer engaged?', type: 'select', options: ['Yes', 'No'] },
          { name: 'referral', label: 'How did you hear about us?', type: 'text' }
        ]
      }
    ]
  },
  'management': {
    label: 'Management Company',
    mode: 'instant',
    headline: 'Create your management profile',
    subhead: 'Track projects, TI disbursements, and subcontractor performance across your portfolio.',
    steps: [
      {
        title: 'Company info',
        fields: [
          { name: 'company', label: 'Company name', type: 'text', required: true },
          { name: 'fullName', label: 'Primary contact', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true }
        ]
      },
      {
        title: 'Portfolio',
        fields: [
          { name: 'portfolioSize', label: 'Buildings managed', type: 'number', required: true },
          { name: 'boroughs', label: 'Boroughs served (comma-separated)', type: 'text', placeholder: 'Manhattan, Brooklyn' },
          { name: 'tiRange', label: 'Standard TI allowance range', type: 'select', options: ['< $50/sqft', '$50–$100/sqft', '$100–$150/sqft', '$150+/sqft'] },
          { name: 'hasSpecSheet', label: 'Standard spec sheet available?', type: 'select', options: ['Yes', 'No'] },
          { name: 'preferredComm', label: 'Preferred communication', type: 'select', options: ['Email', 'Phone', 'In-App'] }
        ]
      }
    ]
  },
  'building-rep': {
    label: 'Building Rep',
    mode: 'instant',
    headline: 'Create your building rep / board profile',
    subhead: 'For supers, property managers, landlord reps, and co-op / condo board members.',
    steps: [
      {
        title: 'About you',
        fields: [
          { name: 'fullName', label: 'Full name', type: 'text', required: true },
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g., Super, Property Manager, Board President' },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true }
        ]
      },
      {
        title: 'Building info',
        fields: [
          { name: 'addresses', label: 'Building address(es)', type: 'textarea', required: true },
          { name: 'buildingType', label: 'Building type', type: 'select', required: true, options: ['Residential', 'Commercial', 'Mixed-Use'] },
          { name: 'coopBoard', label: 'Co-op / condo board member?', type: 'select', options: ['Yes', 'No', 'N/A'] },
          { name: 'boardRole', label: 'Board role (if applicable)', type: 'select', options: ['President', 'Treasurer', 'Secretary', 'Member', 'Not applicable'] },
          { name: 'inspectionWindow', label: 'Preferred inspection scheduling window', type: 'text', placeholder: 'e.g., Tue-Thu 10am-2pm' },
          { name: 'accessRules', label: 'Access restrictions / building rules', type: 'textarea' }
        ]
      }
    ]
  },
  'expediter': {
    label: 'Expediter',
    mode: 'apply',
    headline: 'Apply to join as an Expediter',
    subhead: 'Submit your credentials for verification. Approved expediters get project access and bid invitations.',
    steps: [
      {
        title: 'About you',
        fields: [
          { name: 'fullName', label: 'Full name', type: 'text', required: true },
          { name: 'company', label: 'Company name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'license', label: 'License number', type: 'text', required: true }
        ]
      },
      {
        title: 'Experience',
        fields: [
          { name: 'filingTypes', label: 'DOB filing types (comma-separated)', type: 'text', required: true, placeholder: 'ALT1, ALT2, NB, Plumbing, Electrical' },
          { name: 'boroughs', label: 'Boroughs covered', type: 'text', required: true },
          { name: 'turnaround', label: 'Avg turnaround for standard ALT2', type: 'text', placeholder: 'e.g., 6 weeks' },
          { name: 'permits12mo', label: 'Permits filed (past 12 months)', type: 'number' },
          { name: 'references', label: 'References (name, phone, relationship — up to 3)', type: 'textarea' }
        ]
      }
    ]
  },
  'subcontractor': {
    label: 'Subcontractor',
    mode: 'apply',
    headline: 'Apply to join our sub network',
    subhead: 'We verify licenses and insurance before granting bid access. Platinum tier subs get priority bids and 48-hour payments.',
    steps: [
      {
        title: 'About you',
        fields: [
          { name: 'company', label: 'Company name', type: 'text', required: true },
          { name: 'fullName', label: 'Owner name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true }
        ]
      },
      {
        title: 'Trade & licenses',
        fields: [
          { name: 'trades', label: 'Trade(s) (comma-separated)', type: 'text', required: true, placeholder: 'Electrical, Plumbing, HVAC, Carpentry, Tile, Painting, Concrete' },
          { name: 'licenses', label: 'License number(s) + expiration', type: 'textarea', required: true },
          { name: 'glExpiration', label: 'GL insurance expiration', type: 'date', required: true },
          { name: 'wcExpiration', label: 'WC insurance expiration', type: 'date', required: true },
          { name: 'glCert', label: 'GL insurance certificate (upload PDF)', type: 'file', accept: '.pdf,.png,.jpg,.jpeg' },
          { name: 'wcCert', label: 'WC insurance certificate (upload PDF)', type: 'file', accept: '.pdf,.png,.jpg,.jpeg' }
        ]
      },
      {
        title: 'Availability',
        fields: [
          { name: 'boroughs', label: 'Boroughs available', type: 'text', required: true, placeholder: 'Manhattan, Brooklyn…' },
          { name: 'crewSize', label: 'Crew size', type: 'number', required: true },
          { name: 'canStart2wk', label: 'Can you start within 2 weeks?', type: 'select', required: true, options: ['Yes', 'No', 'Depends on trade'] },
          { name: 'references', label: 'References (min 3: name, phone, project)', type: 'textarea', required: true },
          { name: 'pastProjects', label: 'Notable past projects / portfolio URL', type: 'textarea' }
        ]
      }
    ]
  }
};
