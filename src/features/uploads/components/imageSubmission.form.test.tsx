import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { schoolImageSubmissionSchema } from '@/validations/schoolImage'
import { ImageSubmissionSuccess, SchoolImageSubmissionForm } from './SchoolImageSubmissionForm'

const VALID = { schoolId: 'sch-1', contactPerson: 'Asha Teacher', contactDetails: 'office@school.example', note: '' }
const errorsFor = (over: Record<string, unknown>) => {
  const r = schoolImageSubmissionSchema.safeParse({ ...VALID, ...over })
  return r.success ? [] : [...new Set(r.error.issues.map((i) => String(i.path[0])))]
}

describe('image submission fields', () => {
  it('uses the same school / contact rules as the data file form; the note is optional', () => {
    expect(errorsFor({})).toEqual([])
    expect(errorsFor({ note: 'Front gate and assembly hall' })).toEqual([])
    expect(errorsFor({ schoolId: ' ' })).toEqual(['schoolId'])
    expect(errorsFor({ contactPerson: 'A' })).toEqual(['contactPerson'])
    expect(errorsFor({ contactDetails: '12345' })).toEqual(['contactDetails'])
    expect(errorsFor({ contactDetails: '9876543210' })).toEqual([])
    expect(errorsFor({ note: 'x'.repeat(501) })).toEqual(['note'])
  })
})

describe('Submit School Images form', () => {
  const html = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <SchoolImageSubmissionForm />
    </QueryClientProvider>,
  )

  it('has its own title, fields and submit button', () => {
    expect(html).toContain('Submit School Images')
    for (const id of ['si-school', 'si-person', 'si-contact', 'si-images', 'si-note']) expect(html).toContain(`id="${id}"`)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>.*Submit Images<\/button>/s)
    expect(html).not.toContain('sd-school') // separate from the data file form
  })

  it('accepts several JPEG / PNG / WebP images (no SVG) and shows the limits', () => {
    const input = html.match(/<input[^>]*id="si-images"[^>]*>/)![0]
    expect(input).toContain('multiple')
    expect(input).toContain('accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"')
    expect(input).not.toMatch(/svg/i)
    expect(html).toContain('up to 5 MB each')
    expect(html).toContain('up to 20 per batch')
  })

  it('says images are reviewed before use', () => {
    expect(html).toMatch(/reviewed by AnudityaID(&#x27;|')s administrator/)
  })

  it('is wired to the shared uploader pieces, never to administrator calls', () => {
    const src = readFileSync(new URL('./SchoolImageSubmissionForm.tsx', import.meta.url), 'utf8')
    expect(src).toContain("from '@/features/schools/components/ImageQueue'")
    expect(src).toContain("from '@/features/schools/imageBatch'")
    expect(src).not.toMatch(/uploadImage|setPrimaryImage|reviewImage|admin_/)
  })
})

describe('submission result', () => {
  it('reports each image and never shows paths or checksums', () => {
    const html = renderToStaticMarkup(
      <ImageSubmissionSuccess
        onReset={() => undefined}
        outcomes={[{ name: 'gate.jpg', status: 'done' }, { name: 'hall.png', status: 'duplicate' }, { name: 'logo.svg', status: 'invalid', message: 'Only JPEG, PNG or WebP images can be uploaded.' }]}
      />,
    )
    expect(html).toContain('Images submitted for review')
    expect(html).toContain('1 image submitted for administrator review · 1 already present for this school · 1 not accepted')
    expect(html).toMatch(/gate\.jpg.*Submitted/s)
    expect(html).toMatch(/hall\.png.*Already present/s)
    expect(html).toMatch(/logo\.svg.*Not accepted: Only JPEG/s)
    expect(html).not.toMatch(/submissions\/|[0-9a-f]{64}/)
  })
})
