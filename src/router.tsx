import { createBrowserRouter } from 'react-router-dom'
import { AdminLayout } from '@/layouts/AdminLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { FileUploadPage } from '@/pages/FileUploadPage'
import { StudentFormPage } from '@/pages/StudentFormPage'
import { SchoolSubmissionPage } from '@/pages/SchoolSubmissionPage'
import { ServicesPage } from '@/pages/ServicesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { AdminComingSoon } from '@/pages/admin/AdminComingSoon'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminStudentDetailPage } from '@/pages/admin/AdminStudentDetailPage'
import { AdminStudentsPage } from '@/pages/admin/AdminStudentsPage'
import { AdminSchoolDetailPage } from '@/pages/admin/AdminSchoolDetailPage'
import { AdminSchoolsPage } from '@/pages/admin/AdminSchoolsPage'

const page = (title: string) => <PlaceholderPage title={title} />
const soon = (section: string) => <AdminComingSoon section={section} />

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/student-form', element: <StudentFormPage /> },
      // School-specific submission link. The slug is an identifier, not a secret.
      // Direct visits need the host's SPA fallback; see docs/school-links.md.
      { path: '/school/:schoolSlug', element: <SchoolSubmissionPage /> },
      { path: '/file-upload', element: <FileUploadPage /> },
      { path: '/job-status', element: page('Job Status') },
      { path: '/services', element: <ServicesPage /> },
      { path: '/advertisement', element: page('Advertisement') },
      { path: '/feedback', element: page('Feedback') },
      { path: '/login', element: page('Login') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage />, handle: { title: 'Dashboard' } },
      { path: 'schools', element: <AdminSchoolsPage />, handle: { title: 'Schools' } },
      { path: 'schools/:schoolId', element: <AdminSchoolDetailPage />, handle: { title: 'School Details' } },
      { path: 'students', element: <AdminStudentsPage />, handle: { title: 'Students' } },
      { path: 'students/:studentId', element: <AdminStudentDetailPage />, handle: { title: 'Student Details' } },
      { path: 'orders', element: soon('Order'), handle: { title: 'Orders' } },
      { path: 'files', element: soon('File'), handle: { title: 'Files' } },
      { path: 'advertisements', element: soon('Advertisement'), handle: { title: 'Advertisements' } },
      { path: 'feedback', element: soon('Feedback'), handle: { title: 'Feedback' } },
      { path: 'services', element: soon('Service'), handle: { title: 'Services' } },
    ],
  },
])
