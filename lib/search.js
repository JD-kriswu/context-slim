/**
 * Simple vector search using TF-IDF
 * No external dependencies required
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Tokenize text into words
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, ' ')  // Keep alphanumeric and Chinese
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// Calculate term frequency
function termFrequency(tokens) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  // Normalize
  const max = Math.max(...Object.values(tf));
  for (const token in tf) {
    tf[token] /= max;
  }
  return tf;
}

// Calculate IDF from document collection
function inverseDocumentFrequency(documents) {
  const idf = {};
  const N = documents.length;
  
  // Count documents containing each term
  const docFreq = {};
  for (const doc of documents) {
    const seen = new Set();
    for (const token of doc.tokens) {
      if (!seen.has(token)) {
        docFreq[token] = (docFreq[token] || 0) + 1;
        seen.add(token);
      }
    }
  }
  
  // Calculate IDF
  for (const token in docFreq) {
    idf[token] = Math.log(N / docFreq[token]) + 1;
  }
  
  return idf;
}

// Calculate TF-IDF vector
function tfidfVector(tf, idf, vocabulary) {
  const vector = [];
  for (const term of vocabulary) {
    const tfidf = (tf[term] || 0) * (idf[term] || 0);
    vector.push(tfidf);
  }
  return vector;
}

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Build search index from documents
export function buildIndex(documents) {
  // Tokenize all documents
  const docs = documents.map(doc => ({
    ...doc,
    tokens: tokenize(doc.text),
    tf: null
  }));
  
  // Calculate TF for each document
  for (const doc of docs) {
    doc.tf = termFrequency(doc.tokens);
  }
  
  // Calculate IDF
  const idf = inverseDocumentFrequency(docs);
  
  // Build vocabulary (all unique terms)
  const vocabulary = Object.keys(idf).sort();
  
  // Calculate TF-IDF vectors
  for (const doc of docs) {
    doc.vector = tfidfVector(doc.tf, idf, vocabulary);
    // Clean up intermediate data
    delete doc.tokens;
    delete doc.tf;
  }
  
  return { documents: docs, idf, vocabulary };
}

// Search index with query
export function searchIndex(index, query, topK = 5) {
  const { documents, idf, vocabulary } = index;
  
  // Tokenize and vectorize query
  const queryTokens = tokenize(query);
  const queryTf = termFrequency(queryTokens);
  const queryVector = tfidfVector(queryTf, idf, vocabulary);
  
  // Calculate similarities
  const results = documents.map(doc => ({
    file: doc.file,
    text: doc.text,
    score: cosineSimilarity(queryVector, doc.vector)
  }));
  
  // Sort by score and return top K
  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Save index to file
export async function saveIndex(index, path) {
  await writeFile(path, JSON.stringify(index, null, 2));
}

// Load index from file
export async function loadIndex(path) {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

// Build index from L0/L1 files
export async function buildContextIndex(contextDir) {
  const documents = [];
  
  // Read L0 index
  try {
    const indexPath = join(contextDir, 'index.md');
    const indexContent = await readFile(indexPath, 'utf-8');
    
    // Parse L0 entries
    const lines = indexContent.split('\n').filter(l => l.includes(':'));
    for (const line of lines) {
      const [file, types] = line.split(':').map(s => s.trim());
      if (file && types) {
        documents.push({
          file,
          text: `${file} ${types}`,
          level: 'L0'
        });
      }
    }
  } catch (err) {
    console.error('Failed to read index.md:', err.message);
  }
  
  // Read L1 overviews (recursively find _overview.md files)
  async function findOverviews(dir) {
    const { readdir } = await import('node:fs/promises');
    const { join: joinPath } = await import('node:path');
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = joinPath(dir, entry.name);
        if (entry.isDirectory()) {
          await findOverviews(fullPath);
        } else if (entry.name === '_overview.md') {
          const content = await readFile(fullPath, 'utf-8');
          // Extract file sections
          const sections = content.split(/^## /m).slice(1);
          for (const section of sections) {
            const lines = section.split('\n');
            const file = lines[0].trim();
            const text = lines.slice(1).join('\n');
            documents.push({
              file,
              text: `${file}\n${text}`,
              level: 'L1'
            });
          }
        }
      }
    } catch (err) {
      // Directory doesn't exist or not readable
    }
  }
  
  await findOverviews(contextDir);
  
  return buildIndex(documents);
}
