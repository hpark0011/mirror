type EmbeddingSerializer = "document" | "bio";
type EmbeddingLifecycle = "draft-published" | "always-indexable";

type ContentSourceRegistryEntry = {
  sourceTable: string;
  label: {
    singular: string;
    plural: string;
    inventory: string;
  };
  embedding:
    | {
        indexable: true;
        serializer: EmbeddingSerializer;
        lifecycle: EmbeddingLifecycle;
        sourceHintLabel?: string;
      }
    | {
        indexable: false;
      };
  navigation:
    | {
        navigable: true;
        kind: string;
        routeSegment: string;
      }
    | {
        navigable: false;
      };
};

function defineContentSourceRegistry<
  const T extends Record<string, ContentSourceRegistryEntry>,
>(registry: T): T {
  return registry;
}

export const contentSourceRegistry = defineContentSourceRegistry({
  articles: {
    sourceTable: "articles",
    label: {
      singular: "article",
      plural: "Articles",
      inventory: "published articles",
    },
    embedding: {
      indexable: true,
      serializer: "document",
      lifecycle: "draft-published",
      sourceHintLabel: "article",
    },
    navigation: {
      navigable: true,
      kind: "articles",
      routeSegment: "articles",
    },
  },
  posts: {
    sourceTable: "posts",
    label: {
      singular: "post",
      plural: "Posts",
      inventory: "published posts",
    },
    embedding: {
      indexable: true,
      serializer: "document",
      lifecycle: "draft-published",
      sourceHintLabel: "post",
    },
    navigation: {
      navigable: true,
      kind: "posts",
      routeSegment: "posts",
    },
  },
  bioEntries: {
    sourceTable: "bioEntries",
    label: {
      singular: "bio entry",
      plural: "Bio Entries",
      inventory: "bio entries (work history, education)",
    },
    embedding: {
      indexable: true,
      serializer: "bio",
      lifecycle: "always-indexable",
    },
    navigation: {
      navigable: false,
    },
  },
} as const);

export type ContentSourceTable = keyof typeof contentSourceRegistry;
export type ContentSource =
  (typeof contentSourceRegistry)[ContentSourceTable];
export type IndexableContentSource = Extract<
  ContentSource,
  { embedding: { indexable: true } }
>;
export type IndexableContentSourceTable =
  IndexableContentSource["sourceTable"];
export type NavigableContentSource = Extract<
  ContentSource,
  { navigation: { navigable: true } }
>;
export type NavigableContentSourceTable =
  NavigableContentSource["sourceTable"];
export type NavigableContentKind =
  NavigableContentSource["navigation"]["kind"];

function isIndexableSource(
  source: ContentSource,
): source is IndexableContentSource {
  return source.embedding.indexable;
}

function isNavigableSource(
  source: ContentSource,
): source is NavigableContentSource {
  return source.navigation.navigable;
}

export const CONTENT_SOURCES = Object.values(
  contentSourceRegistry,
) as ContentSource[];

export const INDEXABLE_CONTENT_SOURCES = CONTENT_SOURCES.filter(
  isIndexableSource,
);

export const INDEXABLE_CONTENT_SOURCE_TABLES =
  INDEXABLE_CONTENT_SOURCES.map(
    (source) => source.sourceTable,
  ) as IndexableContentSourceTable[];

export const NAVIGABLE_CONTENT_SOURCES = CONTENT_SOURCES.filter(
  isNavigableSource,
);

export const NAVIGABLE_CONTENT_KINDS = NAVIGABLE_CONTENT_SOURCES.map(
  (source) => source.navigation.kind,
) as NavigableContentKind[];

export function getContentSource(
  sourceTable: ContentSourceTable,
): ContentSource {
  return contentSourceRegistry[sourceTable];
}

export function getIndexableContentSource(
  sourceTable: IndexableContentSourceTable,
): IndexableContentSource {
  return contentSourceRegistry[sourceTable] as IndexableContentSource;
}

export function isNavigableContentKind(
  value: string | null | undefined,
): value is NavigableContentKind {
  return NAVIGABLE_CONTENT_KINDS.includes(value as NavigableContentKind);
}

export function getNavigableContentSource(
  kind: NavigableContentKind,
): NavigableContentSource {
  const source = NAVIGABLE_CONTENT_SOURCES.find(
    (candidate) => candidate.navigation.kind === kind,
  );
  if (!source) {
    throw new Error(`Unknown navigable content kind: ${kind}`);
  }
  return source;
}

export function getNavigableContentSourceByTable(
  sourceTable: ContentSourceTable,
): NavigableContentSource | null {
  const source = contentSourceRegistry[sourceTable];
  return isNavigableSource(source) ? source : null;
}
