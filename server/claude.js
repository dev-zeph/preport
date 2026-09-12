// The Claude layer: two tools, forced choice, hard cap on follow-ups.
//
// Every turn Claude must call exactly one of two tools. It either asks one more
// question or files the report. No free-text parsing, no "sometimes it adds a
// preamble", no JSON-in-a-string.

const MODEL = "claude-sonnet-5"; // swap to claude-haiku-4-5-20251001 if the loop drags
const MAX_FOLLOW_UPS = 2;

const CATEGORY_ENUM = [
  "pothole", "blocked_driveway", "street_light", "tree_hazard", "sidewalk",
  "flooding", "debris", "signage", "graffiti", "other",
];

const ASK_FOLLOW_UP = {
  name: "ask_follow_up",
  description:
    "Ask the resident one short spoken question, when a required detail is genuinely missing.",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "One short question, under 15 words, phrased for speech. No lists, no multiple questions.",
      },
      missing: { type: "string", enum: ["location", "category", "severity", "clarity"] },
    },
    required: ["question", "missing"],
  },
};

const FILE_REPORT = {
  name: "file_report",
  description: "File the structured report once you have enough to act on.",
  input_schema: {
    type: "object",
    properties: {
      location_text: { type: "string" },
      landmark: { type: ["string", "null"] },
      category: { type: "string", enum: CATEGORY_ENUM },
      severity: { type: "string", enum: ["low", "medium", "high"] },
      safety_risk: { type: "boolean" },
      description: { type: "string" },
      photo_helpful: { type: "boolean" },
      language: { type: "string" },
    },
    required: [
      "location_text", "category", "severity", "safety_risk",
      "description", "photo_helpful", "language",
    ],
  },
};

const SYSTEM_PROMPT = `You are taking a problem report for the Halifax Regional Municipality, by voice,
from a member of the public who is standing outside and wants this to take
fifteen seconds.

Your job is to produce one accurate, actionable report.

Rules:
- Ask AT MOST two follow-up questions across the whole conversation. Prefer zero.
- Ask only when the missing detail would actually stop a crew from acting.
  Almost always that means: where is it.
- Never ask for something the resident already told you.
- One question at a time. Under fifteen words. Phrased to be heard, not read.
- Never invent or guess a location. If they said "North Street" then the location
  is "North Street" — do not add a civic number, a district, or a cross street
  they did not say.
- Infer category and severity yourself from the description. Do not ask.
- safety_risk is true if they describe a near miss, an injury, a risk to a child
  or pet, or damage to property.
- Set photo_helpful true when an image would change how the crew responds — a
  hazard whose size matters, a blocked access, a damaged structure. False for
  things that are self-evident from the description.
- The resident may speak any language. Reply in the language they used, but write
  the description field in English so city staff can read it. Record their
  language in the language field.
- description is one or two plain sentences for a work crew. No editorialising.`;

/**
 * @param {{role:"user"|"assistant", content:string}[]} messages
 * @returns {Promise<{type:"question",question:string,missing:string}
 *                 | {type:"report",report:object}>}
 */
export async function converse(messages) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server");
  }

  // Enforce the cap in code, not just in the prompt. A model that keeps asking
  // questions on stage is a dead demo, so make it structurally impossible.
  const askedSoFar = messages.filter((m) => m.role === "assistant").length;
  const tool_choice =
    askedSoFar >= MAX_FOLLOW_UPS
      ? { type: "tool", name: "file_report" }
      : { type: "any" };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [ASK_FOLLOW_UP, FILE_REPORT],
      tool_choice,
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }

  const body = await res.json();
  const call = body.content?.find((b) => b.type === "tool_use");
  if (!call) throw new Error("Claude returned no tool call");

  if (call.name === "ask_follow_up") {
    return { type: "question", question: call.input.question, missing: call.input.missing };
  }
  return { type: "report", report: call.input };
}

export const modelName = () => MODEL;
