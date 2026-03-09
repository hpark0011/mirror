import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getPostCategoryForSlug } from "./posts/categories";

// ── Seed data ───────────────────────────────────────────────────────

function tiptapDoc(paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

const SEED_ARTICLES = [
  {
    slug: "the-art-of-listening",
    title: "The Art of Listening",
    category: "Music & Sound",
    daysAgo: 30,
    body: tiptapDoc([
      "Most people think producing music is about adding things. In my experience, the opposite is true. The best work comes from removing everything that isn't essential until only the truth remains.",
      "Listening is not passive. It requires your full attention, an emptying of expectation, and a willingness to be surprised. When you listen without judgment, the music tells you what it wants to be.",
      "Every great record I have been part of started with silence. Not the absence of sound, but the presence of attention.",
    ]),
  },
  {
    slug: "simplicity-as-a-superpower",
    title: "Simplicity as a Superpower",
    category: "Creativity",
    daysAgo: 18,
    body: tiptapDoc([
      "Complexity is easy. Anyone can pile ideas on top of each other until the result feels impressive. The difficult thing is knowing what to leave out.",
      "When I sit with an artist for the first time, I am not listening for what they can do. I am listening for who they are. The technical ability is the least interesting part. What matters is the thing underneath — the signal hiding in the noise.",
      "Simplicity is not about having less. It is about making room for what matters.",
    ]),
  },
  {
    slug: "nature-and-the-creative-process",
    title: "Nature and the Creative Process",
    category: "Creativity",
    daysAgo: 7,
    body: tiptapDoc([
      "I spend a lot of time outdoors. Not because it makes me more productive, but because it reminds me what creation actually looks like. A tree does not strain to grow. A wave does not try to break. These things happen because conditions allow them to.",
      "The creative process works the same way. You cannot force a great idea into existence. You can only create the conditions where great ideas are free to arrive.",
    ]),
  },
];

const SEED_POSTS = [
  // ── Short posts (1 paragraph) ──────────────────────────────────────
  {
    slug: "listening-before-speaking",
    title: "Listening Before Speaking",
    daysAgo: 21,
    body: tiptapDoc([
      "Most breakthroughs arrive after the room gets quiet enough to hear what was already there.",
    ]),
  },
  {
    slug: "make-the-room-safe",
    title: "Make the Room Safe",
    daysAgo: 2,
    body: tiptapDoc([
      "Artists do their best work when they do not feel judged while reaching for something new.",
    ]),
  },

  // ── Medium posts (2-3 paragraphs) ──────────────────────────────────
  {
    slug: "remove-the-unnecessary",
    title: "Remove the Unnecessary",
    daysAgo: 16,
    body: tiptapDoc([
      "If the work feels crowded, it usually means the idea wants more space, not more decoration.",
      "I have watched artists spend weeks layering sounds only to realize the demo they recorded on their phone was better. The rawness carried something the polish took away.",
      "Subtraction is a creative act. Every element you remove is a decision, and decisions are where artistry lives.",
    ]),
  },
  {
    slug: "the-body-knows-first",
    title: "The Body Knows First",
    daysAgo: 12,
    body: tiptapDoc([
      "Before the mind forms an opinion about a piece of music, the body has already responded. A chill down the spine, a foot tapping without permission, tears arriving before you understand why.",
      "I have learned to trust that physical response more than any intellectual analysis. The body does not lie about what moves it.",
    ]),
  },
  {
    slug: "seasons-of-making",
    title: "Seasons of Making",
    daysAgo: 9,
    body: tiptapDoc([
      "Not every season is for harvesting. Some seasons are for planting, some for tending, and some for letting the field rest.",
      "Artists who try to produce at the same pace year-round eventually burn out. The ones who last understand that dormancy is not laziness — it is preparation.",
      "When nothing seems to be happening on the surface, the roots are doing their deepest work.",
    ]),
  },
  {
    slug: "doubt-as-compass",
    title: "Doubt as Compass",
    daysAgo: 6,
    body: tiptapDoc([
      "Doubt usually shows up right before a breakthrough. It is the mind recognizing that you are in unfamiliar territory, which is exactly where you need to be.",
      "The trick is not to eliminate doubt but to keep working alongside it. Let it inform you without letting it stop you.",
    ]),
  },

  // ── Long posts (4+ paragraphs) ─────────────────────────────────────
  {
    slug: "rules-and-breaking-them",
    title: "Rules and Breaking Them",
    daysAgo: 14,
    body: tiptapDoc([
      "Every great artist I have worked with learned the rules before they broke them. There is a difference between ignorance and transcendence. One comes from not knowing, the other from knowing so deeply that you can see past the boundary.",
      "The rules exist for a reason. They represent centuries of accumulated understanding about what works. Respecting that history is not the same as being trapped by it.",
      "When Johnny Cash recorded those final albums, he was not ignoring country music conventions. He had lived inside them for forty years. He understood them so completely that he could strip everything away and find something more honest underneath.",
      "The permission to break rules is earned through the patience of learning them first.",
    ]),
  },
  {
    slug: "attention-is-the-gift",
    title: "Attention Is the Gift",
    daysAgo: 4,
    body: tiptapDoc([
      "We live in a world that treats attention as a commodity to be captured. But in the creative process, attention is a gift you offer freely.",
      "When I sit with an artist, I am not thinking about what I want the record to sound like. I am not comparing it to anything else. I am simply there, fully present, letting the music exist without imposing my expectations on it.",
      "This quality of attention changes everything. The artist feels it. They relax. They stop performing and start expressing. The difference between those two states is the difference between a good record and a great one.",
      "You cannot fake this kind of presence. It requires a genuine emptying of agenda. Most people find that harder than any technical skill.",
      "But it is the single most important thing I do.",
    ]),
  },
  {
    slug: "the-source-is-everywhere",
    title: "The Source Is Everywhere",
    daysAgo: 1,
    body: tiptapDoc([
      "People ask where creativity comes from as if there is a single wellspring hidden somewhere. In my experience, it is everywhere — in a conversation with a stranger, in the pattern of light through a window, in the rhythm of a city street at dusk.",
      "The question is not where to find inspiration. The question is whether you are open to receiving it when it arrives.",
      "I have seen entire albums born from a single overheard phrase. I have watched producers build worlds from the sound of rain hitting a tin roof. The material is always there. The variable is awareness.",
      "Creativity is not a talent some people have and others do not. It is a way of paying attention.",
    ]),
  },
];

const SEED_CONVERSATIONS = [
  {
    title: "What inspires your production style?",
    messages: [
      {
        role: "user" as const,
        text: "What inspires your production style?",
      },
      {
        role: "assistant" as const,
        text: "I would not call it a style exactly. It is more of a practice — stripping things down until only the essential remains. I learned early on that the most powerful music is often the simplest. A single voice, an honest lyric, a raw performance. My job is to protect that honesty and keep everything else from getting in the way.",
      },
    ],
  },
  {
    title: "How do you approach a new artist?",
    messages: [
      {
        role: "user" as const,
        text: "How do you approach working with a new artist for the first time?",
      },
      {
        role: "assistant" as const,
        text: "I start by listening. Not to their music — to them. Who they are, what they care about, what keeps them up at night. The music is a reflection of the person, so understanding the person comes first. I try to create an environment where they feel safe enough to be vulnerable. That is where the real work happens.",
      },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

async function ensureRickRubinUser(
  ctx: MutationCtx,
): Promise<Id<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_username", (q: any) => q.eq("username", "rick-rubin"))
    .unique();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("users", {
    authId: "seed_rick_rubin",
    email: "rick@example.com",
    username: "rick-rubin",
    name: "Rick Rubin",
    bio: "Rick Rubin has been a singular, transformative creative muse for artists across genres and generations — from the Beastie Boys to Johnny Cash, from Public Enemy to the Red Hot Chili Peppers, from Adele to Jay-Z.",
    onboardingComplete: true,
  });
}

async function ensureRickRubinArticles(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const existing = await ctx.db
    .query("articles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  if (existing) {
    return;
  }

  const now = Date.now();
  for (const article of SEED_ARTICLES) {
    const createdAt = now - article.daysAgo * 24 * 60 * 60 * 1000;
    await ctx.db.insert("articles", {
      userId,
      slug: article.slug,
      title: article.title,
      category: article.category,
      body: article.body,
      status: "published",
      createdAt,
      publishedAt: createdAt,
    });
  }
}

async function ensureRickRubinPosts(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const existingPosts = await ctx.db
    .query("posts")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();
  const existingSlugs = new Set(existingPosts.map((post) => post.slug));

  const now = Date.now();
  for (const post of SEED_POSTS) {
    if (existingSlugs.has(post.slug)) {
      continue;
    }

    const createdAt = now - post.daysAgo * 24 * 60 * 60 * 1000;
    await ctx.db.insert("posts", {
      userId,
      slug: post.slug,
      title: post.title,
      category: getPostCategoryForSlug(post.slug),
      body: post.body,
      status: "published",
      createdAt,
      publishedAt: createdAt,
    });
  }
}

async function ensureRickRubinConversations(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_profileOwnerId_and_viewerId", (q: any) =>
      q.eq("profileOwnerId", userId),
    )
    .first();
  if (existing) {
    return;
  }

  for (const convo of SEED_CONVERSATIONS) {
    const threadId = await createThread(ctx, components.agent, {});

    await ctx.db.insert("conversations", {
      profileOwnerId: userId,
      threadId,
      status: "active",
      title: convo.title,
    });

    for (const msg of convo.messages) {
      if (msg.role === "user") {
        await saveMessage(ctx, components.agent, {
          threadId,
          prompt: msg.text,
        });
      } else {
        await saveMessage(ctx, components.agent, {
          threadId,
          message: {
            role: "assistant",
            content: [{ type: "text", text: msg.text }],
          },
        });
      }
    }
  }
}

// ── Exported mutations ──────────────────────────────────────────────

export const seedRickRubin = internalMutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ensureRickRubinUser(ctx);
  },
});

export const seedRickRubinArticles = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinArticles(ctx, userId);
    return null;
  },
});

export const seedRickRubinPosts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinPosts(ctx, userId);
    return null;
  },
});

export const seedRickRubinConversations = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinConversations(ctx, userId);
    return null;
  },
});

export const seedRickRubinDemo = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinArticles(ctx, userId);
    await ensureRickRubinPosts(ctx, userId);
    await ensureRickRubinConversations(ctx, userId);
    return null;
  },
});
