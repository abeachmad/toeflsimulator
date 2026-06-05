# Ability Store Implementation

**Task:** 13.3 Create `abilityStore` for IRT parameters  
**Status:** ✅ **COMPLETED**  
**Requirements:** 3.4 (Reading Section ability estimation), 8.1 (Adaptive routing ability estimates)

## Overview

The `abilityStore` is a Zustand-based state management store that tracks IRT (Item Response Theory) parameters, ability estimates, and routing decisions for the TOEFL iBT 2026 adaptive testing system.

## Implementation Details

### File Location
- **Implementation:** `frontend/src/stores/abilityStore.ts`
- **Tests:** `frontend/src/stores/abilityStore.test.ts`
- **Export:** Exported via `frontend/src/stores/index.ts`

### State Structure

```typescript
interface AbilityStoreState {
  abilityEstimates: Partial<Record<AbilitySection, number>>
  irtParameters: Record<string, IRTParameters>
  routingDecisions: RoutingDecision[]
}
```

#### 1. abilityEstimates (by section)
- **Type:** `Partial<Record<AbilitySection, number>>`
- **Purpose:** Stores theta (θ) ability estimates for each test section
- **Sections:** 'reading' | 'listening' | 'speaking' | 'writing'
- **Range:** Typically -3.0 to +3.0 (IRT ability scale)
- **Requirement:** 3.4 - Reading Section ability estimation

#### 2. irtParameters (by item)
- **Type:** `Record<string, IRTParameters>`
- **Purpose:** Stores 3PL IRT parameters for each test item
- **Structure:** 
  ```typescript
  {
    a: number  // Discrimination parameter (0.5 to 2.5)
    b: number  // Difficulty parameter (-3 to +3)
    c: number  // Guessing parameter (0.0 to 0.3)
  }
  ```
- **Key:** Item ID string
- **Usage:** Used by IRT_Scorer for ability calculation

#### 3. routingDecisions
- **Type:** `RoutingDecision[]`
- **Purpose:** Records historical routing decisions for audit and analysis
- **Structure:**
  ```typescript
  {
    section: AbilitySection
    stage: number              // 1 or 2
    ability: number            // θ estimate at routing time
    difficulty: 'easy' | 'medium' | 'hard'
    timestamp: number          // Unix timestamp (ms)
  }
  ```
- **Requirement:** 8.1 - Adaptive routing ability estimates

### Actions

#### 1. updateAbility(section, theta)
- **Purpose:** Updates ability estimate for a specific section
- **Parameters:**
  - `section`: 'reading' | 'listening' | 'speaking' | 'writing'
  - `theta`: Ability estimate (number)
- **Usage:** Called after Stage 1 completion when MLE calculation finishes
- **Requirement:** 3.4 - Reading section ability calculation

#### 2. setItemParameters(itemId, parameters)
- **Purpose:** Stores IRT parameters for a test item
- **Parameters:**
  - `itemId`: Unique item identifier (string)
  - `parameters`: `{ a: number, b: number, c: number }`
- **Usage:** Called when loading module items from database

#### 3. recordRouting(decision)
- **Purpose:** Records a routing decision for audit trail
- **Parameters:**
  - `decision`: Omit<RoutingDecision, 'timestamp'> & { timestamp?: number }
- **Features:**
  - Auto-generates timestamp if not provided (Date.now())
  - Appends to routingDecisions array
  - Preserves chronological order
- **Requirement:** 8.1 - Adaptive routing based on ability thresholds

#### 4. reset()
- **Purpose:** Resets store to initial state
- **Usage:** Called when starting new exam session or after completion

### Persistence

- **Middleware:** Zustand persist middleware
- **Storage:** localStorage via `createStoreStorage()`
- **Store Name:** `'toefl-ability-store'`
- **Version:** 1
- **Features:**
  - Automatic serialization/deserialization
  - Handles Map and Set types via custom replacer/reviver
  - Survives page refresh and browser crashes

## Routing Thresholds (Requirement 8.1)

The store supports the official MST routing thresholds:

| Ability Range (θ) | Difficulty Tier | Module Selection |
|-------------------|----------------|------------------|
| θ < -0.8          | Easy           | Stage 2 Easy     |
| -0.8 ≤ θ ≤ 0.8    | Medium         | Stage 2 Medium   |
| θ > 0.8           | Hard           | Stage 2 Hard     |

These thresholds are enforced by the MST_Engine, which reads ability estimates from this store.

