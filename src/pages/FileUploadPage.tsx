import { FileSpreadsheet, HardDrive, Files } from 'lucide-react'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { Reveal } from '@/components/shared/Reveal'
import { FileUploadFlow } from '@/features/uploads/components/FileUploadFlow'
import { UploadHelp } from '@/features/uploads/components/UploadHelp'
import { usePageTitle } from '@/hooks/usePageTitle'
import { waMessages } from '@/lib/whatsapp'
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB } from '@/validations/upload'

const INFO = [
  { icon: FileSpreadsheet, title: 'Accepted formats', text: ACCEPTED_EXTENSIONS.map((e) => `.${e.toUpperCase()}`).join(', ') },
  { icon: HardDrive, title: 'Maximum size', text: `${MAX_UPLOAD_MB} MB per file` },
  { icon: Files, title: 'One file at a time', text: 'Upload again for each additional file' },
]

export function FileUploadPage() {
  usePageTitle('Upload Student Data')
  return (
    <>
      <PageHero
        breadcrumb="File Upload"
        eyebrow="File Upload"
        title="Upload Student Data"
        description="Upload your student list in Excel or CSV format for processing."
      />

      <div className="container-page py-8 sm:py-12">
        <section aria-label="Upload information" className="mx-auto mb-6 max-w-6xl sm:mb-8">
          <ul className="grid gap-3 sm:grid-cols-3">
            {INFO.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3 rounded-2xl bg-royal-50 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-royal-600 shadow-sm">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-navy-900">{title}</span>
                  <span className="block text-sm text-muted-ink">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          <Reveal className="min-w-0">
            <FileUploadFlow />
          </Reveal>
          <UploadHelp />
        </div>
      </div>

      <CtaBanner
        title="Need help preparing your file?"
        text="Call or message us and we will guide you."
        message={waMessages.fileUploadHelp()}
        showQuote={false}
        showCall
      />
    </>
  )
}
