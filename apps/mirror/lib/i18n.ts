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
