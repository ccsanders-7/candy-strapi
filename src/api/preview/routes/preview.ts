/**
 * preview router.
 *
 * Serves a simple HTML rendering of a document so the admin Preview panel
 * works without a separate frontend (e.g. Next.js).
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/preview',
      handler: 'preview.render',
      config: {
        // Guarded by PREVIEW_SECRET in the controller instead of API permissions
        auth: false,
      },
    },
  ],
};
