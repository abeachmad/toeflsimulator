/**
 * GeminiGraderService Usage Examples
 * 
 * Demonstrates how to use the GeminiGraderService for writing and speaking assessments
 */

import { GeminiGraderService, WritingGradeRequest, SpeakingAssessmentRequest } from './GeminiGraderService.js';

// ============================================================================
// Example 1: Basic Setup
// ============================================================================

const apiKey = process.env.GEMINI_API_KEY || 'your-api-key-here';
const geminiGrader = new GeminiGraderService(apiKey);

console.log('Circuit Breaker State:', geminiGrader.getCircuitState());

// ============================================================================
// Example 2: Grade Build Sentence Writing Task
// ============================================================================

async function gradeBuildSentence() {
  const request: WritingGradeRequest = {
    text: 'The student completed the assignment before the deadline.',
    taskType: 'build-sentence'
  };

  try {
    const score = await geminiGrader.gradeWriting(request);
    
    console.log('\n=== Build Sentence Writing Score ===');
    console.log('CEFR Band:', score.cefrBand);
    console.log('Scale Score:', score.scaleScore);
    console.log('Grammar Corrections:', score.grammarCorrections.length);
    console.log('Vocabulary Level:', score.lexicalAnalysis.vocabularyLevel);
    console.log('Lexical Diversity:', score.lexicalAnalysis.lexicalDiversity);
  } catch (error) {
    console.error('Error grading writing:', error);
    const defaultScore = geminiGrader.getDefaultWritingScore();
    console.log('Using default score:', defaultScore);
  }
}

// ============================================================================
// Example 3: Grade Email Writing Task
// ============================================================================

async function gradeEmail() {
  const request: WritingGradeRequest = {
    text: `Dear Professor Smith,

I am writing to request an extension for the research paper due next week. 
I have been experiencing some technical difficulties with my computer that 
have delayed my progress. I would appreciate if I could submit the paper 
by Friday instead of Wednesday.

Thank you for your understanding.

Best regards,
John Doe`,
    taskType: 'email'
  };

  try {
    const score = await geminiGrader.gradeWriting(request);
    
    console.log('\n=== Email Writing Score ===');
    console.log('CEFR Band:', score.cefrBand);
    console.log('Scale Score:', score.scaleScore);
    
    if (score.grammarCorrections.length > 0) {
      console.log('\nGrammar Corrections:');
      score.grammarCorrections.forEach((correction, index) => {
        console.log(`${index + 1}. ${correction.errorType}`);
        console.log(`   Original: "${correction.originalText}"`);
        console.log(`   Corrected: "${correction.correctedText}"`);
        console.log(`   Explanation: ${correction.explanation}`);
      });
    }
    
    console.log('\nLexical Analysis:');
    console.log('- Vocabulary Level:', score.lexicalAnalysis.vocabularyLevel);
    console.log('- Lexical Diversity:', score.lexicalAnalysis.lexicalDiversity);
    console.log('- Academic Word Count:', score.lexicalAnalysis.academicWordCount);
    console.log('- Suggestions:', score.lexicalAnalysis.suggestions);
  } catch (error) {
    console.error('Error grading email:', error);
  }
}

// ============================================================================
// Example 4: Grade Academic Discussion Task
// ============================================================================

async function gradeAcademicDiscussion() {
  const request: WritingGradeRequest = {
    text: `I strongly agree with Dr. Johnson's argument that technology has 
revolutionized education. However, I would add that the digital divide remains 
a significant challenge. While students in developed countries benefit from 
advanced learning tools, many students in developing regions still lack 
basic internet access. To truly democratize education through technology, 
we must address infrastructure gaps and ensure equitable access to digital 
resources. Additionally, teacher training is crucial to maximize the 
effectiveness of educational technology.`,
    taskType: 'academic-discussion',
    professorPrompt: 'Discuss the impact of technology on modern education. Consider both benefits and challenges.',
    peerOpinions: [
      'Technology makes learning more engaging and interactive.',
      'Online resources provide access to information that was previously unavailable.'
    ]
  };

  try {
    const score = await geminiGrader.gradeWriting(request);
    
    console.log('\n=== Academic Discussion Score ===');
    console.log('CEFR Band:', score.cefrBand);
    console.log('Scale Score:', score.scaleScore);
    console.log('Academic Word Count:', score.lexicalAnalysis.academicWordCount);
  } catch (error) {
    console.error('Error grading academic discussion:', error);
  }
}

// ============================================================================
// Example 5: Assess Listen & Repeat Speaking Task
// ============================================================================

async function assessListenRepeat() {
  const request: SpeakingAssessmentRequest = {
    audioPath: '/tmp/speaking-sample.wav',
    referenceText: 'The quick brown fox jumps over the lazy dog.',
    taskType: 'listen-repeat'
  };

  try {
    const score = await geminiGrader.assessPronunciation(request.audioPath, request.referenceText);
    
    console.log('\n=== Listen & Repeat Speaking Score ===');
    console.log('Accuracy Score:', score.accuracyScore);
    console.log('Fluency Score:', score.fluencyScore);
    console.log('Prosody Score:', score.prosodyScore);
    console.log('Completeness Score:', score.completenessScore);
    console.log('CEFR Band:', score.cefrBand);
    console.log('Scale Score:', score.scaleScore);
  } catch (error) {
    console.error('Error assessing pronunciation:', error);
    const defaultScore = geminiGrader.getDefaultSpeakingScore();
    console.log('Using default score:', defaultScore);
  }
}

