/**
 * Splits text into chunks of approximately `maxSize` characters
 * with `overlap` characters of overlap between consecutive chunks.
 * Splits on paragraph boundaries first, then sentence boundaries.
 */
export function chunkText(
  text: string,
  maxSize = 2000,
  overlap = 200,
): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [""];
  }
  if (trimmed.length <= maxSize) {
    return [trimmed];
  }

  const paragraphs = trimmed.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current
      ? `${current}\n\n${paragraph}`
      : paragraph;

    if (candidate.length <= maxSize) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current);
        // Start next chunk with overlap from end of current
        const overlapText = current.slice(-overlap).trimStart();
        current = overlapText
          ? `${overlapText}\n\n${paragraph}`
          : paragraph;
      } else {
        // Single paragraph exceeds maxSize — split on sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];
        for (const sentence of sentences) {
          const sentenceCandidate = current
            ? `${current}${sentence}`
            : sentence;
          if (sentenceCandidate.length <= maxSize) {
            current = sentenceCandidate;
          } else {
            if (current) {
              chunks.push(current);
              const sentenceOverlap = current.slice(-overlap).trimStart();
              current = sentenceOverlap
                ? `${sentenceOverlap}${sentence}`
                : sentence;
            } else {
              // Single sentence exceeds maxSize — hard split
              chunks.push(sentence.slice(0, maxSize));
              current = sentence.slice(maxSize - overlap);
            }
          }
        }
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [""];
}
