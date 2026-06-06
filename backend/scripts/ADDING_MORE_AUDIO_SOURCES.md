# Adding More Audio Sources - Developer Guide

This guide explains how to extend the audio ingestion system with additional sources.

## Current Status

✅ **Successfully Integrated:**
- Magoosh Official Practice (5 items, 2 audio files)
- Database has 149 total listening items
- 105 items have audio URLs
- 2 audio files downloaded (6.59 MB total)

## Architecture Overview

### File Structure

```
backend/
├── scripts/
│   ├── ingest-audio-listening-sources.ts  ← Main ingestion script
│   ├── verify-audio-ingestion.ts          ← Verification tool
│   └── ADDING_MORE_AUDIO_SOURCES.md       ← This file
├── uploads/
│   └── audio/                             ← Audio storage
└── src/
    └── config/database.ts                 ← Database connection
```

### Data Flow

```
Audio Source (URL/GitHub/RAR)
    ↓
Download/Extract
    ↓
Store in uploads/audio/
    ↓
Create ListeningItem objects
    ↓
Insert into database (test_items table)
    ↓
Frontend fetches via /audio/ endpoint
```

## Adding a New Source

### Step 1: Create Fetch Function

Add a new async function in `ingest-audio-listening-sources.ts`:

```typescript
/**
 * SOURCE 4: Your New Source Name
 * Description of what this source provides
 */
async function fetchYourNewSource(): Promise<ListeningItem[]> {
  console.log('\n📥 [4/4] Fetching Your New Source...');
  
  const items: ListeningItem[] = [];
  
  try {
    // Your fetching logic here
    const audioUrl = 'https://example.com/audio.mp3';
    const filename = 'your-source-1.mp3';
    const audioPath = path.join(AUDIO_DIR, filename);
    
    // Download audio
    console.log(`   Downloading: ${filename}...`);
    await downloadFile(audioUrl, audioPath);
    console.log(`   ✓ Downloaded: ${filename}`);
    
    // Create listening items
    items.push({
      item_id: `your-source-1-q1`,
      section: 'listening',
      type: 'conversation', // or 'academic-lecture'
      stage: 1, // 1 or 2
      difficulty_level: 'medium', // 'easy', 'medium', or 'hard'
      content: `[Listen to the audio]\n\nYour question text here?`,
      options: [
        'Option A',
        'Option B', 
        'Option C',
        'Option D'
      ],
      correct_answer: '0', // Index: '0', '1', '2', or '3'
      irt_parameters: generateIRT('medium'),
      metadata: {
        source: 'Your Source Name',
        audio_url: `/audio/${filename}`,
        audio_filename: filename,
        topic: 'Topic description',
        duration: 120 // seconds (optional)
      }
    });
    
    console.log(`✓ Processed ${items.length} items from Your Source`);
  } catch (error) {
    console.log(`   ⚠ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
  
  return items;
}
```

### Step 2: Add to Main Function

In the `main()` function, add your new source:

```typescript
async function main() {
  // ... existing code ...
  
  allItems.push(...await fetchMagooshAudio());
  allItems.push(...await fetchMarksentenceRepo());
  allItems.push(...await processEduersListeningPack());
  allItems.push(...await fetchYourNewSource()); // ← Add this line
  
  // ... rest of the function ...
}
```

### Step 3: Test Your Source

```bash
npm run ingest-audio
npx tsx scripts/verify-audio-ingestion.ts
```

## Common Source Types

### Type 1: Direct MP3 URLs

For sources with direct audio URLs (like Magoosh):

```typescript
async function fetchDirectMP3Source(): Promise<ListeningItem[]> {
  const audioSources = [
    {
      url: 'https://example.com/audio1.mp3',
      filename: 'source-audio-1.mp3',
      type: 'conversation',
      difficulty: 'medium' as const,
      questions: [
        {
          question: 'What is the main topic?',
          options: ['A', 'B', 'C', 'D'],
          correct: '0'
        }
      ]
    }
  ];
  
  const items: ListeningItem[] = [];
  
  for (const source of audioSources) {
    const audioPath = path.join(AUDIO_DIR, source.filename);
    await downloadFile(source.url, audioPath);
    
    source.questions.forEach((q, idx) => {
      items.push({
        item_id: `source-${idx + 1}`,
        section: 'listening',
        type: source.type,
        stage: source.difficulty === 'easy' ? 1 : 2,
        difficulty_level: source.difficulty,
        content: `[Listen to the audio]\n\n${q.question}`,
        options: q.options,
        correct_answer: q.correct,
        irt_parameters: generateIRT(source.difficulty),
        metadata: {
          source: 'Your Source',
          audio_url: `/audio/${source.filename}`,
          audio_filename: source.filename
        }
      });
    });
  }
  
  return items;
}
```

### Type 2: GitHub Repository

For sources hosted on GitHub:

```typescript
async function fetchGitHubRepo(): Promise<ListeningItem[]> {
  const items: ListeningItem[] = [];
  
  // Fetch repository file listing
  const repoUrl = 'https://api.github.com/repos/username/repo/contents/audio';
  const response = await fetchUrl(repoUrl);
  const files = JSON.parse(response);
  
  // Filter for audio files
  const audioFiles = files.filter((f: any) => 
    f.name.endsWith('.mp3') || f.name.endsWith('.wav')
  );
  
  // Download each file
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    const filename = `github-source-${i + 1}${path.extname(file.name)}`;
    const audioPath = path.join(AUDIO_DIR, filename);
    
    await downloadFile(file.download_url, audioPath);
    
    // Create items for this audio
    items.push({
      item_id: `github-${i + 1}-q1`,
      section: 'listening',
      type: 'conversation',
      stage: 1,
      difficulty_level: 'medium',
      content: `[Listen to the audio]\n\nQuestion about ${file.name}?`,
      options: ['A', 'B', 'C', 'D'],
      correct_answer: '0',
      irt_parameters: generateIRT('medium'),
      metadata: {
        source: 'GitHub Repository',
        audio_url: `/audio/${filename}`,
        audio_filename: filename
      }
    });
  }
  
  return items;
}
```

### Type 3: Archive Files (ZIP/RAR)

For compressed archives (requires manual extraction):

```typescript
async function processArchiveSource(): Promise<ListeningItem[]> {
  console.log('\n📥 Processing Archive Source...');
  console.log(`
   ⚠ MANUAL STEP REQUIRED:
   
   1. Download: https://example.com/audio-pack.zip
   2. Extract to: ${AUDIO_DIR}
   3. Re-run: npm run ingest-audio
  `);
  
  const items: ListeningItem[] = [];
  
  // Check for manually extracted files
  if (fs.existsSync(AUDIO_DIR)) {
    const files = fs.readdirSync(AUDIO_DIR);
    const audioFiles = files.filter(f => 
      f.startsWith('archive-prefix-') && f.endsWith('.mp3')
    );
    
    audioFiles.forEach((filename, i) => {
      items.push({
        item_id: `archive-${i + 1}-q1`,
        section: 'listening',
        type: 'conversation',
        stage: 1,
        difficulty_level: 'medium',
        content: `[Listen to the audio]\n\nQuestion?`,
        options: ['A', 'B', 'C', 'D'],
        correct_answer: '0',
        irt_parameters: generateIRT('medium'),
        metadata: {
          source: 'Archive Source',
          audio_url: `/audio/${filename}`,
          audio_filename: filename
        }
      });
    });
  }
  
  return items;
}
```

### Type 4: JSON Manifest

For sources with a JSON manifest file listing audio and questions:

```typescript
async function fetchJSONManifest(): Promise<ListeningItem[]> {
  const manifestUrl = 'https://example.com/audio-manifest.json';
  const manifestData = await fetchUrl(manifestUrl);
  const manifest = JSON.parse(manifestData);
  
  const items: ListeningItem[] = [];
  
  for (const item of manifest.items) {
    const filename = `manifest-${item.id}.mp3`;
    const audioPath = path.join(AUDIO_DIR, filename);
    
    // Download audio
    await downloadFile(item.audioUrl, audioPath);
    
    // Create listening items
    item.questions.forEach((q: any, idx: number) => {
      items.push({
        item_id: `manifest-${item.id}-q${idx + 1}`,
        section: 'listening',
        type: item.type || 'conversation',
        stage: item.stage || 1,
        difficulty_level: item.difficulty || 'medium',
        content: `[Listen to the audio]\n\n${q.text}`,
        options: q.options,
        correct_answer: String(q.correctIndex),
        irt_parameters: generateIRT(item.difficulty || 'medium'),
        metadata: {
          source: 'JSON Manifest Source',
          audio_url: `/audio/${filename}`,
          audio_filename: filename,
          transcript: item.transcript
        }
      });
    });
  }
  
  return items;
}
```

## Best Practices

### 1. Error Handling

Always wrap in try-catch and provide fallbacks:

```typescript
try {
  await downloadFile(url, path);
} catch (error) {
  console.log(`   ✗ Failed to download: ${error.message}`);
  // Don't throw - continue with other sources
  return items; // Return what we have so far
}
```

### 2. Progress Reporting

Show progress for user feedback:

```typescript
for (let i = 0; i < audioFiles.length; i++) {
  console.log(`   Downloading ${i + 1}/${audioFiles.length}: ${file.name}...`);
  // ... download logic ...
  console.log(`   ✓ Downloaded: ${file.name}`);
}
```

### 3. Rate Limiting

Avoid overwhelming servers:

```typescript
async function downloadWithDelay(url: string, path: string, delayMs: number = 1000) {
  await downloadFile(url, path);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}
