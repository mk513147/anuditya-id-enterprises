import {
  BookOpen, BookText, Bus, Camera, FilePenLine, Flag, GraduationCap, Headset, IdCard, FolderOpen, LayoutDashboard, Megaphone, MessageSquare, ClipboardList, Settings, IndianRupee, Newspaper, PenLine,
  PenTool, Phone, Printer, Receipt, School, Search, ShieldCheck, Tag, ThumbsUp, Timer, Truck, Upload, User, Users,
  type LucideIcon,
} from 'lucide-react'

/** String key → icon. Lets mock/DB data reference icons without importing components. */
const ICONS: Record<string, LucideIcon> = {
  'id-card': IdCard,
  users: Users,
  user: User,
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  files: FolderOpen,
  megaphone: Megaphone,
  message: MessageSquare,
  settings: Settings,
  bus: Bus,
  phone: Phone,
  camera: Camera,
  school: School,
  graduation: GraduationCap,
  ribbon: Tag,
  diary: BookOpen,
  magazine: Newspaper,
  prospectus: BookText,
  'pen-tool': PenTool,
  banner: Flag,
  printer: Printer,
  'shield-check': ShieldCheck,
  timer: Timer,
  'indian-rupee': IndianRupee,
  'pen-line': PenLine,
  headset: Headset,
  'thumbs-up': ThumbsUp,
  'file-pen': FilePenLine,
  upload: Upload,
  search: Search,
  receipt: Receipt,
  truck: Truck,
}

export const getIcon = (key: string): LucideIcon => ICONS[key] ?? IdCard