// ============================================================================
// Example 6: Assess Simulated Interview Speaking Task
// ============================================================================

async function assessSimulatedInterview() {
  const request: SpeakingAssessmentRequest = {
    audioPath: '/tmp/interview-response.wav',
    referenceText: 'Tell me about your educational background and career goals.',
    taskType: 'simulated-interview'
  };

  try {
    const score = await geminiGrader.assessPronunciation(request.audioPath, request.referenceText);
    
    console.log('\n=== Simulated Interview Score ===');
    console.log('Accuracy Score:', score.accuracyScore);
    console.log('Fluency Score:', score.fluencyScore);
    console.log('Prosody Score:', score.prosodyScore);
    console.log('Completeness Score:', score.completenessScore);
    console.log('CEFR Band:', score.cefrBand);
    console.log('Scale Score:', score.scaleScore);
  } catch (error) {
    console.error('Error assessing interview:', error);
  }
}

// ============================================================================
// Example 7: Circuit Breaker with Custom Configuration
// ============================================================================

async function withCustomCircuitBreaker() {
  const customGrader = new GeminiGraderService(apiKey, {
    failureThreshold: 3,      // Open circuit after 3 failures
    successThreshold: 2,      // Close circuit after 2 successes
    timeout: 60000,           // 60 second timeout
    resetTimeout: 30000       // Try again after 30 seconds
  });

  console.log('\n=== Custom Circuit Breaker ===');
  console.log('Initial State:', customGrader.getCircuitState());

  const request: WritingGradeRequest = {
    text: 'Sample text for testing.',
    taskType: 'build-sentence'
  };

  try {
    const score = await customGrader.gradeWriting(request);
    console.log('Score:', score.cefrBand);
    console.log('Circuit State After Success:', customGrader.getCircuitState());
  } catch (error) {
    console.error('Grading failed:', error);
    console.log('Circuit State After Failure:', customGrader.getCircuitState());
  }
}

// ============================================================================
// Example 8: Error Handling with Default Scores
// ============================================================================

async function handleGradingErrors() {
  const request: WritingGradeRequest = {
    text: 'This is a test.',
    taskType: 'build-sentence'
  };

  try {
    const score = await geminiGrader.gradeWriting(request);
    console.log('\n=== Grading Success ===');
    console.log('CEFR Band:', score.cefrBand);
    console.log('Scale Score:', score.scaleScore);
  } catch (error) {
    console.error('\n=== Grading Error - Using Defaults ===');
    console.error('Error:', error);
    
    // Fallback to default score
    const defaultScore = geminiGrader.getDefaultWritingScore();
    console.log('Default CEFR Band:', defaultScore.cefrBand);
    console.log('Default Scale Score:', defaultScore.scaleScore);
    console.log('Error Message:', defaultScore.lexicalAnalysis.suggestions[0]);
  }
}

// ============================================================================
// Example 9: Manual Circuit Reset
// ============================================================================

function manualCircuitReset() {
  console.log('\n=== Manual Circuit Reset ===');
  console.log('State Before Reset:', geminiGrader.getCircuitState());
  
  geminiGrader.resetCircuit();
  
  console.log('State After Reset:', geminiGrader.getCircuitState());
}

// ============================================================================
// Example 10: Batch Processing with Error Recovery
// ============================================================================

async function batchProcessWriting() {
  const requests: WritingGradeRequest[] = [
    { text: 'First sample text.', taskType: 'build-sentence' },
    { text: 'Second sample text.', taskType: 'email' },
    { text: 'Third sample text.', taskType: 'academic-discussion' }
  ];

  console.log('\n=== Batch Processing ===');
  
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    if (!request) continue;
    
    try {
      const score = await geminiGrader.gradeWriting(request);
      console.log(`Request ${i + 1}: CEFR ${score.cefrBand}, Scale ${score.scaleScore}`);
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error);
      const defaultScore = geminiGrader.getDefaultWritingScore();
      console.log(`Request ${i + 1}: Using defaults - CEFR ${defaultScore.cefrBand}, Scale ${defaultScore.scaleScore}`);
    }
  }
}

// ============================================================================
// Run Examples (Uncomment to test)
// ============================================================================

// Note: Actual API calls require a valid GEMINI_API_KEY environment variable
// and will consume API quota. Uncomment selectively for testing.

// gradeBuildSentence();
// gradeEmail();
// gradeAcademicDiscussion();
// assessListenRepeat();
// assessSimulatedInterview();
// withCustomCircuitBreaker();
// handleGradingErrors();
// manualCircuitReset();
// batchProcessWriting();

export {
  gradeBuildSentence,
  gradeEmail,
  gradeAcademicDiscussion,
  assessListenRepeat,
  assessSimulatedInterview,
  withCustomCircuitBreaker,
  handleGradingErrors,
  manualCircuitReset,
  batchProcessWriting
};
