-- Reference/configuration data only (issuers, roles, certificate types). No certificates or students.
INSERT INTO issuers (slug, name, tagline, description, logo_path, website) VALUES
 ('placements', 'Monarch Placements',
  'Professional training and career readiness',
  'Monarch Placements delivers professional training programmes and issues certificates for course completion, assessed competency and placement readiness.',
  '/logos/monarch-placements.svg', 'https://monarchplacements.in'),
 ('softwares', 'Monarch Softwares',
  'Software and AI project internships',
  'Monarch Softwares runs software development, AI/ML and project internships and issues certificates for completed internship work.',
  '/logos/monarch-softwares.svg', NULL);

INSERT INTO roles (key, name, issuer_id, can_write) VALUES
 ('super_admin',      'Super Admin',      NULL, 1),
 ('placements_admin', 'Placements Admin', (SELECT id FROM issuers WHERE slug='placements'), 1),
 ('softwares_admin',  'Softwares Admin',  (SELECT id FROM issuers WHERE slug='softwares'), 1),
 ('viewer',           'Viewer',           NULL, 0);

INSERT INTO certificate_types (issuer_id, code, name, description, template) VALUES
 ((SELECT id FROM issuers WHERE slug='placements'), 'MPS', 'Professional Training Certificate',
  'Awarded on completion of a Monarch Placements training programme.', 'training'),
 ((SELECT id FROM issuers WHERE slug='placements'), 'MPC', 'Certificate of Competency',
  'Awarded when a learner demonstrates competency in an assessed skill area.', 'competency'),
 ((SELECT id FROM issuers WHERE slug='placements'), 'MPR', 'Placement Readiness Certificate',
  'Awarded on completion of a Monarch Placements placement readiness programme.', 'training'),
 ((SELECT id FROM issuers WHERE slug='softwares'), 'MSI', 'Internship Completion Certificate',
  'Awarded on completion of a Monarch Softwares internship.', 'internship'),
 ((SELECT id FROM issuers WHERE slug='softwares'), 'MPI', 'Project Internship Certificate',
  'Awarded on completion of a project-based internship at Monarch Softwares.', 'project_internship');
