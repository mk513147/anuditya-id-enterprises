import type { ComponentType, ReactNode } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { BLOOD_GROUPS, CLASS_OPTIONS, todayISO, type StudentEditFormValues } from '@/validations/student'

const TODAY = todayISO()
const inputCls = 'h-11 text-base'
const GRID = 'grid gap-x-4 sm:grid-cols-2'

export interface StudentSectionProps {
  step: number
  icon: string
  title: string
  children: ReactNode
}

interface Props {
  register: UseFormRegister<StudentEditFormValues>
  errors: FieldErrors<StudentEditFormValues>
  /** Wrapper for each group: a card on the public form, a plain heading in the admin editor. */
  Section: ComponentType<StudentSectionProps>
  /** Rendered first inside "Student Information" (e.g. the school selector on the public form). */
  studentInfoPrefix?: ReactNode
}

/**
 * Every student field except the school and the photo. Used by the public submission form and the
 * admin edit dialog, so labels, limits and validation messages are identical in both places.
 */
export function StudentCoreFields({ register, errors, Section, studentInfoPrefix }: Props) {
  return (
    <>
      <Section step={1} icon="user" title="Student Information">
        <div className={GRID}>
          {studentInfoPrefix}
          <div className="sm:col-span-2">
            <FormField id="sf-name" label="Student Name" required error={errors.name?.message}>
              {(c) => <Input {...c} autoComplete="off" autoCapitalize="words" maxLength={60} placeholder="As per school records" className={inputCls} {...register('name')} />}
            </FormField>
          </div>
          <FormField id="sf-dob" label="Date of Birth" required error={errors.dob?.message}>
            {(c) => <Input {...c} type="date" max={TODAY} min="1980-01-01" className={`${inputCls} block`} {...register('dob')} />}
          </FormField>
          <FormField id="sf-class" label="Class" required error={errors.className?.message}>
            {(c) => (
              <NativeSelect {...c} {...register('className')} defaultValue="">
                <option value="" disabled>Select class</option>
                {CLASS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="sf-section" label="Section" required hint="For example: A, B or C" error={errors.section?.message}>
            {(c) => <Input {...c} autoComplete="off" autoCapitalize="characters" maxLength={5} placeholder="A" className={inputCls} {...register('section')} />}
          </FormField>
          <FormField id="sf-roll" label="Roll Number" required error={errors.rollNo?.message}>
            {(c) => <Input {...c} autoComplete="off" maxLength={10} placeholder="e.g. 23" className={inputCls} {...register('rollNo')} />}
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="sf-adm" label="Admission Number" required error={errors.admissionNo?.message}>
              {(c) => <Input {...c} autoComplete="off" maxLength={20} placeholder="e.g. 2024/0123" className={inputCls} {...register('admissionNo')} />}
            </FormField>
          </div>
        </div>
      </Section>

      <Section step={2} icon="users" title="Parent Information">
        <div className={GRID}>
          <FormField id="sf-father" label="Father Name" required error={errors.fatherName?.message}>
            {(c) => <Input {...c} autoComplete="off" autoCapitalize="words" maxLength={60} className={inputCls} {...register('fatherName')} />}
          </FormField>
          <FormField id="sf-mother" label="Mother Name" required error={errors.motherName?.message}>
            {(c) => <Input {...c} autoComplete="off" autoCapitalize="words" maxLength={60} className={inputCls} {...register('motherName')} />}
          </FormField>
        </div>
      </Section>

      <Section step={3} icon="phone" title="Contact Information">
        <div className="grid gap-x-4">
          <div className="sm:max-w-xs">
            <FormField id="sf-mobile" label="Mobile Number" required hint="10-digit Indian mobile number" error={errors.mobile?.message}>
              {(c) => <Input {...c} type="tel" inputMode="tel" autoComplete="off" maxLength={17} placeholder="98765 43210" className={inputCls} {...register('mobile')} />}
            </FormField>
          </div>
          <FormField id="sf-address" label="Address" required error={errors.address?.message}>
            {(c) => <Textarea {...c} rows={3} maxLength={250} autoComplete="off" placeholder="House / street, village or town, district, PIN code" className="min-h-24 text-base" {...register('address')} />}
          </FormField>
        </div>
      </Section>

      <Section step={4} icon="bus" title="Additional Details (optional)">
        <div className={GRID}>
          <FormField id="sf-blood" label="Blood Group" error={errors.bloodGroup?.message}>
            {(c) => (
              <NativeSelect {...c} {...register('bloodGroup')} defaultValue="">
                <option value="">Not specified</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="sf-house" label="School House Name" error={errors.houseName?.message}>
            {(c) => <Input {...c} autoComplete="off" maxLength={40} placeholder="e.g. Ashoka" className={inputCls} {...register('houseName')} />}
          </FormField>
          <FormField id="sf-housecolour" label="House Colour" error={errors.houseColour?.message}>
            {(c) => <Input {...c} autoComplete="off" maxLength={30} placeholder="e.g. Red" className={inputCls} {...register('houseColour')} />}
          </FormField>
          <FormField id="sf-busroute" label="Bus Route" error={errors.busRoute?.message}>
            {(c) => <Input {...c} autoComplete="off" maxLength={40} placeholder="e.g. Route 3" className={inputCls} {...register('busRoute')} />}
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="sf-busstop" label="Bus Stoppage" error={errors.busStoppage?.message}>
              {(c) => <Input {...c} autoComplete="off" maxLength={60} placeholder="Nearest bus stop" className={inputCls} {...register('busStoppage')} />}
            </FormField>
          </div>
        </div>
      </Section>
    </>
  )
}