```

### 4. Duplicate Prevention

Use unique IDs:

```typescript
const item_id = `${sourceName}-${timestamp}-${index}-q${questionNum}`;
```

The database handles duplicates with `ON CONFLICT` clause.

### 5. Metadata Richness

Include as much metadata as possible:

```typescript
metadata: {
  source: 'Source Name',
  audio_url: `/audio/${filename}`,
  audio_filename: filename,
  topic: 'Specific topic',
  duration: 180, // seconds
  transcript: 'Full transcript',
  speaker: 'Professor/Student',
  accent: 'American/British',
  speed: 'normal/slow/fast',
  context: 'classroom/office/library'
}
```

## Testing New Sources

### 1. Dry Run Test

Create a test version that doesn't download:

```typescript
async function testYourSource() {
  console.log('Testing source without downloads...');
  
  // Simulate item creation
  const mockItems: ListeningItem[] = [{
    item_id: 'test-1',
    // ... rest of item
  }];
  
  console.log(`Would create ${mockItems.length} items`);
  console.log('Sample item:', JSON.stringify(mockItems[0], null, 2));
}
```

### 2. Single File Test

Test with just one audio file first:

```typescript
// In your fetch function
const MAX_TEST_FILES = 1; // Set to 1 for testing

for (let i = 0; i < Math.min(audioFiles.length, MAX_TEST_FILES); i++) {
  // ... download logic ...
}
```

### 3. Verify Results

```bash
# Run verification
npx tsx scripts/verify-audio-ingestion.ts

