/**
 * MSTEngine Usage Examples
 * 
 * This file demonstrates how to use the MSTEngine class for adaptive testing
 */

import { Pool } from 'pg';
import { MSTEngine } from './MSTEngine.js';
import { IRT3PLScorer } from './IRT3PLScorer.js';
import { ItemResponse } from '../models/irt.types.js';

// Example 1: Basic Adaptive Routing Flow
async function example1_BasicRoutingFlow() {
  console.log('\n=== Example 1: Basic Adaptive Routing Flow ===\n');

  // Initialize database connection and services
  // Credentials must come from environment variables — never hardcoded.
  // For local development, set these in backend/.env
  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'toefl_simulator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,   // set DB_PASSWORD in .env
  });

  const mstEngine = new MSTEngine(db);
  const irtScorer = new IRT3PLScorer(db);

  // Stage 1: Present medium difficulty module
  console.log('Stage 1: Loading medium difficulty module...');
  const stage1Module = await mstEngine.selectNextModule(1, 'medium', 'reading');
  
  if (!stage1Module) {
    console.error('No Stage 1 module available');
    return;
  }

  console.log(`Stage 1 Module: ${stage1Module.moduleId}`);
  console.log(`Items: ${stage1Module.items.length}`);

  // Simulate test taker responses to Stage 1
  const stage1Responses: ItemResponse[] = [
    { itemId: 'item-1', isCorrect: true },
    { itemId: 'item-2', isCorrect: true },
    { itemId: 'item-3', isCorrect: false },
    { itemId: 'item-4', isCorrect: true },
    { itemId: 'item-5', isCorrect: true }
  ];

  // Calculate ability estimate from Stage 1 responses
  console.log('\nCalculating ability estimate from Stage 1 responses...');
  const abilityEstimate = irtScorer.estimateAbilityMLE(
    stage1Responses,
    stage1Module.items
  );
  console.log(`Estimated ability (θ): ${abilityEstimate.toFixed(3)}`);

  // Stage 2: Route to appropriate difficulty based on ability
  console.log('\nStage 2: Routing to appropriate difficulty...');
  const routingDecision = mstEngine.routeToModule(abilityEstimate, 'reading');
  console.log(`Routing decision: ${routingDecision.difficulty} difficulty`);

  // Load Stage 2 module with fallback
  const stage2Module = await mstEngine.selectNextModuleWithFallback(
    2,
    routingDecision.difficulty,
    'reading'
  );

  console.log(`\nStage 2 Module: ${stage2Module.moduleId}`);
  console.log(`Items: ${stage2Module.items.length}`);

  // Validate no content overlap between stages
  const noOverlap = mstEngine.validateNoOverlap(
    stage1Module.items,
    stage2Module.items
  );
  console.log(`Content validation: ${noOverlap ? 'No overlap' : 'Overlap detected!'}`);

  await db.end();
}

// Example 2: Routing Decision Boundaries
function example2_RoutingBoundaries() {
  console.log('\n=== Example 2: Routing Decision Boundaries ===\n');

  const db = new Pool();
  const mstEngine = new MSTEngine(db);

  // Test various ability levels
  const testAbilities = [
    -3.0,  // Very low
    -1.0,  // Low
    -0.8,  // Lower threshold (should be medium)
    0.0,   // Average
    0.8,   // Upper threshold (should be medium)
    1.5,   // High
    3.0    // Very high
  ];

  console.log('Ability (θ) | Routed Difficulty');
  console.log('--------------------------------');
  
  testAbilities.forEach(ability => {
    const decision = mstEngine.routeToModule(ability, 'listening');
    console.log(`${ability.toFixed(1).padStart(11)} | ${decision.difficulty}`);
  });
}

// Example 3: Fallback Mechanism
async function example3_FallbackMechanism() {
  console.log('\n=== Example 3: Fallback Mechanism ===\n');

  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'toefl_simulator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,   // set DB_PASSWORD in .env
  });

  const mstEngine = new MSTEngine(db);

  try {
    // Try to load a hard module (might not be available)
    console.log('Attempting to load hard module with fallback...');
    const module = await mstEngine.selectNextModuleWithFallback(
      2,
      'hard',
      'listening'
    );

    console.log(`Success! Loaded module: ${module.moduleId}`);
    console.log(`Actual difficulty: ${module.difficulty}`);
    
    if (module.difficulty !== 'hard') {
      console.log('Note: Fallback was used due to unavailability');
    }
  } catch (error) {
    console.error('All fallbacks failed:', error);
  }

  await db.end();
}

// Example 4: Manual Routing Override
function example4_RoutingOverride() {
  console.log('\n=== Example 4: Manual Routing Override ===\n');

  const db = new Pool();
  const mstEngine = new MSTEngine(db);

  // Calculate routing decision
  const ability = 1.2; // High ability → should route to hard
  const originalDecision = mstEngine.routeToModule(ability, 'reading');
  
  console.log(`Original decision: ${originalDecision.difficulty}`);

  // Override due to test design constraint
  const overriddenDecision = mstEngine.overrideRouting(
    originalDecision,
    'medium',
    'Limited hard items available for this test form'
  );

  console.log(`Overridden decision: ${overriddenDecision.difficulty}`);
}

