"use client";

import i18next from "i18next";
import { initReactI18next } from "react-i18next";

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  lng: "en",
  resources: {
    en: {
      translation: {
        articleEditor: {
          categoryPlaceholder: "e.g. Process, Inspiration",
          titlePlaceholder: "Article Title",
        },
        chat: {
          conversationList: {
            title: "Conversations",
          },
          empty: {
            cloneGreeting: {
              title: "Hi! I'm {{profileName}}'s digital clone.",
              body: "Ask me anything about work and ideas.",
            },
          },
          input: {
            disclaimer: {
              clone: "Conversations may be visible to {{profileName}}",
            },
            placeholder: {
              clone: "Message {{profileName}}...",
            },
          },
        },
        editor: {
          categoryLabel: "Category",
          save: "Save",
          saving: "Saving…",
          slugLabel: "Slug",
          slugPlaceholder: "auto-from-title",
          titleAriaLabel: "Title",
        },
        postEditor: {
          categoryPlaceholder: "e.g. Notes, Updates",
          titlePlaceholder: "Post Title",
        },
        profileTabs: {
          articles: "Articles",
          bio: "Bio",
          posts: "Posts",
        },
      },
    },
  },
});
