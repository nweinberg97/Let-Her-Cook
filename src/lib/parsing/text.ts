import { emptyDraft, type Ingredient, type Instruction, type RecipeDraft } from '../../types/recipe';
import type { ExtractionResult, ExtractionWarning } from '../extraction/types';
import { suggestCourse, suggestCuisine, suggestDietary, matchCourseName } from './classify';
import { makeInstruction, parseIngredientLine, stripBullet } from './ingredient';
import { parseDurationText, parseLeadingQuantity, parseNumber } from './quantity';

/**
 * Deterministic recipe parser for pasted or OCR'd text. It recognises the
 * usual shapes of recipes (headed sections, bullet lists, numbered steps,
 * "Prep: 10 min" lines) and tolerates the clutter that comes with copying
 * from web pages and social posts. It never invents values: anything it can't
 * place ends up in `unclassified` for the user to review.
 */

type Section = 'pre' | 'ingredients' | 'instructions' | 'notes' | 'nutrition' | 'comments';

const JUNK_PATTERNS: RegExp[] = [
  /^(jump|skip) to (recipe|content|main content|video)/i,
  /^(print|pin|save|share|email|tweet|rate)( this)?( recipe)?!?$/i,
  /^(print|pin|save|rate) recipe/i,
  /^advertisement$/i,
  /^(sponsored|ad|ads|promoted)$/i,
  /^(subscribe|sign up|newsletter|follow (me|us)|join (my|our)|get (my|our) free)/i,
  /^(click here|read more|see more|show more|load more|view recipe)/i,
  /cookie (policy|settings|preferences)|privacy policy|terms of (use|service)|all rights reserved/i,
  /^[★☆⭐✩✪\s\d./()]+$/u,
  /^\d(\.\d)? (from|out of) \d+ (votes?|reviews?|ratings?)/i,
  /^\d+\s+(votes?|reviews?|ratings?)$/i,
  /^[★☆⭐✩✪\s]+.*\b(votes?|reviews?|ratings?)\b/iu,
  /^\d(\.\d)?\s*(\/\s*5|stars?)\b/i,
  /^(photo|image|photography|video) (by|credit)/i,
  /^(as an amazon associate|this post (may )?contains? affiliate)/i,
  /^(posted|updated|published) (on|by)/i,
  /^#\S+(\s+#\S+)*$/,
  /^(home|recipes|menu|search|about|contact|shop|log ?in|sign in)$/i,
  /^[\W_]+$/u,
  /^(watch|play) (the )?video/i,
  /^(did you make this|tag @|leave a (review|comment)|i'd love to (hear|see))/i,
  /^(yum|wow|so good|delicious|omg)!*$/i
];

const INGREDIENT_HEADER = /^(?:the\s+)?(ingredients?(?:\s+list)?|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need|shopping list|ingredients? for .{2,40})$/i;
const INSTRUCTION_HEADER = /^(instructions?|directions?|method|preparation|steps|how to make(?: it| this| them)?|to make|procedure|cooking instructions|recipe instructions|making it|let'?s (cook|make it))$/i;
const NOTES_HEADER = /^(notes?|tips?|cook(?:'|’)?s notes?|recipe notes?|chef(?:'|’)?s notes?|variations?|storage(?: (?:notes|instructions))?|make[- ]ahead|substitutions?|serving suggestions?|to serve)$/i;
const NUTRITION_HEADER = /^(nutrition(?: facts| information| info)?(?: per serving)?|nutritional information)$/i;
const COMMENTS_HEADER = /^(comments?|reviews?|\d+ comments?|leave a (comment|reply|review)|reader (comments|reviews)|related (recipes|posts)|you (may|might) also like|more recipes|reader favorites)$/i;

const STEP_VERBS =
  /^(preheat|heat|warm|mix|stir|add|combine|whisk|bake|cook|place|put|bring|pour|season|serve|remove|transfer|cut|chop|slice|dice|mince|melt|grease|line|toss|roast|simmer|boil|blend|puree|purée|fold|let|leave|cover|drain|rinse|wash|spread|sprinkle|top|garnish|beat|cream|knead|roll|shape|form|divide|fill|press|chill|refrigerate|freeze|marinate|grill|fry|saute|sauté|sear|brown|reduce|return|repeat|finish|taste|adjust|set|turn|flip|use|make|prepare|meanwhile|once|when|while|after|in a|in the|on a|using|first|then|next|finally|squeeze|zest|peel|trim|soak|steam|poach|broil|dust|brush|drizzle|scatter|arrange|layer|assemble|wrap|cool|rest)\b/i;

function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍﻿­]/g, '') // zero-width + soft hyphen
    .replace(/ /g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/⁄/g, '/');
}

