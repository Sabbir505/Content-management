function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function buildTFIDFVectors(corpus: string[]): Map<string, number>[] {
  const docFreq = new Map<string, number>();
  const tokenizedDocs = corpus.map(tokenize);

  for (const tokens of tokenizedDocs) {
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }

  const totalDocs = corpus.length;

  return tokenizedDocs.map((tokens) => {
    const tf = new Map<string, number>();
    const totalTerms = tokens.length;

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    const tfidf = new Map<string, number>();
    for (const [token, count] of tf) {
      const tfValue = count / totalTerms;
      const idfValue = Math.log(
        1 + totalDocs / (1 + (docFreq.get(token) || 0))
      );
      tfidf.set(token, tfValue * idfValue);
    }

    return tfidf;
  });
}

export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, weightA] of vecA) {
    normA += weightA * weightA;
    const weightB = vecB.get(term) || 0;
    dotProduct += weightA * weightB;
  }

  for (const weightB of vecB.values()) {
    normB += weightB * weightB;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function averageVectors(vectors: Map<string, number>[]): Map<string, number> {
  const result = new Map<string, number>();
  const count = vectors.length;
  if (count === 0) return result;

  for (const vec of vectors) {
    for (const [term, weight] of vec) {
      result.set(term, (result.get(term) || 0) + weight / count);
    }
  }
  return result;
}

export function computeVocabularyOverlap(
  generatedText: string,
  voiceCorpus: string[]
): number {
  if (!voiceCorpus.length || !generatedText.trim()) return 0;
  const corpus = [...voiceCorpus, generatedText];
  const vectors = buildTFIDFVectors(corpus);

  const generatedVec = vectors[vectors.length - 1];
  const voiceVec = averageVectors(vectors.slice(0, -1));

  return cosineSimilarity(generatedVec, voiceVec);
}

export function averageSentenceLength(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce(
    (sum, s) => sum + s.trim().split(/\s+/).length,
    0
  );
  return Math.round(totalWords / sentences.length);
}