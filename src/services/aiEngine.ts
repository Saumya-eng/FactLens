import {
  GoogleGenAI,
  Type,
} from "@google/genai";

import {
  VerificationResult,
  ClaimStatus,
} from "../models";

const aiClient = new GoogleGenAI({
  apiKey:
    import.meta.env.VITE_GEMINI_API_KEY,
});

// ======================================================
// UTILITY HELPERS
// ======================================================

function sanitizeJSON(
  text: string
) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

// SAFE JSON PARSER

function parseJSONSafely(
  text: string
) {
  try {
    const cleaned = text
      .replace(
        /[\u0000-\u001F]+/g,
        " "
      )
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .replace(/\t/g, " ")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error(
      "JSON parsing failed:",
      error
    );

    console.log(
      "INVALID JSON:",
      text
    );

    return null;
  }
}

// SPLIT LARGE TEXT INTO CHUNKS

function splitTextIntoChunks(
  text: string,
  chunkSize = 15000
): string[] {
  const chunks: string[] = [];

  for (
    let i = 0;
    i < text.length;
    i += chunkSize
  ) {
    chunks.push(
      text.slice(i, i + chunkSize)
    );
  }

  return chunks;
}

// SPLIT ARRAY INTO SMALLER BATCHES

function splitArrayIntoBatches<T>(
  array: T[],
  size: number
): T[][] {
  const chunks: T[][] = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    chunks.push(
      array.slice(i, i + size)
    );
  }

  return chunks;
}

// ======================================================
// CLAIM DETECTION
// ======================================================

export async function detectClaims(
  text: string
): Promise<string[]> {
  try {
    const chunks =
      splitTextIntoChunks(text);

    const extractedClaims: string[] =
      [];

    for (const chunk of chunks) {
      const response =
        await aiClient.models.generateContent({
          model: "gemini-2.5-flash",

          contents: `
Extract all factual and verifiable claims from this content.

Focus on:
- dates
- numbers
- scientific facts
- historical statements
- measurable information
- political claims
- financial data
- technical assertions

Ignore:
- opinions
- greetings
- emotions
- vague statements

Return ONLY a JSON array.

Example:
[
  "Google was founded in 1998",
  "The Earth revolves around the Sun"
]

TEXT:
${chunk}
`,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: Type.ARRAY,

              items: {
                type: Type.STRING,
              },
            },

            temperature: 0,
          },
        });

      const rawResponse =
        response.text || "[]";

      const cleaned =
        sanitizeJSON(rawResponse);

      const parsed =
        parseJSONSafely(cleaned);

      if (
        parsed &&
        Array.isArray(parsed)
      ) {
        extractedClaims.push(
          ...parsed
        );
      }
    }

    return [
      ...new Set(extractedClaims),
    ];
  } catch (error) {
    console.error(
      "Claim detection failed:",
      error
    );

    return [];
  }
}

// ======================================================
// CLAIM VERIFICATION ENGINE
// ======================================================

export async function analyzeClaims(
  claims: string[],

  onBatchComplete?: (
    results: VerificationResult[]
  ) => void
): Promise<VerificationResult[]> {
  try {
    // SMALLER BATCHES
    // BETTER JSON STABILITY

    const batches =
      splitArrayIntoBatches(
        claims,
        2
      );

    const finalResults: VerificationResult[] =
      [];

    for (const batch of batches) {
      const response =
        await aiClient.models.generateContent({
          model: "gemini-2.5-flash",

          contents: `
Fact check the following claims using live web search.

Claims:
${batch
  .map(
    (claim, index) =>
      `${index + 1}. ${claim}`
  )
  .join("\n")}

Instructions:
- Use live internet search
- Prefer trusted official sources
- Keep explanations concise
- Maximum 2 short sentences
- Maximum 3 references

Allowed statuses:
- verified
- false
- inaccurate
- unknown

Return ONLY valid JSON array.

Format:
[
  {
    "claim": "Claim text",
    "status": "verified",
    "explanation": "Short reason",
    "confidence": 0.91,
    "sources": [
      {
        "title": "NASA",
        "url": "https://nasa.gov"
      }
    ]
  }
]
`,

          config: {
            tools: [
              {
                googleSearch: {},
              },
            ],

            temperature: 0,
          },
        });

      const rawResponse =
        response.text || "[]";

      const cleaned =
        sanitizeJSON(rawResponse);

      const jsonMatch =
        cleaned.match(
          /\[[\s\S]*\]/
        );

      if (!jsonMatch) {
        console.log(
          "No valid JSON array detected"
        );

        continue;
      }

      const parsed =
        parseJSONSafely(
          jsonMatch[0]
        );

      if (
        !parsed ||
        !Array.isArray(parsed)
      ) {
        continue;
      }

      // ======================================
      // PROCESS CURRENT BATCH
      // ======================================

      const currentBatchResults: VerificationResult[] =
        [];

      for (const item of parsed) {
        try {
          const allowedStatuses: ClaimStatus[] =
            [
              "verified",
              "false",
              "inaccurate",
              "unknown",
            ];

          const status: ClaimStatus =
            allowedStatuses.includes(
              item?.status
            )
              ? item.status
              : "unknown";

          const result: VerificationResult =
            {
              claim:
                typeof item?.claim ===
                "string"
                  ? item.claim
                  : "Unknown claim",

              originalText:
                typeof item?.claim ===
                "string"
                  ? item.claim
                  : "Unknown claim",

              status,

              explanation:
                typeof item?.explanation ===
                "string"
                  ? item.explanation
                  : "No explanation available.",

              confidence:
                typeof item?.confidence ===
                "number"
                  ? item.confidence
                  : 0.5,

              sources: Array.isArray(
                item?.sources
              )
                ? item.sources
                    .filter(
                      (
                        source: {
                          title?: string;
                          url?: string;
                        }
                      ) =>
                        source?.url
                    )
                    .slice(0, 3)
                    .map(
                      (
                        source: {
                          title?: string;
                          url?: string;
                        }
                      ) => ({
                        title:
                          source.title ||
                          "Unknown Source",

                        url:
                          source.url ||
                          "",
                      })
                    )
                : [],
            };

          currentBatchResults.push(
            result
          );

          finalResults.push(
            result
          );
        } catch (error) {
          console.error(
            "Result processing failed:",
            error
          );
        }
      }

      // ======================================
      // STREAM LIVE RESULTS
      // ======================================

      if (
        onBatchComplete
      ) {
        onBatchComplete(
          currentBatchResults
        );
      }
    }

    return finalResults;
  } catch (error) {
    console.error(
      "Claim verification failed:",
      error
    );

    return [];
  }
}