/** Strips Markdown/heading decoration so "## Ingredients:" and "**INGREDIENTS**" are recognised. */
function headerKey(line: string): string {
  return line
    .replace(/^[#>*_\s=-]+/, '')
    .replace(/[*_:=\s#-]+$/, '')
    .replace(/^\p{Extended_Pictographic}+\s*/u, '')
    .trim();
}

function isJunk(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return JUNK_PATTERNS.some((re) => re.test(t));
}

function classifyHeader(line: string): { section: Section; inline: string } | null {
  const t = line.trim();
  if (t.length > 80) return null;
  // Inline header: "Ingredients: flour, sugar, eggs"
  const inline = t.match(/^(ingredients?|instructions?|directions?|method|steps|notes?)\s*[:\-–]\s*(.+)$/i);
  if (inline) {
    const kind = inline[1].toLowerCase();
    const section: Section = kind.startsWith('ingredient') ? 'ingredients' : kind.startsWith('note') ? 'notes' : 'instructions';
    return { section, inline: inline[2].trim() };
  }
  const key = headerKey(t);
  if (INGREDIENT_HEADER.test(key)) return { section: 'ingredients', inline: '' };
  if (INSTRUCTION_HEADER.test(key)) return { section: 'instructions', inline: '' };
  if (NOTES_HEADER.test(key)) return { section: 'notes', inline: '' };
  if (NUTRITION_HEADER.test(key)) return { section: 'nutrition', inline: '' };
  if (COMMENTS_HEADER.test(key)) return { section: 'comments', inline: '' };
  return null;
}

interface Meta {
  servings: number | null;
  yieldText: string | null;
  prep: number | null;
  cook: number | null;
  total: number | null;
  cuisine: string | null;
  course: string | null;
  author: string | null;
  sourceUrl: string | null;
  title: string | null;
}

const META_LABEL_ONLY = /^(prep(?:aration)? time|cook(?:ing)? time|bake time|total time|active time|servings?|yields?|serves|course|cuisine|author|calories|keywords?)\s*:?$/i;
const TIME_UNIT_ONLY = /^(minutes?|mins?|hours?|hrs?|people|servings?|portions?)$/i;

function parseServings(value: string, meta: Meta): boolean {
  const v = value.trim();
  const qty = parseLeadingQuantity(v.replace(/^(about|approx\.?|approximately)\s+/i, ''));
  if (!qty) return false;
  const after = qty.rest.trim().toLowerCase();
  if (!after || /^(people|persons?|servings?|portions?|adults?|guests?|as a main|generously)\b/.test(after) || /^\(/.test(after)) {
    meta.servings = qty.quantity;
  } else {
    meta.yieldText = v;
    // "Makes 12 muffins" — the count still scales sensibly, so keep it as the base.
    meta.servings = qty.quantity;
  }
  return true;
}

/** Tries to read one metadata fragment. Returns true if it was metadata. */
function parseMetaFragment(fragment: string, meta: Meta): boolean {
  const f = fragment.trim().replace(/^[*_\-•]+\s*/, '').replace(/[*_]+$/, '');
  if (!f) return false;
  let m: RegExpMatchArray | null;
  if ((m = f.match(/^(?:serves|servings?|yields?|makes|portions?|serving size)\s*[:\-–]?\s*(.+)$/i))) {
    return parseServings(m[1], meta) || ((meta.yieldText = m[1].trim()), true);
  }
  if ((m = f.match(/^(\d+(?:\s*[-–]\s*\d+)?)\s+(servings?|portions?|people)$/i))) {
    return parseServings(f, meta);
  }
  if ((m = f.match(/^(prep(?:aration)?(?:\s*time)?|active(?:\s*time)?|hands[- ]on(?:\s*time)?)\s*[:\-–]?\s*(.+)$/i))) {
    const mins = parseDurationText(m[2]);
    if (mins != null) return (meta.prep = mins), true;
  }
  if ((m = f.match(/^(cook(?:ing)?(?:\s*time)?|bake(?:\s*time)?|baking time|chill(?:ing)?(?:\s*time)?)\s*[:\-–]?\s*(.+)$/i))) {
    const mins = parseDurationText(m[2]);
    if (mins != null) return (meta.cook = (meta.cook ?? 0) + mins), true;
  }
  if ((m = f.match(/^(total(?:\s*time)?|ready in|time)\s*[:\-–]?\s*(.+)$/i))) {
    const mins = parseDurationText(m[2]);
    if (mins != null) return (meta.total = mins), true;
  }
  if ((m = f.match(/^cuisine\s*[:\-–]?\s+(.{2,60})$/i))) return (meta.cuisine = m[1].trim()), true;
  if ((m = f.match(/^(?:course|category|meal(?: type)?)\s*[:\-–]?\s+(.{2,60})$/i))) return (meta.course = m[1].trim()), true;
  if ((m = f.match(/^(?:author|recipe by|by|from the kitchen of|courtesy of)\s*[:\-–]?\s+(.{2,60})$/i)) && !/[.!?]$/.test(m[1])) {
    return (meta.author = m[1].trim()), true;
  }
  if ((m = f.match(/^(?:source|adapted from|originally from|recipe from)\s*[:\-–]\s*(.+)$/i))) {
    const url = m[1].match(/https?:\/\/\S+/);
    if (url) meta.sourceUrl = url[0];
    else meta.author = meta.author ?? m[1].trim();
    return true;
  }
  if ((m = f.match(/^(?:title|recipe(?: name)?)\s*[:\-–]\s*(.{2,120})$/i))) return (meta.title = m[1].trim()), true;
  return false;
}

/** A line can hold several facts: "Prep: 10 min | Cook: 20 min | Serves 4". */
function parseMetaLine(line: string, meta: Meta): boolean {
  const t = line.trim();
  if (t.length > 160) return false;
  if (/^https?:\/\/\S+$/.test(t)) {
    meta.sourceUrl = meta.sourceUrl ?? t;
    return true;
  }
  const parts = t.split(/\s*[|•·]\s*|\s{2,}|;\s+/).filter(Boolean);
  if (parts.length > 1) {
    const results = parts.map((p) => parseMetaFragment(p, meta));
    if (results.every(Boolean)) return true;
    if (results.some(Boolean) && results.filter(Boolean).length >= parts.length - 1) return true;
    return false;
  }
  return parseMetaFragment(t, meta);
}

export function looksLikeNumberedStep(line: string): boolean {
  const m = line.trim().match(/^(?:step\s*(\d+)\s*[:.)\-–]?|(\d{1,2})\s*[.)]|(\d{1,2})\s*[-–:]\s)\s*(.*)$/i);
  if (!m) return false;
  const rest = m[4] ?? '';
  // "1. 2 cups flour" is a numbered ingredient, not a step.
  if (parseLeadingQuantity(rest) && rest.length < 60) return false;
  return true;
}

export function looksLikeIngredient(line: string): boolean {
  const raw = line.trim();
  const s = stripBullet(raw);
  if (!s || s.length > 140) return false;
  if (/[.!?]$/.test(s) && s.split(/\s+/).length > 12) return false;
  if (looksLikeNumberedStep(s) && s.length > 40) return false;
  const q = parseLeadingQuantity(s);
  if (q && !/^\s*[.)]\s/.test(q.rest) && !/^\s*(°|º|degrees|minutes?|mins?|hours?|hrs?)\b/i.test(q.rest)) return true;
  if (s !== raw && s.length < 90 && !STEP_VERBS.test(s)) return true; // bulleted short line
  if (/\b(to taste|for serving|for garnish|as needed|optional)\b/i.test(s) && s.length < 80) return true;
  if (/^(a|an|one|two|three|four|five|six|half|some|pinch|dash|handful|few|several|juice of|zest of)\b/i.test(s) && s.length < 60 && !/[.!?]$/.test(s) && !STEP_VERBS.test(s)) return true;
  return false;
}

export function looksLikeStep(line: string): boolean {
  const s = line.trim();
  if (looksLikeNumberedStep(s)) return true;
  if (looksLikeIngredient(s)) return false;
  if (s.length >= 50 && /[.!?)]$/.test(s)) return true;
  if (s.length > 20 && STEP_VERBS.test(stripBullet(s))) return true;
  return false;
}

function isGroupHeading(line: string): boolean {
  const t = line.trim();
  if (t.length > 60 || t.length < 3) return false;
  if (parseLeadingQuantity(stripBullet(t))) return false;
  if (/^for (the )?[\p{L}'’ &-]{2,40}:?$/iu.test(t)) return true;
  if (/:$/.test(t) && t.split(/\s+/).length <= 6) return true;
  if (/^(\*\*|__|#+\s).+/.test(t) && t.split(/\s+/).length <= 6) return true;
  return false;
}

function cleanHeading(line: string): string {
  return line.replace(/^[#*_\s]+/, '').replace(/[*_:\s]+$/, '').trim();
}

function assembleIngredients(lines: string[]): { ingredients: Ingredient[]; leftovers: string[] } {
  const out: Ingredient[] = [];
  const leftovers: string[] = [];
  let group: string | null = null;
  let pendingJoin = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pendingJoin = false;
      continue;
    }
    if (isGroupHeading(line) && !looksLikeIngredient(line.replace(/:$/, ''))) {
      group = cleanHeading(line);
      pendingJoin = false;
      continue;
    }
    // Continuation of a wrapped ingredient: "2 cups flour," / "sifted"
    const prev = out[out.length - 1];
    if (prev && (pendingJoin || /^[(,]/.test(line)) && !parseLeadingQuantity(stripBullet(line))) {
      const joined = parseIngredientLine(`${prev.raw} ${stripBullet(line)}`, prev.group);
      out[out.length - 1] = { ...joined, id: prev.id };
      pendingJoin = /[,\-–]$|\b(and|or|plus|with)$/i.test(line);
      continue;
    }
    // A long sentence in an ingredient list is probably a note.
    if (line.length > 160 && /[.!?]$/.test(line)) {
      leftovers.push(line);
      continue;
    }
    // Inline comma lists from social captions: "flour, sugar, 2 eggs, butter"
    if (!parseLeadingQuantity(stripBullet(line)) && line.split(',').length >= 4 && line.length < 300 && !/[.!?]$/.test(line)) {
      for (const part of line.split(',')) if (part.trim()) out.push(parseIngredientLine(part.trim(), group));
      pendingJoin = false;
      continue;
    }
    out.push(parseIngredientLine(line, group));
    pendingJoin = /[,\-–]$|\b(and|or|plus|with)$/i.test(line);
  }
  return { ingredients: out, leftovers };
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function assembleInstructions(lines: string[]): Instruction[] {
  const steps: { text: string; group: string | null }[] = [];
  let group: string | null = null;
  const numbered = lines.some((l) => looksLikeNumberedStep(l));
  let paragraph = '';

  const flush = () => {
    if (paragraph.trim()) steps.push({ text: paragraph.trim(), group });
    paragraph = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (!numbered) flush();
      continue;
    }
    if (isGroupHeading(line) && !looksLikeNumberedStep(line)) {
      flush();
      group = cleanHeading(line);
      continue;
    }
    if (numbered) {
      const m = line.match(/^(?:step\s*\d+\s*[:.)\-–]?|\d{1,2}\s*[.)]|\d{1,2}\s*[-–:]\s)\s*(.*)$/i);
      if (m && looksLikeNumberedStep(line)) {
        flush();
        paragraph = m[1] ?? '';
      } else {
        paragraph = paragraph ? `${paragraph} ${stripBullet(line)}` : stripBullet(line);
      }
      continue;
    }
    // Unnumbered: a bullet starts a new step; wrapped lines (no ending punctuation) join.
    const isBullet = stripBullet(line) !== line;
    if (isBullet) {
      flush();
      paragraph = stripBullet(line);
    } else if (paragraph && !/[.!?)]$/.test(paragraph)) {
      paragraph = `${paragraph} ${line}`;
    } else {
      flush();
      paragraph = line;
    }
    if (/[.!?)]$/.test(line) && !isBullet) {
      // Each complete line/paragraph is a step when the source has no numbers.
      flush();
    }
  }
  flush();

  // A single long paragraph (common in captions) reads better split into sentences.
  if (steps.length === 1 && steps[0].text.length > 280) {
    const sentences = splitSentences(steps[0].text);
    if (sentences.length > 2) {
      const g = steps[0].group;
      return sentences.map((s) => makeInstruction(s, g));
    }
  }
  return steps.map((s) => makeInstruction(s.text, s.group));
}

function isTitleCase(s: string): boolean {
  const words = s.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (!words.length) return false;
  const small = /^(a|an|and|the|of|with|in|on|for|to|or|au|de|la|le|et)$/i;
  const caps = words.filter((w) => small.test(w) || /^\p{Lu}/u.test(w)).length;
  return caps / words.length >= 0.75;
}

const FOOD_WORDS = /\b(chicken|beef|pork|pasta|soup|salad|cake|cookies?|bread|pie|tart|stew|curry|sauce|tacos?|rice|noodles?|salmon|shrimp|muffins?|brownies?|pancakes?|waffles?|smoothie|chili|roast|casserole|lasagna|risotto|dip|dressing|bars?|loaf|potato(es)?|eggs?|tofu|vegetables?|beans|lentils?|cheese|lemon|garlic|chocolate|banana|apple|pumpkin|bowl|sandwich|burgers?|pizza|biscuits?|scones?|crumble|cobbler|fudge|granola|oats?|quiche|frittata|gnocchi|dumplings?|ramen|pho|kebabs?|meatballs?|fish|steak|ribs|wings|slaw)\b/i;

function pickTitle(candidates: { text: string; index: number }[], anchorIndex: number): { text: string; index: number } | null {
  let best: { text: string; index: number; score: number } | null = null;
  for (const c of candidates) {
    const t = c.text.trim();
    const words = t.split(/\s+/).length;
    if (t.length < 3 || t.length > 90 || words > 14) continue;
    if (/^https?:/i.test(t) || /[:;]$/.test(t)) continue;
    if (/[.?]$/.test(t) && words > 5) continue;
    let score = 0;
    if (isTitleCase(t)) score += 2;
    if (FOOD_WORDS.test(t)) score += 2;
    if (anchorIndex - c.index <= 4) score += 2;
    if (c.index === candidates[0]?.index) score += 1;
    if (t.length >= 8 && t.length <= 60) score += 1;
    if (/[!]$/.test(t)) score -= 1;
    if (/\b(i|my|we|you|our)\b/i.test(t) && !/\b(my|mom'?s|grandma'?s|nana'?s)\b/i.test(t)) score -= 2;
    if (!best || score >= best.score) best = { ...c, score };
  }
  return best && best.score >= 1 ? best : null;
}

export interface ParseOptions {
  sourceUrl?: string | null;
  fileName?: string;
}

export function parseRecipeText(input: string, options: ParseOptions = {}): ExtractionResult {
  const text = cleanText(input);
  const allLines = text.split('\n').map((l) => l.trim());
  const meta: Meta = { servings: null, yieldText: null, prep: null, cook: null, total: null, cuisine: null, course: null, author: null, sourceUrl: null, title: null };

  const sections: Record<Section, { line: string; index: number }[]> = {
    pre: [],
    ingredients: [],
    instructions: [],
    notes: [],
    nutrition: [],
    comments: []
  };
  let section: Section = 'pre';
  let sawIngredientHeader = false;
  let sawInstructionHeader = false;
  let firstSectionIndex = allLines.length;
  // Does the text name a steps section anywhere? If so, never guess where steps start.
  const hasInstructionHeaderAhead = allLines.some((l) => classifyHeader(l)?.section === 'instructions');
  let junkCount = 0;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    if (section === 'comments') {
      // Only a new recipe-section header gets us out of a comments block.
      const h = classifyHeader(line);
      if (h && (h.section === 'notes' || h.section === 'nutrition')) section = h.section;
      continue;
    }
    if (isJunk(line)) {
      junkCount++;
      continue;
    }
    // Label on one line, value on the next ("Prep Time" / "10" / "minutes").
    if (META_LABEL_ONLY.test(line) && i + 1 < allLines.length) {
      let value = allLines[i + 1];
      let consumed = 1;
      if (i + 2 < allLines.length && TIME_UNIT_ONLY.test(allLines[i + 2])) {
        value = `${value} ${allLines[i + 2]}`;
        consumed = 2;
      }
      const label = line.replace(/:$/, '');
      if (/^(calories|keywords?)$/i.test(label)) {
        sections.nutrition.push({ line: `${label}: ${value}`, index: i });
        i += consumed;
        continue;
      }
      if (parseMetaFragment(`${label}: ${value}`, meta)) {
        i += consumed;
        continue;
      }
    }
    const header = classifyHeader(line);
    if (header) {
      section = header.section;
      if (section === 'ingredients') sawIngredientHeader = true;
      if (section === 'instructions') sawInstructionHeader = true;
      firstSectionIndex = Math.min(firstSectionIndex, i);
      if (header.inline) sections[section].push({ line: header.inline, index: i });
      // "Ingredients for the dressing" starts a group within the list.
      const forGroup = headerKey(line).match(/^ingredients? (for .{2,40})$/i);
      if (forGroup) sections.ingredients.push({ line: `${forGroup[1][0].toUpperCase()}${forGroup[1].slice(1)}:`, index: i });
      continue;
    }
    if (section !== 'instructions' && section !== 'notes' && parseMetaLine(line, meta)) continue;
    if (/^(calories|keywords?|nutrition)\b.{0,80}$/i.test(line) && line.length < 100 && section !== 'instructions') {
      sections.nutrition.push({ line, index: i });
      continue;
    }

    // Implicit transition: an ingredient section followed by un-headed steps.
    if (
      section === 'ingredients' &&
      !hasInstructionHeaderAhead &&
      sections.ingredients.length > 0 &&
      !looksLikeIngredient(line) &&
      (looksLikeNumberedStep(line) || (stripBullet(line) === line && looksLikeStep(line)))
    ) {
      section = 'instructions';
    }
    sections[section].push({ line, index: i });
  }

  let preLines = sections.pre;
  let ingredientLines = sections.ingredients.map((x) => x.line);
  let instructionLines = sections.instructions.map((x) => x.line);
  let anchorIndex = firstSectionIndex;

  // No ingredient header: find the densest run of ingredient-looking lines.
  if (!sawIngredientHeader) {
    const pool = preLines;
    let bestStart = -1;
    let bestLen = 0;
    for (let s = 0; s < pool.length; s++) {
      if (!looksLikeIngredient(pool[s].line)) continue;
      let e = s;
      let misses = 0;
      let count = 0;
      while (e < pool.length && misses < 2) {
        if (looksLikeIngredient(pool[e].line)) {
          count++;
          misses = 0;
        } else if (isGroupHeading(pool[e].line)) {
          misses = 0;
        } else {
          misses++;
        }
        e++;
      }
      if (count > bestLen) {
        bestLen = count;
        bestStart = s;
      }
    }
    if (bestStart >= 0 && bestLen >= 2) {
      // Run extends until two consecutive non-ingredient lines.
      let end = bestStart;
      let misses = 0;
      let lastGood = bestStart;
      while (end < pool.length) {
        const l = pool[end].line;
        if (looksLikeIngredient(l)) {
          lastGood = end;
          misses = 0;
        } else if (!isGroupHeading(l) || looksLikeStep(l)) {
          misses++;
          if (misses >= 2 || looksLikeStep(l)) break;
        }
        end++;
      }
      // Include a group heading directly above the run.
      let start = bestStart;
      if (start > 0 && isGroupHeading(pool[start - 1].line)) start--;
      ingredientLines = pool.slice(start, lastGood + 1).map((x) => x.line);
      const after = pool.slice(lastGood + 1).map((x) => x.line);
      instructionLines = [...after, ...instructionLines];
      preLines = pool.slice(0, start);
      anchorIndex = pool[start].index;
    } else if (!sawInstructionHeader) {
      // Nothing recognisable: steps are lines that look like steps; the rest stays for review.
      const steps = pool.filter((x) => looksLikeStep(x.line));
      if (steps.length) {
        const firstStep = steps[0].index;
        instructionLines = pool.filter((x) => x.index >= firstStep).map((x) => x.line);
        preLines = pool.filter((x) => x.index < firstStep);
        anchorIndex = firstStep;
      }
    }
  } else if (!sawInstructionHeader && instructionLines.length === 0) {
    // Ingredients headed, steps not: the tail of the ingredient block may contain steps.
    const idx = ingredientLines.findIndex((l) => looksLikeNumberedStep(l));
    if (idx > 0) {
      instructionLines = ingredientLines.slice(idx);
      ingredientLines = ingredientLines.slice(0, idx);
    }
  }

  // Title, description, leftovers from the lines before the recipe proper.
  const leftovers: string[] = [];
  let title = meta.title;
  let titleGuessed = false;
  let description = '';
  if (!title) {
    const picked = pickTitle(
      preLines.map((p) => ({ text: p.line, index: p.index })),
      anchorIndex
    );
    if (picked) {
      title = picked.text.replace(/^[#*_\s]+|[*_\s]+$/g, '');
      titleGuessed = true;
      const after = preLines.filter((p) => p.index > picked.index);
      const before = preLines.filter((p) => p.index < picked.index);
      // Up to two short paragraphs right after the title read as a description.
      const descLines: string[] = [];
      for (const p of after) {
        if (descLines.length < 2 && p.line.length >= 20 && p.line.length < 600) descLines.push(p.line);
        else leftovers.push(p.line);
      }
      description = descLines.join(' ');
      leftovers.unshift(...before.map((p) => p.line));
    } else {
      leftovers.push(...preLines.map((p) => p.line));
    }
  } else {
    leftovers.push(...preLines.map((p) => p.line));
  }
  if (!title && options.fileName) {
    title = options.fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
    titleGuessed = true;
  }

  const { ingredients, leftovers: ingLeftovers } = assembleIngredients(ingredientLines);
  const instructions = assembleInstructions(instructionLines);
  leftovers.push(...ingLeftovers);
  const notes = sections.notes.map((x) => x.line).join('\n');
  const nutrition = sections.nutrition.map((x) => x.line);
  if (nutrition.length) leftovers.push('Nutrition (as given in the source):', ...nutrition);

  // Timer-free total: only when both parts are known; never treat unknown as 0.
  const draft: RecipeDraft = {
    ...emptyDraft(),
    title: title ?? '',
    description,
    ingredients,
    instructions,
    prepTimeMinutes: meta.prep,
    cookTimeMinutes: meta.cook,
    totalTimeMinutes: meta.total,
    servings: meta.servings,
    yieldText: meta.yieldText,
    notes,
    sourceUrl: options.sourceUrl ?? meta.sourceUrl ?? null,
    author: meta.author
  };

  const ingredientText = ingredients.map((i) => i.raw).join('\n');
  const courseFromSource = matchCourseName(meta.course);
  draft.course = suggestCourse(draft.title, ingredientText, meta.course);
  draft.cuisine = suggestCuisine(draft.title, ingredientText, meta.cuisine);
  draft.dietaryTags = suggestDietary(ingredients.map((i) => i.raw));

  const warnings: ExtractionWarning[] = [];
  if (!draft.title) warnings.push({ field: 'title', message: 'We couldn’t find a title. Give this recipe a name.' });
  else if (titleGuessed && !sawIngredientHeader) warnings.push({ field: 'title', message: 'We guessed the title. Check it’s right.' });
  if (!ingredients.length) warnings.push({ field: 'ingredients', message: 'We couldn’t find an ingredient list. Add ingredients below, or check the leftover text.' });
  if (!instructions.length) warnings.push({ field: 'instructions', message: 'We couldn’t find the steps. Add them below, or check the leftover text.' });
  const unparsedQty = ingredients.filter((i) => /^\d/.test(i.raw) && i.quantity == null).length;
  if (unparsedQty) warnings.push({ field: 'ingredients', message: `${unparsedQty} ingredient${unparsedQty > 1 ? 's have' : ' has'} an amount we couldn’t read, so ${unparsedQty > 1 ? 'they' : 'it'} won’t scale. Check the wording.` });
  const unclassified = leftovers.filter((l) => l.trim()).join('\n');
  if (unclassified) warnings.push({ field: 'general', message: 'Some text didn’t fit anywhere. It’s in “Leftover text” below so nothing is lost.' });
  if (junkCount > 3) warnings.push({ field: 'general', message: 'We skipped page clutter like “Jump to recipe”, ratings and share buttons.' });

  const confidence: ExtractionResult['confidence'] =
    sawIngredientHeader && sawInstructionHeader && ingredients.length >= 2 && instructions.length >= 1 && !!draft.title
      ? 'high'
      : ingredients.length >= 1 && instructions.length >= 1
        ? 'medium'
        : 'low';

  return {
    draft,
    warnings,
    unclassified,
    confidence,
    suggested: { course: !courseFromSource, cuisine: !meta.cuisine && draft.cuisine != null, dietary: draft.dietaryTags.length > 0 },
    method: 'text'
  };
}

/**
 * Splits text holding several recipes (e.g. a family recipe document) at each
 * additional ingredients header, carrying the title lines just above it.
 */
export function splitRecipes(input: string): string[] {
  const lines = cleanText(input).split('\n');
  const headerIdx: number[] = [];
  lines.forEach((l, i) => {
    const h = classifyHeader(l.trim());
    if (h?.section === 'ingredients' && !/^ingredients? for\s/i.test(headerKey(l.trim()))) headerIdx.push(i);
  });
  if (headerIdx.length < 2) return [input];
  const cuts: number[] = [0];
  for (let k = 1; k < headerIdx.length; k++) {
    const prev = headerIdx[k - 1];
    let j = headerIdx[k] - 1;
    let back = 0;
    while (j > prev && back < 6) {
      const l = lines[j].trim();
      if (!l) {
        j--;
        continue;
      }
      const meta: Meta = { servings: null, yieldText: null, prep: null, cook: null, total: null, cuisine: null, course: null, author: null, sourceUrl: null, title: null };
      if (parseMetaLine(l, meta) || (l.length < 100 && !looksLikeStep(l) && !looksLikeIngredient(l))) {
        j--;
        back++;
        continue;
      }
      break;
    }
    cuts.push(j + 1);
  }
  cuts.push(lines.length);
  const out: string[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const seg = lines.slice(cuts[i], cuts[i + 1]).join('\n').trim();
    if (seg) out.push(seg);
  }
  return out;
}

// Exposed for tests.
export const _internal = { classifyHeader, isJunk, parseMetaLine, pickTitle, assembleInstructions, assembleIngredients, parseNumber };
