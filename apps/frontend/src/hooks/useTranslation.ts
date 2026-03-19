import { useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import general from '../locales/general.json';
import auth from '../locales/auth.json';
import sidebar from '../locales/sidebar.json';
import dashboard from '../locales/dashboard.json';
import users from '../locales/users.json';
import background_jobs from '../locales/background_jobs.json';
import cameras from '../locales/cameras.json';
import table_settings from '../locales/table_settings.json';
import query_builder from '../locales/query_builder.json';

// Combine all locale modules here
const locales = {
    general,
    auth,
    sidebar,
    dashboard,
    users,
    background_jobs,
    cameras,
    table_settings,
    query_builder,
};

// Helper to access nested objects
const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : null;
    }, obj);
};

export const useTranslation = (module: string = 'general') => {
    const { language } = useLanguage();

    const t = useCallback((key: string, params?: Record<string, string | number>) => {
        let path = key;

        // 1. Try resolve in current module (Relative path)
        let dataEntry = getNestedValue(locales[module as keyof typeof locales], path);

        // 2. Try resolve globally (Absolute path, e.g. "sidebar.dashboard")
        if (!dataEntry) {
            dataEntry = getNestedValue(locales, path);
        }

        // 3. Fallback to general if not found
        if (!dataEntry && module !== 'general') {
            dataEntry = getNestedValue(locales.general, path);
        }

        if (!dataEntry) {
            // console.warn(`Missing translation for key: ${module}.${key}`);
            return key;
        }

        // The entry should be an object with 'id' and 'en' keys
        // Use type assertion since create-react-app might complain about indexing unknown object
        let translation = (dataEntry as any)[language];

        if (translation === undefined) {
            console.warn(`Missing translation for language ${language} in key: ${module}.${key}`);
            // Fallback to English if current lang missing, or key itself
            translation = (dataEntry as any)['en'] || key;
        }

        // Interpolate params {{param}}
        if (params && typeof translation === 'string') {
            Object.keys(params).forEach(param => {
                const value = String(params[param]);
                translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), value);
            });
        }

        return translation;
    }, [language, module]);

    return useMemo(() => ({ t, language }), [t, language]);
};
