import { createBrowserRouter } from 'react-router-dom'
import { AdminLayout } from '@/layouts/AdminLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { FileUploadPage } from '@/pages/FileUploadPage'
import { StudentFormPage } from '@/pages/StudentFormPage'
import { ServicesPage } from '@/pages/ServicesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const page = (title: string) => <PlaceholderPage title={title} />

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/student-form', element: <StudentFormPage /> },
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
      { index: true, element: page('Admin Dashboard') },
      { path: 'students', element: page('Admin · Students') },
      { path: 'orders', element: page('Admin · Orders') },
      { path: 'files', element: page('Admin · Files') },
      { path: 'advertisements', element: page('Admin · Advertisements') },
      { path: 'feedback', element: page('Admin · Feedback') },
      { path: 'services', element: page('Admin · Services') },
    ],
  },
])
