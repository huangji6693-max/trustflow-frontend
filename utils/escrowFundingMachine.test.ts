import {
  clearEscrowFundingDraft,
  createInitialEscrowFundingState,
  ESCROW_FUNDING_STORAGE_KEY,
  loadEscrowFundingDraft,
  saveEscrowFundingDraft,
  transitionEscrowFundingState,
} from './escrowFundingMachine'

const VALID_STELLAR_ADDR =
  'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'

describe('escrowFundingMachine finite state machine', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts in basic_info (step 0) with accessible screen-reader announcement', () => {
    const state = createInitialEscrowFundingState()
    expect(state.step).toBe('basic_info')
    expect(state.stepIndex).toBe(0)
    expect(state.announcement).toBe('Step 1 of 3: Basic Info')
  })

  it('blocks transition from basic_info to milestones when required fields are invalid and announces errors', () => {
    const initial = createInitialEscrowFundingState()
    const next = transitionEscrowFundingState(initial, { type: 'NEXT' })

    expect(next.step).toBe('basic_info')
    expect(next.stepIndex).toBe(0)
    expect(next.errors.title).toBe('Title is required')
    expect(next.errors.description).toBe('Description is required')
    expect(next.errors.totalBudget).toBe('Valid budget is required')
    expect(next.errors.beneficiaryAddress).toBe(
      "Freelancer's wallet address is required"
    )
    expect(next.announcement).toContain('Cannot proceed to Milestones')
  })

  it('transitions deterministically through basic_info -> milestones -> review -> submitting -> funded', () => {
    let state = createInitialEscrowFundingState()
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'title',
      value: 'Soroban Security Audit',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'description',
      value: 'Audit smart contracts',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'totalBudget',
      value: '1000',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'beneficiaryAddress',
      value: VALID_STELLAR_ADDR,
    })

    state = transitionEscrowFundingState(state, { type: 'NEXT' })
    expect(state.step).toBe('milestones')
    expect(state.stepIndex).toBe(1)
    expect(state.announcement).toBe('Step 2 of 3: Milestones')

    // Attempting NEXT with empty milestone fields fails
    const invalidMilestoneState = transitionEscrowFundingState(state, {
      type: 'NEXT',
    })
    expect(invalidMilestoneState.step).toBe('milestones')
    expect(invalidMilestoneState.errors['milestone-0-title']).toBe(
      'Milestone title required'
    )
    expect(invalidMilestoneState.errors['milestone-0-amount']).toBe(
      'Valid amount required'
    )

    // Populate milestone 1 and add + populate milestone 2
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_MILESTONE',
      id: '1',
      field: 'title',
      value: 'Initial Review',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_MILESTONE',
      id: '1',
      field: 'amount',
      value: '400',
    })
    state = transitionEscrowFundingState(state, {
      type: 'ADD_MILESTONE',
      id: '2',
    })
    expect(state.formData.milestones).toHaveLength(2)
    expect(state.announcement).toBe('Added Milestone 2')

    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_MILESTONE',
      id: '2',
      field: 'title',
      value: 'Final Report',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_MILESTONE',
      id: '2',
      field: 'amount',
      value: '600',
    })

    state = transitionEscrowFundingState(state, { type: 'NEXT' })
    expect(state.step).toBe('review')
    expect(state.stepIndex).toBe(2)
    expect(state.announcement).toBe('Step 3 of 3: Review & Submit')

    // Start submission
    state = transitionEscrowFundingState(state, { type: 'SUBMIT_START' })
    expect(state.step).toBe('submitting')

    // Simulate failure and recovery back to review
    state = transitionEscrowFundingState(state, {
      type: 'SUBMIT_FAILURE',
      message: 'User rejected signature',
    })
    expect(state.step).toBe('review')
    expect(state.submitError).toBe('User rejected signature')
    expect(state.announcement).toContain('Escrow submission failed')

    // Retry and succeed
    state = transitionEscrowFundingState(state, { type: 'SUBMIT_START' })
    state = transitionEscrowFundingState(state, {
      type: 'SUBMIT_SUCCESS',
      escrowId: '42',
      txHash: 'abc123hash',
    })
    expect(state.step).toBe('funded')
    expect(state.escrowId).toBe('42')
    expect(state.txHash).toBe('abc123hash')
    expect(state.announcement).toContain('escrow #42 funded successfully')
  })

  it('supports GOTO_STEP and BACK navigation with validation guards', () => {
    let state = createInitialEscrowFundingState()

    // Cannot jump directly to review (step 2) when basic_info is incomplete
    const blockedJump = transitionEscrowFundingState(state, {
      type: 'GOTO_STEP',
      stepIndex: 2,
    })
    expect(blockedJump.step).toBe('basic_info')
    expect(blockedJump.announcement).toContain('Cannot jump to Review & Submit')

    // Fill basic_info and milestone
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'title',
      value: 'Frontend DApp',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'description',
      value: 'Build UI',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'totalBudget',
      value: '500',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'beneficiaryAddress',
      value: VALID_STELLAR_ADDR,
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_MILESTONE',
      id: '1',
      field: 'title',
      value: 'UI Delivery',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_MILESTONE',
      id: '1',
      field: 'amount',
      value: '500',
    })

    // Jump directly to review (step 2)
    state = transitionEscrowFundingState(state, {
      type: 'GOTO_STEP',
      stepIndex: 2,
    })
    expect(state.step).toBe('review')
    expect(state.stepIndex).toBe(2)

    // Navigate BACK to milestones (step 1)
    state = transitionEscrowFundingState(state, { type: 'BACK' })
    expect(state.step).toBe('milestones')
    expect(state.stepIndex).toBe(1)
  })

  it('persists and restores resumable progress across reloads via localStorage', () => {
    let state = createInitialEscrowFundingState()
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'title',
      value: 'Resumable Escrow Gig',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'description',
      value: 'Persisted across reload',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'totalBudget',
      value: '2500',
    })
    state = transitionEscrowFundingState(state, {
      type: 'UPDATE_FIELD',
      field: 'beneficiaryAddress',
      value: VALID_STELLAR_ADDR,
    })
    state = transitionEscrowFundingState(state, { type: 'NEXT' })
    expect(state.step).toBe('milestones')

    saveEscrowFundingDraft(state)
    expect(window.localStorage.getItem(ESCROW_FUNDING_STORAGE_KEY)).toBeTruthy()

    const loaded = loadEscrowFundingDraft()
    expect(loaded).not.toBeNull()
    expect(loaded?.step).toBe('milestones')
    expect(loaded?.formData.title).toBe('Resumable Escrow Gig')

    const fresh = createInitialEscrowFundingState()
    const hydrated = transitionEscrowFundingState(fresh, {
      type: 'HYDRATE',
      snapshot: loaded!,
    })
    expect(hydrated.step).toBe('milestones')
    expect(hydrated.stepIndex).toBe(1)
    expect(hydrated.resumedFromStorage).toBe(true)
    expect(hydrated.formData.title).toBe('Resumable Escrow Gig')
    expect(hydrated.announcement).toBe(
      'Resumed saved escrow draft at Step 2 of 3: Milestones'
    )

    clearEscrowFundingDraft()
    expect(loadEscrowFundingDraft()).toBeNull()
  })
})
