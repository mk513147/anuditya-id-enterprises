import { BUSINESS } from './business'

const GREETING = `Hello ${BUSINESS.name}, `

/** Pre-filled message templates. Keep wording in one place. */
export const waMessages = {
  general: () => `${GREETING}I would like to know more about your services.`,
  quote: (service: string) =>
    `${GREETING}I am interested in ${service} printing. Please provide a quotation.`,
  order: (ref: string) => `${GREETING}I would like an update on order ${ref}.`,
  studentForm: (ref: string, school?: string) =>
    `${GREETING}I have submitted the student form${school ? ` for ${school}` : ""}. My reference number is ${ref}.`,
  fileUploadHelp: () => `${GREETING}I need help uploading my student data file.`,
  fileUploaded: (ref: string) =>
    `${GREETING}I have uploaded my student data file. My upload reference is ${ref}.`,
  ad: (title: string) => `${GREETING}I saw your offer "${title}". Please share details.`,
}

export function whatsappUrl(message: string = waMessages.general()): string {
  return `https://wa.me/${BUSINESS.countryCode}${BUSINESS.whatsapp}?text=${encodeURIComponent(message)}`
}