## Integration Points

### With MST Engine (Backend)
1. After Stage 1 submission, MST_Engine calculates ability using IRT_Scorer
2. Frontend calls `updateAbility(section, theta)` with result
3. Frontend calls `recordRouting()` to log the routing decision
4. MST_Engine uses ability to select appropriate Stage 2 module

### With IRT Scorer (Backend)
1. Frontend loads items and calls `setItemParameters()` for each item
2. IRT_Scorer uses these parameters for MLE calculation
3. Calculated θ is stored via `updateAbility()`

### With Session Manager
1. Session state includes reference to ability estimates
2. On session restore, abilityStore is rehydrated from localStorage
3. On session reset/completion, `reset()` is called

## Test Coverage

The `abilityStore.test.ts` provides comprehensive coverage:

### State Tests
- ✅ Empty initialization
- ✅ Single section ability storage
- ✅ Multiple sections independently
- ✅ Ability estimate updates
- ✅ IRT parameters for single/multiple items
- ✅ IRT parameter updates
- ✅ Routing decision recording
- ✅ Timestamp auto-generation
- ✅ Multiple routing decisions in order

### Action Tests
- ✅ updateAbility for all sections
- ✅ Routing threshold scenarios (Req 8.1)
- ✅ Extreme ability values (-3.0, +3.0)
- ✅ recordRouting with all fields (Req 8.1)
- ✅ Adaptive routing for all difficulty tiers

### Integration Tests
- ✅ Requirement 3.4: Reading section ability calculation
- ✅ Requirement 8.1: Adaptive routing thresholds
- ✅ State persistence across operations
- ✅ Reset functionality

### Edge Cases
- ✅ Ability at exact threshold boundaries (-0.8, 0.8)
- ✅ Zero ability estimate
- ✅ All four sections

## Verification Status

| Requirement | Status | Details |
|-------------|--------|---------|
| State: abilityEstimates | ✅ | Implemented with Partial<Record<AbilitySection, number>> |
| State: irtParameters | ✅ | Implemented with Record<string, IRTParameters> |
| State: routingDecisions | ✅ | Implemented with RoutingDecision[] |
| Action: updateAbility | ✅ | Fully functional with tests |
| Action: recordRouting | ✅ | Fully functional with auto-timestamp |
| Requirement 3.4 | ✅ | Supports Reading section ability estimation |
| Requirement 8.1 | ✅ | Supports adaptive routing thresholds |
| Persistence | ✅ | Zustand persist with localStorage |
| Type Safety | ✅ | No TypeScript diagnostics |
| Test Coverage | ✅ | Comprehensive test suite |

## Usage Example

```typescript
import { useAbilityStore } from '@/stores'

// In a component or hook
function ExamComponent() {
  const updateAbility = useAbilityStore((state) => state.updateAbility)
  const recordRouting = useAbilityStore((state) => state.recordRouting)
  const abilityEstimates = useAbilityStore((state) => state.abilityEstimates)

  // After Stage 1 submission
  const handleStage1Complete = async (section: string, responses: Response[]) => {
    // Backend calculates ability
    const result = await api.calculateAbility(section, responses)
    
    // Update store
    updateAbility(section as AbilitySection, result.theta)
    
    // Record routing decision
    recordRouting({
      section: section as AbilitySection,
      stage: 2,
      ability: result.theta,
      difficulty: result.difficulty
    })
  }
  
  // Display current ability
  return (
    <div>
      <p>Reading Ability: {abilityEstimates.reading?.toFixed(2) ?? 'N/A'}</p>
    </div>
  )
}
```

## Compliance Notes

- **Psychometric Validity:** Store preserves full precision of θ estimates (no rounding)
- **Audit Trail:** routingDecisions provides complete history for analysis
- **Type Safety:** Strongly typed interfaces prevent invalid data
- **Persistence:** Survives page refresh for exam continuity (Requirement 1.3, 1.4)
- **Performance:** Minimal re-renders via Zustand selector optimization

## Status: COMPLETED ✅

All task requirements have been successfully implemented:
- ✅ State defined: abilityEstimates (by section), irtParameters (by item), routingDecisions
- ✅ Actions implemented: updateAbility, recordRouting
- ✅ Requirements 3.4 and 8.1 supported
- ✅ Comprehensive test coverage
- ✅ No TypeScript errors
- ✅ Persistence configured
- ✅ Exported via index.ts

The abilityStore is ready for integration with the MST Engine and exam UI components.
