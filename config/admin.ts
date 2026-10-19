import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Admin => {
  // Set CLIENT_URL to preview in an external frontend (e.g. Next.js).
  // When unset, Strapi renders previews itself via /api/preview.
  const clientUrl = env('CLIENT_URL');
  const strapiUrl = env('PUBLIC_URL', `http://localhost:${env.int('PORT', 1337)}`);

  return {
    auth: {
      secret: env('ADMIN_JWT_SECRET')!,
    },
    apiToken: {
      salt: env('API_TOKEN_SALT')!,
    },
    transfer: {
      token: {
        salt: env('TRANSFER_TOKEN_SALT')!,
      },
    },
    secrets: {
      encryptionKey: env('ENCRYPTION_KEY')!,
    },
    flags: {
      nps: env.bool('FLAG_NPS', true),
      promoteEE: env.bool('FLAG_PROMOTE_EE', true),
      docLinks: env.bool('FLAG_DOC_LINKS', true),
    },
    preview: {
      enabled: env.bool('PREVIEW_ENABLED', true),
      config: {
        allowedOrigins: env.array('PREVIEW_ALLOWED_ORIGINS', [clientUrl ?? strapiUrl]),
        handler: async (uid, { documentId, locale, status }) => {
          const secret = env('PREVIEW_SECRET');
          if (!secret) {
            throw new Error('Preview secret is not set in environment variables.');
          }

          if (!clientUrl) {
            const searchParams = new URLSearchParams({ uid, documentId, secret });
            if (status) searchParams.set('status', status);
            if (locale) searchParams.set('locale', locale);
            return `${strapiUrl}/api/preview?${searchParams}`;
          }

          const document = await strapi.documents(uid as any).findOne({
            documentId,
            locale,
            status: status as 'draft' | 'published',
          });
          const pathname = getPreviewPathname(uid, document, locale);

          // Returning null hides the Preview button for this content type
          if (!pathname) {
            return null;
          }

          const searchParams = new URLSearchParams({ url: pathname, secret });
          if (status) searchParams.set('status', status);
          if (locale) searchParams.set('locale', locale);

          return `${clientUrl}/api/preview?${searchParams}`;
        },
      },
    },
  };
};

const getPreviewPathname = (uid: string, document: any, locale: any): string | null => {
  const slug = document?.slug;
  switch (uid) {
    case "api::page.page":
      switch (slug) {
        case "homepage":
          return `/${locale}`; // Localized homepage
        case "pricing":
          return "/pricing"; // Pricing page
        case "contact":
          return "/contact"; // Contact page
        case "faq":
          return "/faq"; // FAQ page
      }
      return null;
    case 'api::article.article':
      return document?.slug ? `/articles/${document.slug}` : '/articles';
    case 'api::category.category':
      return document?.slug ? `/categories/${document.slug}` : '/categories';
    case 'api::restaurant.restaurant':
      return document?.slug ? `/restaurants/${document.slug}` : '/restaurants';
    case 'api::about.about':
      return '/about';
    default:
      return null;
  }
};

export default config;