# Check specific source
npx tsx -e "
import { pool } from './src/config/database.js';
const result = await pool.query(
  \"SELECT COUNT(*) FROM test_items WHERE metadata->>'source' = 'Your Source'\"
);
console.log(result.rows[0]);
await pool.end();
"
```

## Potential Audio Sources

Here are some open-source audio sources you might consider:

### 1. LibriVox
- **URL**: https://librivox.org/
- **License**: Public domain
- **Content**: Audiobook recordings
- **Use case**: Reading comprehension, listening practice

### 2. Common Voice
- **URL**: https://commonvoice.mozilla.org/
- **License**: CC0
- **Content**: Crowdsourced voice recordings
- **Use case**: Pronunciation, dictation

### 3. Tatoeba
- **URL**: https://tatoeba.org/
- **License**: Various open licenses
- **Content**: Sentence recordings in multiple languages
- **Use case**: Sentence comprehension

### 4. YouTube Audio Library
- **URL**: https://studio.youtube.com/
- **License**: Royalty-free
- **Content**: Background music and sound effects
- **Use case**: Listening environment simulation

### 5. Free Spoken Digit Dataset
- **URL**: https://github.com/Jakobovski/free-spoken-digit-dataset
- **License**: CC-BY-SA 4.0
- **Content**: Audio recordings of digits
- **Use case**: Number recognition practice

### 6. VoxCeleb
- **URL**: https://www.robots.ox.ac.uk/~vgg/data/voxceleb/
- **License**: CC-BY 4.0
- **Content**: Celebrity speech samples
- **Use case**: Speaker identification, accent practice

## Troubleshooting

### Download Fails

**Problem**: Network errors, timeouts

**Solution**:
```typescript
async function downloadWithRetry(url: string, path: string, maxRetries: number = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await downloadFile(url, path);
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`   Retry ${i + 1}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
```

### Large Files

**Problem**: Memory issues with large audio files

**Solution**: Stream processing
```typescript
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

async function downloadLargeFile(url: string, outputPath: string) {
  const response = await fetch(url);
  if (!response.body) throw new Error('No response body');
  
  const fileStream = createWriteStream(outputPath);
  await pipeline(response.body, fileStream);
}
```

### API Rate Limits

**Problem**: GitHub API rate limiting

**Solution**: Use authentication
```typescript
const headers = {
  'Authorization': `token ${process.env.GITHUB_TOKEN}`,
  'User-Agent': 'TOEFL-Simulator'
};

const response = await fetch(url, { headers });
```

## Performance Optimization

### Parallel Downloads

```typescript
async function downloadParallel(urls: string[], maxConcurrent: number = 3) {
  const chunks = [];
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    chunks.push(urls.slice(i, i + maxConcurrent));
  }
  
  for (const chunk of chunks) {
    await Promise.all(chunk.map(url => downloadFile(url, getPath(url))));
  }
}
```

### Caching

```typescript
function shouldDownload(filename: string): boolean {
  const filePath = path.join(AUDIO_DIR, filename);
  if (fs.existsSync(filePath)) {
    console.log(`   ⏭ Skipping (already exists): ${filename}`);
    return false;
  }
  return true;
}
```

## Next Steps

1. ✅ Review existing sources
2. ✅ Identify new audio sources
3. ✅ Test with single file
4. ✅ Implement full source
5. ✅ Verify with verification script
6. ✅ Document source in AUDIO_SOURCES_SUMMARY.md
7. ✅ Update AUDIO_INGESTION_README.md

Happy coding! 🎵
