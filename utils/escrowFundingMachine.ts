import { isValidStellarAddress } from '../shared/escrow-contract'

export type EscrowFundingStepId =
  | 'basic_info'
  | 'milestones'
  | 'review'
  | 'submitting'
  | 'funded'

export interface EscrowMilestoneDraft {
  id: string
  title: string
  description: string
  amount: string
  duration: string
}

export interface EscrowFundingFormData {
  title: string
  description: string
  category: string
  totalBudget: string
  beneficiaryAddress: string
  milestones: EscrowMilestoneDraft[]
}

export interface PersistedEscrowFundingSnapshot {
  step: 'basic_info' | 'milestones' | 'review'
  formData: EscrowFundingFormData
  updatedAt: number
}

export interface EscrowFundingMachineState {
  step: EscrowFundingStepId
  stepIndex: number
  formData: EscrowFundingFormData
  errors: Record<string, string>
  announcement: string
  resumedFromStorage: boolean
  escrowId: string | null
  txHash: string | null
  submitError: string | null
}

export type EscrowFundingEvent =
  | {
      type: 'UPDATE_FIELD'
      field: keyof Omit<EscrowFundingFormData, 'milestones'>
      value: string
    }
  | { type: 'ADD_MILESTONE'; id?: string }
  | { type: 'REMOVE_MILESTONE'; id: string }
  | {
      type: 'UPDATE_MILESTONE'
      id: string
      field: keyof EscrowMilestoneDraft
      value: string
    }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GOTO_STEP'; stepIndex: number }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; escrowId: string; txHash?: string }
  | { type: 'SUBMIT_FAILURE'; message: string }
  | { type: 'HYDRATE'; snapshot: PersistedEscrowFundingSnapshot }
  | { type: 'RESET_DRAFT' }

export const ESCROW_FUNDING_STEPS: ReadonlyArray<{
  id: 'basic_info' | 'milestones' | 'review'
  label: string
}> = [
  { id: 'basic_info', label: 'Basic Info' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'review', label: 'Review & Submit' },
]

export const ESCROW_FUNDING_STORAGE_KEY = 'trustflow:escrow-funding-draft:v1'

export function createInitialFormData(): EscrowFundingFormData {
  return {
    title: '',
    description: '',
    category: 'Development',
    totalBudget: '',
    beneficiaryAddress: '',
    milestones: [{ id: '1', title: '', description: '', amount: '', duration: '' }],
  }
}

export function createInitialEscrowFundingState(): EscrowFundingMachineState {
  return {
    step: 'basic_info',
    stepIndex: 0,
    formData: createInitialFormData(),
    errors: {},
    announcement: 'Step 1 of 3: Basic Info',
    resumedFromStorage: false,
    escrowId: null,
    txHash: null,
    submitError: null,
  }
}

export function stepIdToIndex(step: EscrowFundingStepId): number {
  switch (step) {
    case 'basic_info':
      return 0
    case 'milestones':
      return 1
    case 'review':
    case 'submitting':
    case 'funded':
      return 2
  }
}

export function validateBasicInfoStep(
  formData: EscrowFundingFormData,
  addressValidator: (address: string) => boolean = isValidStellarAddress
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!formData.title.trim()) {
    errors.title = 'Title is required'
  }
  if (!formData.description.trim()) {
    errors.description = 'Description is required'
  }
  if (!formData.totalBudget || Number(formData.totalBudget) <= 0) {
    errors.totalBudget = 'Valid budget is required'
  }
  if (!formData.beneficiaryAddress.trim()) {
    errors.beneficiaryAddress = "Freelancer's wallet address is required"
  } else if (!addressValidator(formData.beneficiaryAddress.trim())) {
    errors.beneficiaryAddress = 'Enter a valid Stellar address (starts with G)'
  }
  return errors
}

export function validateMilestonesStep(
  formData: EscrowFundingFormData
): Record<string, string> {
  const errors: Record<string, string> = {}
  formData.milestones.forEach((m, idx) => {
    if (!m.title.trim()) {
      errors[`milestone-${idx}-title`] = 'Milestone title required'
    }
    if (!m.amount || Number(m.amount) <= 0) {
      errors[`milestone-${idx}-amount`] = 'Valid amount required'
    }
  })
  return errors
}

