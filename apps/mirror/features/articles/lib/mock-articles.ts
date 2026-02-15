import type { JSONContent } from "@feel-good/features/editor/types";

export type Article = {
  slug: string;
  title: string;
  cover_image: string;
  created_at: string;
  published_at: string;
  status: "draft" | "published";
  category: string;
  body: JSONContent;
};

// ---------------------------------------------------------------------------
// Helper: wrap paragraphs into a Tiptap doc from plain text (for bulk articles)
// ---------------------------------------------------------------------------
function textToDoc(...paragraphs: string[]): JSONContent {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

function paragraph(
  ...parts: (string | { text: string; marks: { type: string; attrs?: Record<string, unknown> }[] })[]
): JSONContent {
  return {
    type: "paragraph",
    content: parts.map((part) =>
      typeof part === "string"
        ? { type: "text", text: part }
        : { type: "text", text: part.text, marks: part.marks },
    ),
  };
}

function bold(text: string) {
  return { text, marks: [{ type: "bold" }] };
}

function italic(text: string) {
  return { text, marks: [{ type: "italic" }] };
}

function link(text: string, href: string) {
  return {
    text,
    marks: [
      {
        type: "link",
        attrs: { href, target: "_blank", rel: "noopener noreferrer" },
      },
    ],
  };
}

function inlineCode(text: string) {
  return { text, marks: [{ type: "code" }] };
}

function heading(level: 2 | 3 | 4, text: string): JSONContent {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function blockquote(...paragraphs: JSONContent[]): JSONContent {
  return { type: "blockquote", content: paragraphs };
}

function image(src: string, alt: string, title?: string): JSONContent {
  return {
    type: "image",
    attrs: { src, alt, ...(title ? { title } : {}) },
  };
}

function bulletList(...items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((text) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  };
}

function orderedList(...items: string[]): JSONContent {
  return {
    type: "orderedList",
    attrs: { start: 1 },
    content: items.map((text) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  };
}

function codeBlock(code: string, language?: string): JSONContent {
  return {
    type: "codeBlock",
    attrs: { language: language ?? null },
    content: [{ type: "text", text: code }],
  };
}

function horizontalRule(): JSONContent {
  return { type: "horizontalRule" };
}

// ---------------------------------------------------------------------------
// Articles with rich content (first 4 have diverse elements)
// ---------------------------------------------------------------------------

export const MOCK_ARTICLES: Article[] = [
  // ── Article 1: headings, bold, italic, blockquote, image ──────────────
  {
    slug: "the-art-of-listening-deeply",
    title: "The Art of Listening Deeply",
    cover_image: "/images/articles/listening.jpg",
    created_at: "2026-01-28T10:00:00Z",
    published_at: "2026-02-01T08:00:00Z",
    status: "published",
    category: "Music Production",
    body: {
      type: "doc",
      content: [
        paragraph(
          "Most people listen to confirm what they already believe. The producer's job is different. You listen to discover what's ",
          italic("actually"),
          " there, beneath the surface, waiting to emerge. This requires a kind of ",
          bold("radical openness"),
          " that most of us have forgotten how to practice.",
        ),
        heading(2, "Hearing What Surprises You"),
        paragraph(
          "When I sit with an artist in the studio, I try to hear not what I expect but what surprises me. The unexpected note, the unplanned hesitation, the breath between phrases — these are often where the truth lives. The recording equipment captures sound, but the producer's ear captures intention.",
        ),
        image(
          "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=450&fit=crop",
          "A recording studio mixing console with warm lighting",
          "The studio as a space for deep listening",
        ),
        heading(3, "The Practice of Presence"),
        paragraph(
          "Deep listening is not passive. It demands your full presence. You cannot be thinking about lunch or your phone or the next session. You must be ",
          bold("here"),
          ", ",
          bold("now"),
          ", completely absorbed in the vibration of the moment.",
        ),
        blockquote(
          paragraph(
            "The most important thing in communication is hearing what isn't said.",
          ),
        ),
      ],
    },
  },

  // ── Article 2: ordered list, code block, link, horizontal rule ────────
  {
    slug: "why-constraints-fuel-creativity",
    title: "Why Constraints Fuel Creativity",
    cover_image: "/images/articles/constraints.jpg",
    created_at: "2026-01-20T14:00:00Z",
    published_at: "2026-01-25T09:00:00Z",
    status: "draft",
    category: "Creativity",
    body: {
      type: "doc",
      content: [
        paragraph(
          "The blank page terrifies because it offers infinite possibility. Paradoxically, when you limit your options, your imagination expands. A painter who can only use ",
          bold("three colors"),
          " will find combinations a painter with thirty never considers.",
        ),
        heading(2, "The Studio Experiment"),
        paragraph(
          "In the studio, I've seen this countless times. When we stripped away the reverb, the overdubs, the layers of production that felt necessary, what remained was something honest and powerful. The constraint of simplicity revealed the song's true character.",
        ),
        heading(3, "Rules of Constraint-Based Creation"),
        orderedList(
          "Set a time limit — finish before you can overthink",
          "Remove one tool you rely on most",
          "Work with only what's in front of you",
          "Embrace the first take as the foundation",
        ),
        horizontalRule(),
        heading(3, "Constraints as Architecture"),
        paragraph(
          "Every great work of art exists within boundaries. The ",
          link("sonnet", "https://en.wikipedia.org/wiki/Sonnet"),
          " has fourteen lines. The haiku has seventeen syllables. The three-minute pop song has its own architecture. These are not limitations — they are invitations to go deeper.",
        ),
        paragraph(
          "Think of it like writing code. The best functions follow the ",
          inlineCode("single responsibility principle"),
          " — they do one thing well:",
        ),
        codeBlock(
          `function listen(sound) {
  // Don't analyze. Don't judge.
  // Just receive.
  return sound.essence;
}`,
          "javascript",
        ),
      ],
    },
  },

  // ── Article 3: bullet list, blockquote with attribution, image ────────
  {
    slug: "morning-silence-as-practice",
    title: "Morning Silence as Practice",
    cover_image: "/images/articles/morning-silence.jpg",
    created_at: "2026-01-15T06:00:00Z",
    published_at: "2026-01-18T07:00:00Z",
    status: "published",
    category: "Meditation",
    body: {
      type: "doc",
      content: [
        paragraph(
          "Before the world starts talking at you, there is a window. Most people fill it immediately — with news, with social media, with the noise of obligation. I've found that ",
          bold("protecting this window"),
          " changes everything that follows.",
        ),
        heading(2, "The Morning Ritual"),
        paragraph(
          "For thirty years, my mornings have begun the same way. I wake before the sun. I sit. I breathe. I do not check my phone. I do not plan my day. I simply exist in the quiet, letting whatever needs to surface find its way up.",
        ),
        bulletList(
          "Wake before sunrise — the world is still yours",
          "No screens for the first hour",
          "Sit in the same spot each day — the body remembers",
          "Let thoughts pass without grasping them",
          "End when it feels right, not by the clock",
        ),
        image(
          "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=450&fit=crop",
          "Meditation at sunrise with golden light",
          "The quiet before the world wakes",
        ),
        heading(3, "Beyond Goal"),
        paragraph(
          "This practice has no goal. That's what makes it work. The moment you try to ",
          italic("get something"),
          " from silence, it stops being silence and becomes another form of grasping.",
        ),
        blockquote(
          paragraph(
            "Silence is not empty. It is full of answers.",
          ),
        ),
      ],
    },
  },

  // ── Article 4: bold+italic mixed, nested content, h2 sections ─────────
  {
    slug: "the-producer-as-mirror",
    title: "The Producer as Mirror",
    cover_image: "/images/articles/mirror.jpg",
    created_at: "2026-01-10T11:00:00Z",
    published_at: "2026-01-12T10:00:00Z",
    status: "published",
    category: "Music Production",
    body: {
      type: "doc",
      content: [
        paragraph(
          "A great producer does not impose a vision. Instead, they ",
          italic("reflect back"),
          " to the artist what the artist cannot see in themselves. This is an act of ",
          bold("service"),
          ", not ego. The mirror does not judge — it simply shows what's there.",
        ),
        heading(2, "The American Recordings Sessions"),
        paragraph(
          "When Johnny Cash came to me, he didn't need a producer to tell him how to sing. He needed someone to remind him ",
          italic("who he was"),
          ". The American Recordings sessions were less about production technique and more about creating a space where the truth could be heard.",
        ),
        heading(2, "The Producer's Questions"),
        paragraph(
          "The same principle applies to every collaboration. The artist has the answers. The producer has the questions.",
        ),
        bulletList(
          "What are you trying to say?",
          "What does this song need to feel like?",
          "What can we remove to let the core shine?",
          "Where does the emotion live in this performance?",
        ),
        horizontalRule(),
        heading(3, "Reflection as Craft"),
        paragraph(
          "Learning to be a mirror requires practice. It means quieting your own creative ego long enough to truly ",
          bold("see"),
          " what someone else is making. Most producers fail at this — they hear themselves in every artist's work.",
        ),
        blockquote(
          paragraph(
            "The best producers make the artist sound more like themselves, not less.",
          ),
        ),
      ],
    },
  },

  // ── Remaining articles: standard paragraphs with occasional formatting ─
  {
    slug: "on-taste-and-its-development",
    title: "On Taste and Its Development",
    cover_image: "/images/articles/taste.jpg",
    created_at: "2026-01-05T09:00:00Z",
    published_at: "2026-01-08T08:00:00Z",
    status: "draft",
    category: "Philosophy",
    body: {
      type: "doc",
      content: [
        paragraph(
          "Taste is not something you're born with. It's something you cultivate through ",
          bold("relentless exposure"),
          " and honest reflection. You develop taste by consuming widely, by sitting with discomfort, by asking yourself why something moves you and why something doesn't.",
        ),
        paragraph(
          "The danger is developing taste too rigidly. When your preferences become rules, you stop being open to the new. The best creative minds I've known maintain a productive tension between knowing what they like and remaining curious about what they don't yet understand.",
        ),
        paragraph(
          "Taste is a ",
          italic("compass"),
          ", not a cage. It guides you toward your best work, but only if you're willing to occasionally let it lead you somewhere unfamiliar.",
        ),
      ],
    },
  },
  {
    slug: "collaboration-without-compromise",
    title: "Collaboration Without Compromise",
    cover_image: "/images/articles/collaboration.jpg",
    created_at: "2025-12-28T13:00:00Z",
    published_at: "2026-01-02T09:00:00Z",
    status: "published",
    category: "Collaboration",
    body: {
      type: "doc",
      content: [
        paragraph(
          "People confuse collaboration with compromise. They imagine that working together means meeting in the middle, each person giving up something they care about. This produces ",
          bold("mediocrity"),
          ".",
        ),
        paragraph(
          "True collaboration is additive. Each person brings their full self, their strongest ideas, their deepest instincts. The result isn't a diluted version of two visions — it's something neither person could have imagined alone.",
        ),
        paragraph(
          "When the Beastie Boys and I worked together, nobody was holding back. We pushed each other toward something we all believed in, even when we didn't agree on how to get there.",
        ),
      ],
    },
  },
  {
    slug: "the-studio-as-sacred-space",
    title: "The Studio as Sacred Space",
    cover_image: "/images/articles/studio.jpg",
    created_at: "2025-12-20T10:00:00Z",
    published_at: "2025-12-24T08:00:00Z",
    status: "published",
    category: "Music Production",
    body: {
      type: "doc",
      content: [
        paragraph(
          "A recording studio is more than a room with equipment. At its best, it's a ",
          italic("sanctuary"),
          " — a place where the outside world falls away and something new can emerge. The physical environment shapes what's possible creatively.",
        ),
        paragraph(
          "I've worked in expensive studios and cheap ones, in mansions and in garages. The quality of the space has nothing to do with the price tag. It has everything to do with how the space makes the artist feel. Safety, warmth, permission to fail — these are the acoustics that matter most.",
        ),
        paragraph(
          "When you walk into a room and feel invited to be yourself, that's where the best music happens.",
        ),
      ],
    },
  },
  {
    slug: "beginner-mind-in-the-studio",
    title: "Beginner Mind in the Studio",
    cover_image: "/images/articles/beginner-mind.jpg",
    created_at: "2025-12-12T08:00:00Z",
    published_at: "2025-12-16T09:00:00Z",
    status: "draft",
    category: "Creativity",
    body: {
      type: "doc",
      content: [
        paragraph(
          "The expert's curse is knowing too much. When you've made hundreds of records, there's a temptation to rely on formulas — do what worked last time. But the music doesn't care about your experience. It only cares about your ",
          bold("attention"),
          ".",
        ),
        paragraph(
          "Beginner mind means approaching each project as if you've never made anything before. Not pretending ignorance, but choosing openness over assumption. The veteran producer who can still be surprised by a sound is the one making the most vital work.",
        ),
        paragraph(
          "Every session is new. Every artist is different. Every song has its own needs. If you bring yesterday's solutions to today's problems, you'll miss what today is trying to teach you.",
        ),
      ],
    },
  },
  {
    slug: "the-weight-of-simplicity",
    title: "The Weight of Simplicity",
    cover_image: "/images/articles/simplicity.jpg",
    created_at: "2025-12-05T15:00:00Z",
    published_at: "2025-12-10T10:00:00Z",
    status: "published",
    category: "Philosophy",
    body: {
      type: "doc",
      content: [
        paragraph(
          "Adding is easy. Removing is hard. It takes courage to strip away what doesn't serve the work, especially when you've spent time and energy creating it. But ",
          bold("simplicity"),
          " has a weight and presence that complexity cannot match.",
        ),
        paragraph(
          "Think of the most powerful songs you know. Most of them are simple. A voice, a guitar, a truth. The complexity is in the emotion, not the arrangement. When we add more, we're often trying to compensate for something that's missing at the core.",
        ),
        paragraph(
          "Simplicity is not the absence of effort. It's the result of enormous effort directed at finding the essential and letting go of everything else.",
        ),
      ],
    },
  },
  {
    slug: "walking-as-creative-practice",
    title: "Walking as Creative Practice",
    cover_image: "/images/articles/walking.jpg",
    created_at: "2025-11-28T07:00:00Z",
    published_at: "2025-12-02T08:00:00Z",
    status: "published",
    category: "Meditation",
    body: {
      type: "doc",
      content: [
        paragraph(
          "Some of my best ideas have come while walking. Not while ",
          italic("trying"),
          " to have ideas — just walking. The rhythm of steps, the changing scenery, the fresh air — these create conditions for the mind to wander productively.",
        ),
        paragraph(
          "There's a reason so many philosophers were walkers. Nietzsche, Kierkegaard, Thoreau. Movement frees the mind from the tyranny of the desk, from the pressure of sitting still and producing. Walking is productive without trying to be.",
        ),
        paragraph(
          "I walk every day, usually without a destination. The walk itself is the destination. And more often than not, I return with something I didn't have when I left.",
        ),
      ],
    },
  },
  {
    slug: "genre-is-a-prison",
    title: "Genre Is a Prison",
    cover_image: "/images/articles/genre.jpg",
    created_at: "2025-11-20T12:00:00Z",
    published_at: "2025-11-25T09:00:00Z",
    status: "draft",
    category: "Music Production",
    body: {
      type: "doc",
      content: [
        paragraph(
          "Labels exist for the convenience of marketers, not artists. When you tell an artist they make ",
          inlineCode("country music"),
          " or ",
          inlineCode("hip-hop"),
          ", you're drawing a box around their imagination. The most interesting work happens at the boundaries, where categories blur and dissolve.",
        ),
        paragraph(
          "Johnny Cash wasn't making country music with me. He was making ",
          italic("Johnny Cash music"),
          ". The Chili Peppers weren't making rock. They were making their own thing, something that borrowed from everywhere and belonged nowhere.",
        ),
        paragraph(
          "When I work with an artist, one of the first things I try to do is remove the genre from the conversation. What do you want to say? How do you want to feel? Those questions don't have genres.",
        ),
      ],
    },
  },
  {
    slug: "the-discipline-of-daily-practice",
    title: "The Discipline of Daily Practice",
    cover_image: "/images/articles/practice.jpg",
    created_at: "2025-11-12T09:00:00Z",
    published_at: "2025-11-18T08:00:00Z",
    status: "published",
    category: "Creativity",
    body: {
      type: "doc",
      content: [
        paragraph(
          "Inspiration is unreliable. It comes when it wants, leaves when it pleases. You cannot build a creative life on inspiration alone. What you can build it on is ",
          bold("practice"),
          " — the daily act of showing up and doing the work whether you feel like it or not.",
        ),
        paragraph(
          "The professional sits down every day. The amateur waits for motivation. This isn't about being rigid or joyless. It's about understanding that the muse rewards those who are already at work when she arrives.",
        ),
        paragraph(
          "Practice doesn't mean perfection. It means repetition, attention, incremental improvement. It means trusting the process when the results aren't visible.",
        ),
      ],
    },
  },
  {
    slug: "nature-as-teacher",
    title: "Nature as Teacher",
    cover_image: "/images/articles/nature.jpg",
    created_at: "2025-11-05T06:00:00Z",
    published_at: "2025-11-10T07:00:00Z",
    status: "draft",
    category: "Meditation",
    body: {
      type: "doc",
      content: [
        paragraph(
          "The natural world operates without anxiety. Trees don't worry about growing — they just grow. Rivers don't plan their course — they follow the terrain. There is profound wisdom in this ",
          italic("effortless unfolding"),
          ".",
        ),
        paragraph(
          "I spend as much time outdoors as I can. The ocean, the mountains, the garden — these are my teachers. They remind me that creation is not something you force. It's something you allow.",
        ),
        paragraph(
          "When the studio feels stuck, when the ideas won't come, the best thing I can do is go outside. Nature doesn't try to be creative. It simply ",
          bold("is"),
          " creative. And in its presence, we remember how to be the same.",
        ),
      ],
    },
  },
  {
    slug: "vulnerability-as-strength",
    title: "Vulnerability as Strength",
    cover_image: "/images/articles/vulnerability.jpg",
    created_at: "2025-10-28T11:00:00Z",
    published_at: "2025-11-03T09:00:00Z",
    status: "published",
    category: "Collaboration",
    body: textToDoc(
      "The hardest thing for an artist to do in the studio is to be vulnerable. To sing without the safety of effects. To play without the crutch of technique. To say what they actually mean instead of what sounds clever.",
      "But vulnerability is where the power lives. The performances that move people — the ones that become timeless — are the ones where the artist dropped their guard and let something real come through.",
      "My job is to create an environment where that vulnerability feels safe. Not comfortable — there's a difference. The artist should feel supported, but they should also feel the weight of what they're doing. Real art has stakes.",
    ),
  },
  {
    slug: "the-mythology-of-genius",
    title: "The Mythology of Genius",
    cover_image: "/images/articles/genius.jpg",
    created_at: "2025-10-20T14:00:00Z",
    published_at: "2025-10-26T10:00:00Z",
    status: "published",
    category: "Philosophy",
    body: textToDoc(
      "We love the story of the lone genius struck by lightning. Mozart composing in his head, Picasso painting in a frenzy. But these stories obscure a deeper truth: great work is almost always the product of sustained effort, community, and revision.",
      "The artists I've worked with are not geniuses in the mythological sense. They are dedicated practitioners who have spent thousands of hours honing their craft. Their 'genius' is really disciplined sensitivity — the ability to notice things others miss, developed through years of practice.",
      "Demystifying genius doesn't diminish great art. It makes it more accessible. If creativity is a practice rather than a gift, then anyone can participate.",
    ),
  },
  {
    slug: "the-role-of-accidents",
    title: "The Role of Accidents",
    cover_image: "/images/articles/accidents.jpg",
    created_at: "2025-10-12T10:00:00Z",
    published_at: "2025-10-18T08:00:00Z",
    status: "draft",
    category: "Music Production",
    body: textToDoc(
      "Some of the best moments in recording history were mistakes. A wrong note that became a hook. A technical glitch that became a texture. An improvised line that replaced something carefully written.",
      "The key is recognizing the accident for what it is — not a problem to be fixed, but a gift to be received. This requires a particular kind of attention: alert enough to notice the deviation, open enough to consider its value.",
      "I've trained myself to listen for the 'wrong' things. When something unexpected happens in the studio, my first instinct is not to stop and correct. It's to lean in and listen more closely.",
    ),
  },
  {
    slug: "patience-in-the-creative-process",
    title: "Patience in the Creative Process",
    cover_image: "/images/articles/patience.jpg",
    created_at: "2025-10-05T08:00:00Z",
    published_at: "2025-10-10T09:00:00Z",
    status: "published",
    category: "Creativity",
    body: textToDoc(
      "We live in an age of instant everything. Instant communication, instant gratification, instant feedback. But great art refuses to be rushed. It has its own timeline, its own rhythm, and it will not be hurried.",
      "Some albums take years. Not because the artist is lazy or unfocused, but because the work isn't ready. Forcing an album to be done before it's ready is like picking fruit before it's ripe — technically possible, but the result is never as good.",
      "Patience is not waiting passively. It's an active practice of trusting that the work will reveal itself when it's time. Your job is to stay engaged, stay attentive, and be ready when the moment arrives.",
    ),
  },
  {
    slug: "the-breath-between-notes",
    title: "The Breath Between Notes",
    cover_image: "/images/articles/breath.jpg",
    created_at: "2025-09-28T07:00:00Z",
    published_at: "2025-10-03T08:00:00Z",
    status: "published",
    category: "Music Production",
    body: textToDoc(
      "Music is as much about silence as it is about sound. The spaces between notes give the notes their meaning. Without rest, rhythm becomes noise. Without pause, melody becomes monotony.",
      "Great performers understand this intuitively. They know when to hold back, when to let the silence speak. The temptation is always to fill every moment with sound — more notes, more energy, more volume. But restraint is what separates the memorable from the forgettable.",
      "In the mixing process, I often find myself removing things rather than adding them. Each element I take away gives more room to what remains. The song breathes, and in that breath, the listener finds space to feel.",
    ),
  },
  {
    slug: "detachment-from-outcomes",
    title: "Detachment from Outcomes",
    cover_image: "/images/articles/detachment.jpg",
    created_at: "2025-09-20T13:00:00Z",
    published_at: "2025-09-25T10:00:00Z",
    status: "published",
    category: "Philosophy",
    body: textToDoc(
      "The work that endures is made without concern for how it will be received. When you create with an audience in mind — thinking about reviews, sales, streaming numbers — you are already compromised. The art becomes a product, and products are made to satisfy, not to challenge.",
      "Detachment doesn't mean not caring. It means caring about the work itself rather than what the work will get you. The artist who is fully absorbed in the making, who has forgotten about the marketplace, is the one most likely to create something that the marketplace actually wants.",
      "Paradoxically, the less you chase success, the more likely it is to find you. The universe rewards authenticity.",
    ),
  },
  {
    slug: "building-trust-with-artists",
    title: "Building Trust with Artists",
    cover_image: "/images/articles/trust.jpg",
    created_at: "2025-09-12T10:00:00Z",
    published_at: "2025-09-18T09:00:00Z",
    status: "published",
    category: "Collaboration",
    body: textToDoc(
      "Trust cannot be demanded. It can only be earned, slowly, through consistent demonstration of good faith. In the studio, this means showing the artist that you are there for their vision, not your own.",
      "The first sessions with a new artist are always about trust-building. I listen more than I speak. I ask questions rather than make declarations. I show them that their instincts matter, that I'm not here to override their judgment but to support it.",
      "Once trust is established, remarkable things become possible. The artist takes risks they wouldn't otherwise take. They go to emotional places they'd normally avoid. They trust the process because they trust the person guiding it.",
    ),
  },
  {
    slug: "the-myth-of-writer-s-block",
    title: "The Myth of Writer's Block",
    cover_image: "/images/articles/writers-block.jpg",
    created_at: "2025-09-05T09:00:00Z",
    published_at: "2025-09-10T08:00:00Z",
    status: "draft",
    category: "Creativity",
    body: textToDoc(
      "Writer's block isn't a condition. It's a symptom — usually of trying too hard to produce something good. When the inner critic is louder than the creative impulse, the flow stops. The solution isn't to push harder. It's to lower the stakes.",
      "Give yourself permission to make something terrible. Write the worst song you can. Paint the ugliest picture. Remove the pressure of quality, and the creative energy starts flowing again. You can always edit later.",
      "The artists I admire most are prolific. Not because everything they make is great, but because they understand that quantity leads to quality. You have to make a lot of work to find the good work hiding inside it.",
    ),
  },
  {
    slug: "sound-and-emotion",
    title: "Sound and Emotion",
    cover_image: "/images/articles/sound-emotion.jpg",
    created_at: "2025-08-28T11:00:00Z",
    published_at: "2025-09-03T09:00:00Z",
    status: "published",
    category: "Music Production",
    body: textToDoc(
      "Sound bypasses the intellect and goes straight to the body. A low bass note creates a physical sensation. A high-pitched tone triggers alertness. Music manipulates our emotional state in ways that words alone cannot.",
      "As a producer, I think about this constantly. The choice of instrument, the register, the texture, the spatial positioning in the mix — all of these are emotional decisions disguised as technical ones. Every knob you turn is shaping how someone will feel.",
      "The best productions feel inevitable, as though the sounds couldn't have been anything other than what they are. Achieving this inevitability requires both technical knowledge and emotional intelligence.",
    ),
  },
  {
    slug: "the-zen-of-analog",
    title: "The Zen of Analog",
    cover_image: "/images/articles/analog.jpg",
    created_at: "2025-08-20T08:00:00Z",
    published_at: "2025-08-25T10:00:00Z",
    status: "published",
    category: "Music Production",
    body: textToDoc(
      "Digital tools offer unlimited options. Unlimited tracks, unlimited undos, unlimited possibilities. This abundance can be paralyzing. Analog equipment, with its limitations and imperfections, forces decisions and rewards commitment.",
      "When you record to tape, you can't easily go back. This creates urgency and presence. The musician knows that this take matters. There's a gravity to the performance that's hard to replicate in a world of infinite takes and auto-tune.",
      "I'm not against digital recording. But I believe in the discipline that analog thinking brings. Whether you're using tape or a laptop, the mindset of commitment — this is the take, this is the sound — elevates the work.",
    ),
  },
  {
    slug: "the-power-of-environment",
    title: "The Power of Environment",
    cover_image: "/images/articles/environment.jpg",
    created_at: "2025-08-12T14:00:00Z",
    published_at: "2025-08-18T08:00:00Z",
    status: "draft",
    category: "Creativity",
    body: textToDoc(
      "Where you create matters more than most people realize. The light, the temperature, the objects in the room — all of these influence your state of mind, and your state of mind influences your work.",
      "I've designed my spaces with intention. Natural materials, soft light, minimal distraction. Not because I'm precious about aesthetics, but because I've learned that the environment either supports the creative process or undermines it. There is no neutral.",
      "If you're struggling creatively, before you question your talent or your ideas, question your environment. Sometimes the simplest change — a different room, a walk outside, a shift in lighting — unlocks what felt impossible.",
    ),
  },
  {
    slug: "on-finishing-things",
    title: "On Finishing Things",
    cover_image: "/images/articles/finishing.jpg",
    created_at: "2025-08-05T10:00:00Z",
    published_at: "2025-08-10T09:00:00Z",
    status: "published",
    category: "Philosophy",
    body: textToDoc(
      "Starting is thrilling. The middle is uncertain. Finishing is the hardest part. Most creative people have drawers full of unfinished projects — songs half-written, paintings half-done, books half-drafted.",
      "The resistance to finishing is real. As long as the work is incomplete, it retains its potential. It could still be anything. The moment you declare it done, it becomes fixed, and the gap between what you imagined and what you made becomes visible.",
      "But unfinished work serves no one. A flawed completed piece is infinitely more valuable than a perfect idea that never materialized. Ship it. Release it. Let it go. You can always make another one.",
    ),
  },
  {
    slug: "gratitude-as-creative-fuel",
    title: "Gratitude as Creative Fuel",
    cover_image: "/images/articles/gratitude.jpg",
    created_at: "2025-07-28T07:00:00Z",
    published_at: "2025-08-03T08:00:00Z",
    status: "draft",
    category: "Meditation",
    body: textToDoc(
      "Resentment and envy are creative poison. They turn your attention outward, toward what others have, away from what you can make. Gratitude is the antidote — it returns your focus to your own abundance, your own gifts, your own work.",
      "I begin each day by acknowledging what I'm grateful for. Not in a performative way, but as a genuine practice of noticing. The ability to hear. The opportunity to work with talented people. The privilege of spending my life in pursuit of something I love.",
      "Gratitude doesn't ignore problems. It provides the foundation from which problems can be addressed with clarity rather than reactivity. A grateful mind is a creative mind.",
    ),
  },
  {
    slug: "the-audience-you-cannot-see",
    title: "The Audience You Cannot See",
    cover_image: "/images/articles/audience.jpg",
    created_at: "2025-07-20T12:00:00Z",
    published_at: "2025-07-25T10:00:00Z",
    status: "published",
    category: "Philosophy",
    body: textToDoc(
      "Every piece of music reaches someone you will never meet. A teenager in a bedroom on the other side of the world. A person driving alone at night. Someone going through something you can't imagine. Your work finds them at exactly the right moment.",
      "This is the profound responsibility and privilege of making art. You are creating something that will exist beyond you, that will mean things to people you will never know. The song you almost didn't finish might be the song that saves someone's day.",
      "Make your work with this invisible audience in mind. Not to please them — you can't, because you don't know who they are. But to honor the connection that art makes possible across time and space.",
    ),
  },
  {
    slug: "learning-from-every-genre",
    title: "Learning from Every Genre",
    cover_image: "/images/articles/every-genre.jpg",
    created_at: "2025-07-12T09:00:00Z",
    published_at: "2025-07-18T08:00:00Z",
    status: "published",
    category: "Music Production",
    body: textToDoc(
      "My education as a producer came from listening to everything. Not just the music I loved, but the music I didn't understand. Country, metal, classical, electronic, folk, jazz — every genre has its own intelligence, its own solutions to the problem of making something beautiful from nothing.",
      "When I produced hip-hop, I brought lessons from punk. When I made country records, I carried insights from rap. Cross-pollination is the secret engine of innovation. The ideas that feel freshest are often old ideas transplanted into new soil.",
      "Narrow listening produces narrow music. If you only consume what confirms your taste, you'll only make what you've already heard. Expand your inputs, and your outputs will expand with them.",
    ),
  },
  {
    slug: "the-present-moment-is-enough",
    title: "The Present Moment Is Enough",
    cover_image: "/images/articles/present-moment.jpg",
    created_at: "2025-07-05T06:00:00Z",
    published_at: "2025-07-10T07:00:00Z",
    status: "published",
    category: "Meditation",
    body: textToDoc(
      "We spend most of our lives somewhere other than here. Replaying the past, rehearsing the future, lost in thought about things that haven't happened and may never happen. The present moment — the only moment that actually exists — slips by unnoticed.",
      "Creativity lives in the present. You cannot make music yesterday or tomorrow. You can only make it now. The quality of your attention in this moment determines the quality of what you create.",
      "Meditation has taught me this more than anything else. Sitting still, watching my thoughts, returning again and again to the breath — this practice trains the muscle of presence. And presence is the most valuable thing a creative person can bring to their work.",
    ),
  },
  {
    slug: "when-to-break-the-rules",
    title: "When to Break the Rules",
    cover_image: "/images/articles/break-rules.jpg",
    created_at: "2025-06-28T11:00:00Z",
    published_at: "2025-07-03T09:00:00Z",
    status: "draft",
    category: "Creativity",
    body: textToDoc(
      "Learn the rules thoroughly. Understand why they exist. Then, when you break them, break them deliberately and with full awareness of what you're doing. The difference between innovation and incompetence is intention.",
      "Every genre has its conventions. Every medium has its best practices. These exist for good reason — they represent accumulated wisdom about what works. But wisdom is not law. The rules describe what has worked, not what will always work.",
      "The artists who change culture are the ones who know the rules well enough to violate them meaningfully. They don't break rules out of ignorance or laziness. They break rules because they've discovered something the rules don't account for.",
    ),
  },
];

export function findArticleBySlug(slug: string): Article | undefined {
  return MOCK_ARTICLES.find((a) => a.slug === slug);
}
