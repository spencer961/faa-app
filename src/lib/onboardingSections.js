// ─────────────────────────────────────────────────────────────────────
// The onboarding questions — ONE canonical copy.
// Previously these lived in both onboarding.html and portal.html and had
// already drifted out of sync. Now both read from here.
// ─────────────────────────────────────────────────────────────────────

export const DSEC = [
  { id: 'practice', title: 'Practice Information', sub: 'Tell us about your practice', fields: [
    { id: 'practiceName', label: 'Practice Name', type: 'text', required: true },
    { id: 'doctorName', label: 'Doctor(s) or Owner(s) Name', type: 'text', required: true },
    { id: 'email', label: 'Email Address', type: 'text', required: true, placeholder: 'your@email.com' },
    { id: 'officeManager', label: "Office Manager's Name", type: 'text', required: false },
  ]},
  { id: 'services', title: 'Services & Pricing', sub: 'What high-ticket services do you offer?', fields: [
    { id: 'services', label: 'What type of implant / high-ticket cases do you provide?', type: 'checkbox', required: true, options: ['Full Fixed Arches / All-on-X', 'Overdentures / Implant Retained Dentures', 'Standard Dentures', 'Singles / Multiples Implants', 'Cosmetic Smile Makeovers', 'Orthodontic Treatment', 'Sleep Apnea', 'TMJ', 'Other'] },
    { id: 'pricing', label: 'What do you charge for your high-ticket services?', type: 'textarea', placeholder: 'e.g. Full-fixed arch: $18,000, Single implant: $4,000...' },
    { id: 'currentPatients', label: 'How many patients do you treat for each service per month?', type: 'textarea', placeholder: 'e.g. Singles: 8/mo, Full-fixed: 2/mo...' },
    { id: 'monthlyGoal', label: 'What is your monthly production goal?', type: 'textarea', placeholder: 'e.g. Full-fixed: $50,000/mo...' },
  ]},
  { id: 'brand', title: 'Brand & Content', sub: 'Your unique positioning and marketing assets', fields: [
    { id: 'uvp', label: 'What makes you unique? Why should someone choose you over anyone else?', type: 'textarea', placeholder: 'Your unique value proposition...' },
    { id: 'videoTestimonials', label: 'How many video testimonials / smile reveals do you have?', type: 'text', placeholder: 'e.g. 5 implant, 2 cosmetic' },
    { id: 'beforeAfterPhotos', label: 'How many before & after photos do you have for marketing?', type: 'text', placeholder: 'e.g. 30 total' },
    { id: 'educationalVideos', label: 'How many educational videos do you have for marketing?', type: 'text', placeholder: 'e.g. 3 explainer videos' },
  ]},
  { id: 'marketing', title: 'Marketing System', sub: 'Your current lead generation activities', fields: [
    { id: 'marketingCampaigns', label: 'What marketing campaigns are you currently running and what are you spending on each?', type: 'textarea', placeholder: 'e.g. Google PPC: $3,000/mo...' },
    { id: 'leadsPerChannel', label: 'How many leads are you getting from each initiative?', type: 'textarea', placeholder: 'e.g. Google: 20/mo, Facebook: 15/mo...' },
    { id: 'howTrackResults', label: 'How do you track the results or effectiveness of your marketing?', type: 'textarea', placeholder: 'Describe your tracking tools...' },
  ]},
  { id: 'closing', title: 'Closing System', sub: 'Your process from lead to treatment start', fields: [
    { id: 'whoAnswersPhone', label: 'Who answers the phone when implant leads call in?', type: 'text', placeholder: 'e.g. Dedicated appointment setter...' },
    { id: 'bookingRate', label: 'What is your lead to scheduled consult rate?', type: 'text', placeholder: 'e.g. 40% or Not Sure' },
    { id: 'treatmentCoordinator', label: 'Who is fulfilling the treatment coordinator role?', type: 'text', placeholder: 'Name and/or title' },
    { id: 'showRate', label: 'What is your current show rate for consultations?', type: 'text', placeholder: 'e.g. 75% or Not Sure' },
    { id: 'closeRate', label: 'What is your current treatment close rate?', type: 'text', placeholder: 'e.g. 30% or Not Sure' },
    { id: 'financingCompanies', label: 'Which financing companies do you work with?', type: 'text', placeholder: 'e.g. CareCredit, Lending Club...' },
  ]},
  { id: 'team', title: 'Team & Training', sub: "Your team's skills and accountability", fields: [
    { id: 'teamTraining', label: 'Describe the training you have provided your appointment setter(s) and treatment coordinator(s)', type: 'textarea', placeholder: 'Scripts, shadowing, formal programs...' },
    { id: 'teamAccountability', label: 'How do you hold your team accountable?', type: 'textarea', placeholder: 'How do you monitor and measure performance?' },
    { id: 'incentives', label: 'Describe any incentives you use to motivate your team', type: 'textarea', placeholder: 'Bonuses, commissions, non-financial rewards...' },
  ]},
  { id: 'challenges', title: 'Challenges & Goals', sub: 'Where do you need the most help?', fields: [
    { id: 'mainIssues', label: 'What are the main issues that need to be addressed?', type: 'textarea', placeholder: 'Be as specific as possible...' },
  ]},
]
