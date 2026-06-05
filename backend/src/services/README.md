# Backend Services

This directory contains the core business logic services for the TOEFL iBT 2026 Test Simulator backend.

## IRT3PLScorer

The `IRT3PLScorer` service implements the **3-Parameter Logistic (3PL) Item Response Theory** model for psychometric scoring and ability estimation.

### Features

- **3PL Probability Calculation**: Computes the probability of a correct response given ability (θ) and item parameters (a, b, c)
- **Maximum Likelihood Estimation**: Estimates examinee ability using Newton-Raphson iterative method
- **Score Conversion**: Converts ability estimates to CEFR bands (1-6) and scale scores (0-30)
- **Score Clamping**: Ensures all scores fall within valid ranges
- **Database Integration**: Uses PostgreSQL for CEFR/scale score conversion tables with fallback logic

### Usage

```typescript
import { pool } from '../config/database.js';
import { IRT3PLScorer } from './IRT3PLScorer.js';
import { Item, ItemResponse } from '../models/irt.types.js';

// Initialize scorer with database pool
const irtScorer = new IRT3PLScorer(pool);

// Define test items with IRT parameters
const items: Item[] = [
  {
    id: 'item-1',
    section: 'reading',
    type: 'multiple-choice',
    difficulty_level: 'medium',
    content: 'Test question',
    correct_answer: 'A',
    irt_parameters: { a: 1.0, b: -0.5, c: 0.2 }
  }
];

// Student responses
const responses: ItemResponse[] = [
  { itemId: 'item-1', isCorrect: true }
];

// Estimate ability
const theta = irtScorer.estimateAbilityMLE(responses, items);

// Convert to CEFR and scale scores
const cefrBand = await irtScorer.convertToCEFR(theta, 'reading');
const scaleScore = await irtScorer.convertToScaleScore(theta, 'reading');

// Clamp scores to valid ranges
const scores = irtScorer.clampScores({ cefrBand, scaleScore });
```

### Methods

#### `calculate3PLProbability(theta, a, b, c): number`
Calculates the probability of a correct response using the 3PL formula:

```
P(θ) = c + (1-c) / (1 + exp(-1.702*a*(θ-b)))
```

**Parameters:**
- `theta`: Ability parameter (-3 to +3)
- `a`: Discrimination parameter (0.5 to 2.5)
- `b`: Difficulty parameter (-3 to +3)
- `c`: Guessing parameter (0.0 to 0.3)

**Returns:** Probability (0 to 1)

#### `estimateAbilityMLE(responses, items): number`
Estimates examinee ability using Maximum Likelihood Estimation with Newton-Raphson method.

**Parameters:**
- `responses`: Array of item responses with correctness
- `items`: Array of items with IRT parameters

**Returns:** Estimated ability θ (clamped to [-3, 3])

**Algorithm:**
- Max iterations: 50
- Convergence criterion: 0.001
- Initial estimate: θ = 0

#### `convertToCEFR(theta, section): Promise<number>`
Converts ability estimate to CEFR band (1-6) using database lookup.

**Parameters:**
- `theta`: Ability estimate
- `section`: Test section ('reading', 'listening', 'writing', 'speaking')

**Returns:** CEFR band (1-6)

**Fallback:** Linear mapping if database lookup fails

#### `convertToScaleScore(theta, section): Promise<number>`
Converts ability estimate to scale score (0-30) using database lookup.

**Parameters:**
- `theta`: Ability estimate
- `section`: Test section

**Returns:** Scale score (0-30)

**Fallback:** Linear interpolation if database lookup fails

#### `clampScores(scores): ScoreResult`
Clamps scores to valid ranges.

**Parameters:**
- `scores`: Object with `cefrBand` and `scaleScore`

**Returns:** Clamped scores with:
- `cefrBand`: [1-6]
- `scaleScore`: [0-30]

### Requirements Validation

This service validates the following requirements:

- **7.1**: 3PL model implementation with a, b, c parameters
- **7.2**: 3PL probability formula: P(θ) = c + (1-c) / (1 + exp(-1.702*a*(θ-b)))
- **7.3**: Maximum Likelihood Estimation for ability calculation
- **7.4**: Database storage of IRT parameters in JSONB
- **5.6**: CEFR band clamping [1-6]
- **5.7**: Scale score clamping [0-30]
- **9.1**: CEFR band calculation
- **9.2**: Scale score calculation
- **9.3**: Official ETS 2026 conversion table usage

### Testing

Run tests with:
```bash
npm test -- IRT3PLScorer.test.ts
```

The test suite includes:
- 27 unit tests covering all methods
- Edge case testing for extreme parameters
- Database lookup and fallback testing
- Score clamping validation
- Ability estimation accuracy verification

### Database Schema

The service expects a `cefr_conversion` table:

```sql
CREATE TABLE cefr_conversion (
  section VARCHAR(20) NOT NULL,
  theta_min DECIMAL(5,3) NOT NULL,
  theta_max DECIMAL(5,3) NOT NULL,
  cefr_band INTEGER NOT NULL CHECK (cefr_band BETWEEN 1 AND 6),
  scale_score INTEGER NOT NULL CHECK (scale_score BETWEEN 0 AND 30),
  PRIMARY KEY (section, theta_min, theta_max)
);

CREATE INDEX idx_cefr_section_theta ON cefr_conversion(section, theta_min, theta_max);
```

### Performance

- **Ability estimation**: O(n × m) where n = iterations, m = response count
- **Probability calculation**: O(1)
- **Database conversions**: O(1) with index lookup
- **Fallback calculations**: O(1)

Typical performance:
- 10 items: ~1ms for ability estimation
- Database lookup: <5ms with proper indexing
- Total scoring time: <10ms per section

### Error Handling

The service implements graceful degradation:
- **Empty responses**: Returns θ = 0
- **Missing items**: Skips in MLE calculation
- **Database errors**: Falls back to linear interpolation
- **Extreme values**: Clamps to valid ranges
- **Near-zero derivatives**: Breaks iteration early

All errors are logged with context for debugging.
