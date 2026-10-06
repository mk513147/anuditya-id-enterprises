import type { Order } from '@/types'

/** DEMO DATA: fictional orders. `customer` is the display name of the owning school. */
export const ORDERS_DATA: Order[] = [
  { id: 'ord-1', orderNo: 'JOB-2026-0001', schoolId: 'sch-stmarys', customer: "St. Mary's School", service: 'Student ID Card', quantity: 500, status: 'Delivered', orderDate: '2026-06-10', expectedDelivery: '2026-06-24' },
  { id: 'ord-2', orderNo: 'JOB-2026-0002', schoolId: 'sch-greenvalley', customer: 'Green Valley College', service: 'College ID Card', quantity: 800, status: 'Delivered', orderDate: '2026-07-01', expectedDelivery: '2026-07-16' },
  { id: 'ord-3', orderNo: 'JOB-2026-0003', schoolId: 'sch-sunrise', customer: 'Sunrise Public School', service: 'School Diary', quantity: 600, status: 'Printing', orderDate: '2026-09-05', expectedDelivery: '2026-10-12' },
  { id: 'ord-4', orderNo: 'JOB-2026-0004', schoolId: 'sch-stmarys', customer: "St. Mary's School", service: 'Premium Lanyard / Ribbon', quantity: 500, status: 'Quality Check', orderDate: '2026-09-12', expectedDelivery: '2026-10-08' },
  { id: 'ord-5', orderNo: 'JOB-2026-0005', schoolId: 'sch-lotus', customer: 'Lotus International School', service: 'Student ID Card', quantity: 350, status: 'Designing', orderDate: '2026-09-20', expectedDelivery: '2026-10-18' },
  { id: 'ord-6', orderNo: 'JOB-2026-0006', schoolId: 'sch-greenvalley', customer: 'Green Valley College', service: 'Prospectus', quantity: 1000, status: 'Data Verification', orderDate: '2026-09-28', expectedDelivery: '2026-10-25' },
  { id: 'ord-7', orderNo: 'JOB-2026-0007', schoolId: 'sch-lotus', customer: 'Lotus International School', service: 'Magazine', quantity: 400, status: 'Order Received', orderDate: '2026-10-02', expectedDelivery: '2026-11-05' },
  { id: 'ord-8', orderNo: 'JOB-2026-0008', schoolId: 'sch-sunrise', customer: 'Sunrise Public School', service: 'Staff ID Card', quantity: 60, status: 'Ready', orderDate: '2026-09-22', expectedDelivery: '2026-10-07' },
]
