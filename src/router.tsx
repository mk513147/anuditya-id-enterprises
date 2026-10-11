import { createBrowserRouter } from 'react-router-dom'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
import { AdminLayout } from '@/layouts/AdminLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { FileUploadPage } from '@/pages/FileUploadPage'
import { JobStatusPage } from '@/pages/JobStatusPage'
import { LoginPage } from '@/pages/LoginPage'
import { AdvertisementPage } from '@/pages/AdvertisementPage'
import { FeedbackPage } from '@/pages/FeedbackPage'
import { StudentFormPage } from '@/pages/StudentFormPage'
import { SchoolSubmissionPage } from '@/pages/SchoolSubmissionPage'
import { ServicesPage } from '@/pages/ServicesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminAdvertisementsPage } from '@/pages/admin/AdminAdvertisementsPage'
import { AdminFeedbackPage } from '@/pages/admin/AdminFeedbackPage'
import { AdminFilesPage } from '@/pages/admin/AdminFilesPage'
import { AdminOrderDetailPage } from '@/pages/admin/AdminOrderDetailPage'
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage'
import { AdminServicesPage } from '@/pages/admin/AdminServicesPage'
import { AdminStudentDetailPage } from '@/pages/admin/AdminStudentDetailPage'
import { AdminStudentsPage } from '@/pages/admin/AdminStudentsPage'
import { AdminSchoolDetailPage } from '@/pages/admin/AdminSchoolDetailPage'
import { AdminSchoolsPage } from '@/pages/admin/AdminSchoolsPage'

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
      { path: '/job-status', element: <JobStatusPage /> },
      { path: '/services', element: <ServicesPage /> },
      { path: '/advertisement', element: <AdvertisementPage /> },
      { path: '/feedback', element: <FeedbackPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    // The admin area stays closed until the signed-in user's administrator role is verified (a UI gate;
    // the database enforces the real permissions).
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <AdminDashboardPage />, handle: { title: 'Dashboard' } },
      { path: 'schools', element: <AdminSchoolsPage />, handle: { title: 'Schools' } },
      { path: 'schools/:schoolId', element: <AdminSchoolDetailPage />, handle: { title: 'School Details' } },
      { path: 'students', element: <AdminStudentsPage />, handle: { title: 'Students' } },
      { path: 'students/:studentId', element: <AdminStudentDetailPage />, handle: { title: 'Student Details' } },
      { path: 'orders', element: <AdminOrdersPage />, handle: { title: 'Orders' } },
      { path: 'orders/:orderId', element: <AdminOrderDetailPage />, handle: { title: 'Order Details' } },
      { path: 'files', element: <AdminFilesPage />, handle: { title: 'Files' } },
      { path: 'advertisements', element: <AdminAdvertisementsPage />, handle: { title: 'Advertisements' } },
      { path: 'feedback', element: <AdminFeedbackPage />, handle: { title: 'Feedback' } },
      { path: 'services', element: <AdminServicesPage />, handle: { title: 'Services' } },
    ],
  },
])
