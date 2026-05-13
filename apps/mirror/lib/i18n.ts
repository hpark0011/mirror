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
            configurationGreeting: {
              title: "Hi! I can help configure your profile.",
              body: "Paste a resume, LinkedIn URL, or profile update.",
            },
          },
          input: {
            disclaimer: {
              clone: "Conversations may be visible to {{profileName}}",
              configuration: "Profile helper chats can update your public profile",
            },
            placeholder: {
              clone: "Message {{profileName}}...",
              configuration: "Paste a resume, LinkedIn URL, or profile update...",
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
        profile: {
          configureButton: {
            ariaLabel: "Configure profile",
            tooltip: "Configure profile",
          },
        },
        profileTabs: {
          articles: "Articles",
          bio: "Bio",
          posts: "Posts",
        },
        settings: {
          defaultContentType: {
            description: "Choose which section opens first on your profile.",
            label: "Default content type",
            placeholder: "Select default content type",
          },
          panel: {
            description: "Profile settings.",
          },
          toast: {
            saveFailed: "Failed to save settings",
            saved: "Settings saved",
            unableToSave: "Unable to save settings",
          },
          toolbar: {
            save: "Save",
            saving: "Saving...",
          },
        },
      },
    },
  },
});
