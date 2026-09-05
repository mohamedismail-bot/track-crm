export const CONTACT_STATUSES = ['lead', 'prospect', 'customer', 'inactive'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'task'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
  status: ContactStatus
  tags: string[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Deal {
  id: string
  name: string
  contactId: string
  amount: number
  stage: DealStage
  expectedCloseDate: string | null
  contactName?: string
  createdAt: string
  updatedAt: string
}

export const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export interface Activity {
  id: string
  contactId: string
  type: ActivityType
  subject: string
  description: string | null
  contactName?: string
  createdAt: string
}

export interface DashboardStats {
  totalContacts: number
  activeDeals: number
  pipelineValue: number
  wonDeals: number
  recentActivities: Activity[]
  contactsByStage: { stage: ContactStatus; count: number }[]
  dealsByStage: { stage: DealStage; value: number }[]
}