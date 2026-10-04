/** Static marketing copy for the homepage. Not domain data. */

export const HERO_TAGS = ['Student ID Cards', 'Staff ID Cards', 'School Diaries', 'Magazines', 'Prospectus', 'Lanyards & Ribbons', 'Printing & Designing']

export const HERO_POINTS = ['For schools & colleges', 'Custom designs', 'WhatsApp support']

export type Tone = 'blue' | 'green' | 'purple' | 'orange' | 'gold' | 'pink'

export const BENEFITS: { icon: string; title: string; text: string; tone: Tone }[] = [
  { icon: 'shield-check', title: 'Premium Quality', text: 'Best Quality Products', tone: 'blue' },
  { icon: 'timer', title: 'Fast Delivery', text: 'On Time Service', tone: 'blue' },
  { icon: 'indian-rupee', title: 'Affordable Price', text: 'Best Price Guarantee', tone: 'orange' },
  { icon: 'pen-line', title: 'Custom Design', text: 'As Per Your Need', tone: 'green' },
  { icon: 'headset', title: '24/7 Support', text: 'Always Here For You', tone: 'blue' },
  { icon: 'thumbs-up', title: 'Trusted By Many', text: 'Schools & Colleges', tone: 'green' },
]

export const QUICK_ACTIONS: { icon: string; title: string; text: string; tone: Tone; to?: string }[] = [
  { icon: 'file-pen', title: 'Student Form', text: 'Submit student details', tone: 'blue', to: '/student-form' },
  { icon: 'upload', title: 'File Upload', text: 'Upload Excel / CSV', tone: 'green', to: '/file-upload' },
  { icon: 'search', title: 'Track Order', text: 'Check job status', tone: 'purple', to: '/job-status' },
  { icon: 'receipt', title: 'Get a Quote', text: 'Request pricing', tone: 'orange' },
]

export const PROCESS_STEPS = [
  { icon: 'file-pen', title: 'Submit Your Details', text: 'Fill the student form or share your requirement with us.' },
  { icon: 'upload', title: 'Upload Student Data', text: 'Send student data in an Excel or CSV file.' },
  { icon: 'pen-line', title: 'Design & Verification', text: 'We prepare the design and verify every detail with you.' },
  { icon: 'printer', title: 'Printing & Quality Check', text: 'Cards are printed and checked one by one.' },
  { icon: 'truck', title: 'Delivery', text: 'Your finished order is packed and delivered.' },
]

export const WHY_POINTS = [
  { icon: 'shield-check', title: 'Premium quality', text: 'Sturdy cards and sharp, long-lasting print.' },
  { icon: 'timer', title: 'Fast service', text: 'Clear job tracking so you know where your order is.' },
  { icon: 'pen-line', title: 'Custom designs', text: 'Layouts matched to your logo, colours and needs.' },
  { icon: 'school', title: 'School & college solutions', text: 'ID cards, diaries, magazines and prospectus under one roof.' },
  { icon: 'headset', title: 'Reliable support', text: 'Talk to us directly on call or WhatsApp.' },
  { icon: 'printer', title: 'Professional printing', text: 'Careful quality checks before every dispatch.' },
]
