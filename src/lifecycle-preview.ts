// Activation requires verified staging Auth/schema gates; absent means preview-only.
export const accountLifecycleEnabled = process.env.NEXT_PUBLIC_ACCOUNT_LIFECYCLE_ENABLED === 'true';
export const lifecyclePreviewMessage = 'Belum diaktifkan pada preview';