export function transitionEscrowFundingState(
  state: EscrowFundingMachineState,
  event: EscrowFundingEvent,
  addressValidator: (address: string) => boolean = isValidStellarAddress
): EscrowFundingMachineState {
  switch (event.type) {
    case 'UPDATE_FIELD': {
      if (state.step === 'submitting') return state
      const nextErrors = { ...state.errors }
      delete nextErrors[event.field]
      return {
        ...state,
        formData: {
          ...state.formData,
          [event.field]: event.value,
        },
        errors: nextErrors,
        submitError: null,
      }
    }

    case 'ADD_MILESTONE': {
      if (state.step === 'submitting') return state
      const newId = event.id ?? Date.now().toString()
      const nextMilestones = [
        ...state.formData.milestones,
        { id: newId, title: '', description: '', amount: '', duration: '' },
      ]
      return {
        ...state,
        formData: {
          ...state.formData,
          milestones: nextMilestones,
        },
        announcement: `Added Milestone ${nextMilestones.length}`,
      }
    }

    case 'REMOVE_MILESTONE': {
      if (state.step === 'submitting' || state.formData.milestones.length <= 1) {
        return state
      }
      const nextMilestones = state.formData.milestones.filter(
        (m) => m.id !== event.id
      )
      return {
        ...state,
        formData: {
          ...state.formData,
          milestones: nextMilestones,
        },
        errors: {},
        announcement: `Removed milestone. ${nextMilestones.length} milestone${
          nextMilestones.length === 1 ? '' : 's'
        } remaining`,
      }
    }

    case 'UPDATE_MILESTONE': {
      if (state.step === 'submitting') return state
      const nextMilestones = state.formData.milestones.map((m) =>
        m.id === event.id ? { ...m, [event.field]: event.value } : m
      )
      return {
        ...state,
        formData: {
          ...state.formData,
          milestones: nextMilestones,
        },
        submitError: null,
      }
    }

    case 'NEXT': {
      if (state.step === 'basic_info') {
        const errors = validateBasicInfoStep(state.formData, addressValidator)
        if (Object.keys(errors).length > 0) {
          return {
            ...state,
            errors,
            announcement: `Cannot proceed to Milestones: ${Object.values(errors).join('. ')}`,
          }
        }
        return {
          ...state,
          step: 'milestones',
          stepIndex: 1,
          errors: {},
          announcement: 'Step 2 of 3: Milestones',
        }
      }

      if (state.step === 'milestones') {
        const errors = validateMilestonesStep(state.formData)
        if (Object.keys(errors).length > 0) {
          return {
            ...state,
            errors,
            announcement: `Cannot proceed to Review & Submit: ${Object.values(errors).join('. ')}`,
          }
        }
        return {
          ...state,
          step: 'review',
          stepIndex: 2,
          errors: {},
          announcement: 'Step 3 of 3: Review & Submit',
        }
      }

      return state
    }

    case 'BACK': {
      if (state.step === 'milestones') {
        return {
          ...state,
          step: 'basic_info',
          stepIndex: 0,
          errors: {},
          submitError: null,
          announcement: 'Step 1 of 3: Basic Info',
        }
      }
      if (state.step === 'review') {
        return {
          ...state,
          step: 'milestones',
          stepIndex: 1,
          errors: {},
          submitError: null,
          announcement: 'Step 2 of 3: Milestones',
        }
      }
      return state
    }

    case 'GOTO_STEP': {
      if (state.step === 'submitting' || state.step === 'funded') {
        return state
      }
      const target = event.stepIndex
      if (target < 0 || target >= ESCROW_FUNDING_STEPS.length || target === state.stepIndex) {
        return state
      }

      if (target > 0) {
        const basicErrors = validateBasicInfoStep(state.formData, addressValidator)
        if (Object.keys(basicErrors).length > 0) {
          return {
            ...state,
            errors: basicErrors,
            announcement: `Cannot jump to ${ESCROW_FUNDING_STEPS[target].label}: ${Object.values(
              basicErrors
            ).join('. ')}`,
          }
        }
      }

      if (target > 1) {
        const milestoneErrors = validateMilestonesStep(state.formData)
        if (Object.keys(milestoneErrors).length > 0) {
          return {
            ...state,
            errors: milestoneErrors,
            announcement: `Cannot jump to ${ESCROW_FUNDING_STEPS[target].label}: ${Object.values(
              milestoneErrors
            ).join('. ')}`,
          }
        }
      }

      const nextStepDef = ESCROW_FUNDING_STEPS[target]
      return {
        ...state,
        step: nextStepDef.id,
        stepIndex: target,
        errors: {},
        submitError: null,
        announcement: `Step ${target + 1} of ${ESCROW_FUNDING_STEPS.length}: ${nextStepDef.label}`,
      }
    }

    case 'SUBMIT_START': {
      if (state.step !== 'review') return state
      const basicErrors = validateBasicInfoStep(state.formData, addressValidator)
      const milestoneErrors = validateMilestonesStep(state.formData)
      const combinedErrors = { ...basicErrors, ...milestoneErrors }
      if (Object.keys(combinedErrors).length > 0) {
        return {
          ...state,
          errors: combinedErrors,
          announcement: `Cannot submit escrow: ${Object.values(combinedErrors).join('. ')}`,
        }
      }
      return {
        ...state,
        step: 'submitting',
        stepIndex: 2,
        errors: {},
        submitError: null,
        announcement: 'Submitting escrow funding transaction to Stellar network',
      }
    }

    case 'SUBMIT_SUCCESS': {
      if (state.step !== 'submitting') return state
      return {
        ...state,
        step: 'funded',
        stepIndex: 2,
        escrowId: event.escrowId,
        txHash: event.txHash ?? null,
        submitError: null,
        announcement: `Gig created and escrow #${event.escrowId} funded successfully`,
      }
    }

    case 'SUBMIT_FAILURE': {
      if (state.step !== 'submitting') return state
      return {
        ...state,
        step: 'review',
        stepIndex: 2,
        submitError: event.message,
        announcement: `Escrow submission failed: ${event.message}`,
      }
    }

    case 'HYDRATE': {
      const { snapshot } = event
      const stepIndex = stepIdToIndex(snapshot.step)
      const stepLabel = ESCROW_FUNDING_STEPS[stepIndex]?.label ?? 'Basic Info'
      return {
        ...state,
        step: snapshot.step,
        stepIndex,
        formData: snapshot.formData,
        errors: {},
        resumedFromStorage: true,
        submitError: null,
        announcement: `Resumed saved escrow draft at Step ${stepIndex + 1} of 3: ${stepLabel}`,
      }
    }

    case 'RESET_DRAFT': {
      return {
        ...createInitialEscrowFundingState(),
        announcement: 'Cleared saved draft. Step 1 of 3: Basic Info',
      }
    }
  }
}