// Example 5: Adaptive Sections Check
function example5_AdaptiveSectionsCheck() {
  console.log('\n=== Example 5: Adaptive Sections Check ===\n');

  const db = new Pool();
  const mstEngine = new MSTEngine(db);

  const sections: Array<'reading' | 'listening' | 'writing' | 'speaking'> = [
    'reading',
    'listening',
    'writing',
    'speaking'
  ];

  console.log('Section   | Adaptive Routing?');
  console.log('-----------------------------');
  
  sections.forEach(section => {
    const isAdaptive = mstEngine.isAdaptiveSection(section);
    console.log(`${section.padEnd(10)} | ${isAdaptive ? 'Yes' : 'No'}`);
  });
}

// Example 6: Complete Exam Flow
async function example6_CompleteExamFlow() {
  console.log('\n=== Example 6: Complete Exam Flow (Reading Section) ===\n');

  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'toefl_simulator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,   // set DB_PASSWORD in .env
  });

  const mstEngine = new MSTEngine(db);
  const irtScorer = new IRT3PLScorer(db);

  try {
    // Check if reading section uses adaptive routing
    if (!mstEngine.isAdaptiveSection('reading')) {
      console.log('Reading section does not use adaptive routing');
      return;
    }

    // Stage 1: Always start with medium difficulty
    console.log('📚 Stage 1: Loading medium difficulty module...');
    const stage1Module = await mstEngine.selectNextModuleWithFallback(
      1,
      'medium',
      'reading'
    );
    console.log(`   Module ID: ${stage1Module.moduleId}`);
    console.log(`   Items: ${stage1Module.items.length}`);

    // Simulate test taker taking Stage 1
    console.log('\n👤 Test taker completing Stage 1...');
    const stage1Responses: ItemResponse[] = stage1Module.items.map((item) => ({
      itemId: item.id,
      isCorrect: Math.random() > 0.3 // 70% correct rate (high performer)
    }));

    // Calculate ability
    console.log('\n🧮 Estimating ability from Stage 1 performance...');
    const theta = irtScorer.estimateAbilityMLE(stage1Responses, stage1Module.items);
    console.log(`   θ = ${theta.toFixed(3)}`);

    // Route to Stage 2
    console.log('\n🎯 Routing to Stage 2...');
    const routing = mstEngine.routeToModule(theta, 'reading');
    console.log(`   Difficulty: ${routing.difficulty}`);

    // Load Stage 2 module
    console.log('\n📚 Stage 2: Loading routed module...');
    const stage2Module = await mstEngine.selectNextModuleWithFallback(
      2,
      routing.difficulty,
      'reading'
    );
    console.log(`   Module ID: ${stage2Module.moduleId}`);
    console.log(`   Items: ${stage2Module.items.length}`);

    // Validate content integrity
    console.log('\n✓ Validating content integrity...');
    const valid = mstEngine.validateNoOverlap(stage1Module.items, stage2Module.items);
    console.log(`   Result: ${valid ? 'PASS - No duplicate items' : 'FAIL - Overlap detected!'}`);

    // Simulate Stage 2
    console.log('\n👤 Test taker completing Stage 2...');
    const stage2Responses: ItemResponse[] = stage2Module.items.map((item) => ({
      itemId: item.id,
      isCorrect: Math.random() > 0.4 // 60% correct for harder module
    }));

    // Final ability estimate
    console.log('\n🧮 Final ability estimation...');
    const allResponses = [...stage1Responses, ...stage2Responses];
    const allItems = [...stage1Module.items, ...stage2Module.items];
    const finalTheta = irtScorer.estimateAbilityMLE(allResponses, allItems);
    console.log(`   Final θ = ${finalTheta.toFixed(3)}`);

    // Convert to scores
    const cefrBand = await irtScorer.convertToCEFR(finalTheta, 'reading');
    const scaleScore = await irtScorer.convertToScaleScore(finalTheta, 'reading');

    console.log('\n📊 Final Scores:');
    console.log(`   CEFR Band: ${cefrBand}/6`);
    console.log(`   Scale Score: ${scaleScore}/30`);

  } catch (error) {
    console.error('Error in exam flow:', error);
  } finally {
    await db.end();
  }
}

// Run examples
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   MSTEngine Usage Examples                 ║');
  console.log('╚════════════════════════════════════════════╝');

  // Simple examples that don't require database
  example2_RoutingBoundaries();
  example4_RoutingOverride();
  example5_AdaptiveSectionsCheck();

  // Database examples (uncomment if database is available)
  // await example1_BasicRoutingFlow();
  // await example3_FallbackMechanism();
  // await example6_CompleteExamFlow();

  console.log('\n✓ All examples completed!\n');
}

// Execute examples if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

export {
  example1_BasicRoutingFlow,
  example2_RoutingBoundaries,
  example3_FallbackMechanism,
  example4_RoutingOverride,
  example5_AdaptiveSectionsCheck,
  example6_CompleteExamFlow
};
