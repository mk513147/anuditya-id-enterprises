import type { Student } from '@/types'

/**
 * DEMO DATA: fictional students, so the admin list, filters, pagination and dashboard have realistic volume.
 * The first six rows are stable fixtures used by tests; later rows add variety (other schools, classes,
 * an archived record, a student of the inactive school).
 */
type Row = {
  first: string
  last: string
  father: string
  mother: string
  school: string
  cls: string
  sec: string
  roll: string
  adm: string
  dob: string
  at: string // submission time (UTC, midday so local-date filters are timezone-safe)
  extras?: Pick<Student, 'bloodGroup' | 'houseName' | 'houseColour' | 'busRoute' | 'busStoppage'>
  archived?: boolean
}

const ROWS: Row[] = [
  { first: 'Aarav', last: 'Demo', father: 'Rakesh', mother: 'Sunita', school: 'sch-stmarys', cls: 'Class 6', sec: 'A', roll: '12', adm: 'STM/2021/0412', dob: '2012-04-12', at: '2026-08-03T10:00:00.000Z', extras: { bloodGroup: 'B+', houseName: 'Ashoka', houseColour: 'Red', busRoute: 'Route 2', busStoppage: 'Market Square' } },
  { first: 'Priya', last: 'Sample', father: 'Mohan', mother: 'Rani', school: 'sch-stmarys', cls: 'Class 7', sec: 'B', roll: '07', adm: 'STM/2020/0231', dob: '2011-09-30', at: '2026-08-03T10:20:00.000Z' },
  { first: 'Rohan', last: 'Test', father: 'Anil', mother: 'Meena', school: 'sch-greenvalley', cls: 'Other', sec: 'C', roll: '31', adm: 'GVC/2023/0877', dob: '2005-01-18', at: '2026-08-11T10:10:00.000Z', extras: { bloodGroup: 'O+' } },
  { first: 'Sneha', last: 'Placeholder', father: 'Vijay', mother: 'Kavita', school: 'sch-sunrise', cls: 'Class 5', sec: 'A', roll: '19', adm: 'SPS/2022/0150', dob: '2013-12-02', at: '2026-08-20T10:40:00.000Z', extras: { houseName: 'Tagore', houseColour: 'Blue' } },
  { first: 'Kabir', last: 'Fictional', father: 'Sanjay', mother: 'Neha', school: 'sch-sunrise', cls: 'Class 4', sec: 'B', roll: '03', adm: 'SPS/2023/0044', dob: '2014-06-25', at: '2026-09-02T09:55:00.000Z', extras: { busRoute: 'Route 5', busStoppage: 'Temple Road' } },
  { first: 'Ananya', last: 'Imaginary', father: 'Deepak', mother: 'Pooja', school: 'sch-lotus', cls: 'Class 8', sec: 'A', roll: '22', adm: 'LIS/2019/0990', dob: '2010-03-09', at: '2026-09-18T10:05:00.000Z', extras: { bloodGroup: 'A+' } },
  // --- more variety ---
  { first: 'Ishaan', last: 'Mock', father: 'Arun', mother: 'Seema', school: 'sch-greenvalley', cls: 'Other', sec: 'C', roll: '32', adm: 'GVC/2023/0878', dob: '2005-05-02', at: '2026-08-11T10:15:00.000Z', archived: true },
  { first: 'Diya', last: 'Specimen', father: 'Harish', mother: 'Lata', school: 'sch-stmarys', cls: 'Class 6', sec: 'A', roll: '13', adm: 'STM/2021/0413', dob: '2012-07-21', at: '2026-08-04T10:00:00.000Z', extras: { bloodGroup: 'AB+', houseName: 'Ashoka', houseColour: 'Red' } },
  { first: 'Vihaan', last: 'Example', father: 'Manoj', mother: 'Geeta', school: 'sch-stmarys', cls: 'Class 6', sec: 'B', roll: '04', adm: 'STM/2021/0420', dob: '2012-02-14', at: '2026-08-04T10:30:00.000Z' },
  { first: 'Myra', last: 'Pretend', father: 'Suresh', mother: 'Anita', school: 'sch-stmarys', cls: 'Class 8', sec: 'A', roll: '09', adm: 'STM/2019/0150', dob: '2010-11-05', at: '2026-08-05T10:00:00.000Z', extras: { busRoute: 'Route 1', busStoppage: 'Old Bridge' } },
  { first: 'Arjun', last: 'Faux', father: 'Pramod', mother: 'Usha', school: 'sch-stmarys', cls: 'Class 9', sec: 'C', roll: '27', adm: 'STM/2018/0099', dob: '2009-08-19', at: '2026-08-05T10:45:00.000Z', extras: { bloodGroup: 'O-' } },
  { first: 'Zoya', last: 'Dummy', father: 'Imran', mother: 'Farah', school: 'sch-greenvalley', cls: 'Other', sec: 'A', roll: '05', adm: 'GVC/2022/0301', dob: '2004-12-30', at: '2026-08-12T10:00:00.000Z' },
  { first: 'Reyansh', last: 'Notional', father: 'Gopal', mother: 'Radha', school: 'sch-greenvalley', cls: 'Other', sec: 'B', roll: '18', adm: 'GVC/2022/0340', dob: '2004-04-04', at: '2026-08-12T10:30:00.000Z', extras: { bloodGroup: 'B-' } },
  { first: 'Kiara', last: 'Synthetic', father: 'Nitin', mother: 'Preeti', school: 'sch-sunrise', cls: 'Class 5', sec: 'A', roll: '20', adm: 'SPS/2022/0151', dob: '2013-01-17', at: '2026-08-21T10:00:00.000Z', extras: { houseName: 'Tagore', houseColour: 'Blue', busRoute: 'Route 5' } },
  { first: 'Advait', last: 'Hypothetical', father: 'Rajiv', mother: 'Smita', school: 'sch-sunrise', cls: 'Class 3', sec: 'C', roll: '11', adm: 'SPS/2024/0010', dob: '2015-09-09', at: '2026-09-03T10:00:00.000Z' },
  { first: 'Saanvi', last: 'Invented', father: 'Kunal', mother: 'Ritu', school: 'sch-sunrise', cls: 'Class 4', sec: 'B', roll: '04', adm: 'SPS/2023/0045', dob: '2014-03-22', at: '2026-09-03T10:30:00.000Z', archived: true },
  { first: 'Dev', last: 'Make-Believe', father: 'Alok', mother: 'Varsha', school: 'sch-lotus', cls: 'Class 8', sec: 'A', roll: '23', adm: 'LIS/2019/0991', dob: '2010-10-10', at: '2026-09-18T10:20:00.000Z' },
  { first: 'Tara', last: 'Illustrative', father: 'Sameer', mother: 'Jaya', school: 'sch-lotus', cls: 'Class 7', sec: 'B', roll: '15', adm: 'LIS/2020/0420', dob: '2011-06-06', at: '2026-09-19T10:00:00.000Z', extras: { bloodGroup: 'A-', busRoute: 'Route 9', busStoppage: 'City Mall' } },
  // belongs to the INACTIVE school: its records must stay visible
  { first: 'Yash', last: 'Legacy', father: 'Bharat', mother: 'Mala', school: 'sch-model', cls: 'Class 10', sec: 'A', roll: '01', adm: 'MDA/2018/0007', dob: '2009-02-02', at: '2026-07-30T10:00:00.000Z', extras: { bloodGroup: 'B+' } },
  { first: 'Nisha', last: 'Archive', father: 'Tarun', mother: 'Sonia', school: 'sch-model', cls: 'Class 9', sec: 'B', roll: '14', adm: 'MDA/2019/0033', dob: '2010-08-08', at: '2026-07-30T10:20:00.000Z' },
]

export const STUDENTS_DATA: Student[] = ROWS.map((r, i) => {
  const n = i + 1
  const archivedAt = r.archived ? '2026-09-25T10:00:00.000Z' : undefined
  return {
    id: `stu-${n}`,
    referenceNo: `ANU-2026-${String(n).padStart(5, '0')}`,
    schoolId: r.school,
    name: `${r.first} ${r.last}`,
    fatherName: `${r.father} ${r.last}`,
    motherName: `${r.mother} ${r.last}`,
    dob: r.dob,
    className: r.cls,
    section: r.sec,
    rollNo: r.roll,
    admissionNo: r.adm,
    address: `${n} Sample Road, Demo Town, 0000${String(n % 10)}1`,
    mobile: `90000${String(10000 + n)}`,
    ...r.extras,
    submittedAt: r.at,
    updatedAt: archivedAt ?? r.at,
    isArchived: !!r.archived,
    archivedAt,
  }
})