export function saveEscrowFundingDraft(state: EscrowFundingMachineState): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (state.step === 'funded') return

  const persistableStep: 'basic_info' | 'milestones' | 'review' =
    state.step === 'submitting' ? 'review' : state.step

  const snapshot: PersistedEscrowFundingSnapshot = {
    step: persistableStep,
    formData: state.formData,
    updatedAt: Date.now(),
  }

  try {
    window.localStorage.setItem(ESCROW_FUNDING_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore storage quota errors
  }
}

export function loadEscrowFundingDraft(): PersistedEscrowFundingSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(ESCROW_FUNDING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedEscrowFundingSnapshot>
    if (
      !parsed ||
      (parsed.step !== 'basic_info' &&
        parsed.step !== 'milestones' &&
        parsed.step !== 'review') ||
      !parsed.formData ||
      typeof parsed.formData.title !== 'string' ||
      !Array.isArray(parsed.formData.milestones) ||
      parsed.formData.milestones.length === 0
    ) {
      return null
    }

    const hasUserContent =
      Boolean(parsed.formData.title.trim()) ||
      Boolean(parsed.formData.description?.trim()) ||
      Boolean(parsed.formData.totalBudget?.trim()) ||
      Boolean(parsed.formData.beneficiaryAddress?.trim()) ||
      parsed.step !== 'basic_info' ||
      parsed.formData.milestones.some(
        (m) => Boolean(m.title?.trim()) || Boolean(m.amount?.trim())
      )

    if (!hasUserContent) return null

    return {
      step: parsed.step,
      formData: parsed.formData,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function clearEscrowFundingDraft(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.removeItem(ESCROW_FUNDING_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}
