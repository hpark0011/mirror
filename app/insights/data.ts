export type InsightSegment = { text: string; highlight?: boolean };

export type InsightReference = {
  chatNumber: number;
  messageNumber: number;
  initials?: string;
};

export type Insight = {
  user?: string;
  match?: number;
  actionType: "contact" | "create-content" | "add-data";
  segments?: ReadonlyArray<InsightSegment>;
  references?: ReadonlyArray<InsightReference>;
  sources?: ReadonlyArray<unknown>;
};

export const insights: ReadonlyArray<Insight> = [
  {
    user: "John Doe",
    match: 90,
    actionType: "contact",
    segments: [
      { text: "Rising engagement with your guidance on " },
      { text: "improving sleep", highlight: true },
      { text: " and morning energy. A quick check-in could convert interest." },
    ],
    references: [{ chatNumber: 1, messageNumber: 2, initials: "DK" }],
    sources: [],
  },
  {
    user: "Pete Sousa",
    match: 80,
    actionType: "contact",
    segments: [
      { text: "Pete Sousa is asking about whether you have " },
      { text: "stress management course ", highlight: true },
      {
        text: "This could be a new market opportunity that you could expand into. Reach out to Sousa and learn more about his needs.",
      },
    ],
    references: [{ chatNumber: 3, messageNumber: 3, initials: "PS" }],
    sources: [],
  },
  {
    user: "Sam Jung",
    match: 80,
    actionType: "contact",
    segments: [
      { text: "Sam Jung is interested in your " },
      { text: "habit building class", highlight: true },
      {
        text: "He has asked for pricing and your teaching style. Reach out to Sam Jung and learn more about his needs and how your class could help.",
      },
    ],
    references: [{ chatNumber: 4, messageNumber: 7, initials: "HP" }],
    sources: [],
  },
  {
    user: "David Thompson",
    match: 75,
    actionType: "create-content",
    segments: [
      { text: "24 people asked about " },
      { text: "healthy lunch ideas", highlight: true },
      {
        text: " for busy weekdays. Creating a 3-post series would help you get more audience.",
      },
    ],
    references: [
      { chatNumber: 5, messageNumber: 9, initials: "HP" },
      { chatNumber: 6, messageNumber: 1, initials: "AZ" },
      { chatNumber: 2, messageNumber: 5, initials: "KJ" },
    ],
    sources: [],
  },
  {
    user: "Sam Jung",
    match: 74,
    actionType: "create-content",
    segments: [
      { text: "Interest in " },
      { text: "beginner strength training", highlight: true },
      {
        text: " is climbing for past 4 days. There were 13 conversations about this topic. Publish a short starter routine and get more engagement.",
      },
    ],
    references: [
      { chatNumber: 7, messageNumber: 12, initials: "PT" },
      { chatNumber: 2, messageNumber: 5, initials: "SJ" },
    ],
    sources: [],
  },
  {
    user: "David Thompson",
    match: 75,
    actionType: "add-data",
    segments: [
      {
        text: "Some users seem to have hard time understanding ",
      },
      { text: "technical terms related to your product. ", highlight: true },
      {
        text: "Adding more context and examples in your response style could help users understand better.",
      },
    ],
    references: [{ chatNumber: 2, messageNumber: 2, initials: "KD" }],
  },
  {
    user: "Sam Jung",
    match: 74,
    actionType: "add-data",
    segments: [
      { text: "Some people are asking for " },
      { text: "your credibility as a health coach ", highlight: true },
      {
        text: "Adding your background and certifications to your profile could help users trust you more.",
      },
    ],
    references: [{ chatNumber: 1, messageNumber: 8, initials: "SJ" }],
    sources: [],
  },
] as const;
