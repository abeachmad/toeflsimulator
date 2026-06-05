/**
 * Example usage of IRT3PLScorer
 * This file demonstrates how to use the IRT3PLScorer service
 */

import { pool } from '../config/database.js';
import { IRT3PLScorer } from './IRT3PLScorer.js';
import { Item, ItemResponse, Section } from '../models/irt.types.js';

/**
 * Example: Calculate ability estimate and convert to scores
 */
export async function exampleAbilityEstimation() {
  // Initialize the scorer with database pool
  const irtScorer = new IRT3PLScorer(pool);

  // Example test items with IRT parameters
  const items: Item[] = [
    {
      id: 'item-1',
      section: 'reading' as Section,
      type: 'multiple-choice',
      difficulty_level: 'medium',
      content: 'Sample reading question',
      correct_answer: 'A',
      irt_parameters: { a: 1.0, b: -0.5, c: 0.2 }
    },
    {
      id: 'item-2',
      section: 'reading' as Section,
      type: 'multiple-choice',
      difficulty_level: 'medium',
      content: 'Another reading question',
      correct_answer: 'B',
      irt_parameters: { a: 1.5, b: 0.3, c: 0.25 }
    },
    {
      id: 'item-3',
      section: 'reading' as Section,
      type: 'multiple-choice',
      difficulty_level: 'hard',
      content: 'Difficult reading question',
      correct_answer: 'C',
      irt_parameters: { a: 1.8, b: 1.2, c: 0.2 }
    }
  ];

  // Example student responses
  const responses: ItemResponse[] = [
    { itemId: 'item-1', isCorrect: true },
    { itemId: 'item-2', isCorrect: true },
    { itemId: 'item-3', isCorrect: false }
  ];

  // Step 1: Estimate ability using Maximum Likelihood Estimation
  const theta = irtScorer.estimateAbilityMLE(responses, items);
  console.log(`Estimated ability (θ): ${theta.toFixed(3)}`);

  // Step 2: Convert ability to CEFR band
  const cefrBand = await irtScorer.convertToCEFR(theta, 'reading');
  console.log(`CEFR Band: ${cefrBand}`);

  // Step 3: Convert ability to scale score
  const scaleScore = await irtScorer.convertToScaleScore(theta, 'reading');
  console.log(`Scale Score: ${scaleScore}/30`);

  // Step 4: Ensure scores are within valid ranges
  const clampedScores = irtScorer.clampScores({ cefrBand, scaleScore });
  console.log(`Clamped CEFR Band: ${clampedScores.cefrBand}`);
  console.log(`Clamped Scale Score: ${clampedScores.scaleScore}`);

  return {
    theta,
    cefrBand: clampedScores.cefrBand,
    scaleScore: clampedScores.scaleScore
  };
}

/**
 * Example: Calculate probability for a specific item
 */
export function exampleProbabilityCalculation() {
  const irtScorer = new IRT3PLScorer(pool);

  // Student with medium ability
  const theta = 0.5;

  // Item parameters
  const a = 1.2; // discrimination
  const b = 0.0; // difficulty
  const c = 0.2; // guessing

  // Calculate probability of correct response
  const probability = irtScorer.calculate3PLProbability(theta, a, b, c);
  console.log(`Probability of correct response: ${(probability * 100).toFixed(1)}%`);

  return probability;
}

/**
 * Example: Score clamping for AI-graded responses
 */
export function exampleScoreClamping() {
  const irtScorer = new IRT3PLScorer(pool);

  // Simulate AI grader returning out-of-range scores
  const aiGraderOutput = {
    cefrBand: 8, // Invalid - should be 1-6
    scaleScore: 35 // Invalid - should be 0-30
  };

  // Clamp to valid ranges
  const validScores = irtScorer.clampScores(aiGraderOutput);
  console.log(`Original CEFR: ${aiGraderOutput.cefrBand}, Clamped: ${validScores.cefrBand}`);
  console.log(`Original Scale: ${aiGraderOutput.scaleScore}, Clamped: ${validScores.scaleScore}`);

  return validScores;
}

// Uncomment to run examples:
// (async () => {
//   console.log('=== Ability Estimation Example ===');
//   await exampleAbilityEstimation();
//   
//   console.log('\n=== Probability Calculation Example ===');
//   exampleProbabilityCalculation();
//   
//   console.log('\n=== Score Clamping Example ===');
//   exampleScoreClamping();
// })();
