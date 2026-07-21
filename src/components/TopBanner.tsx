// src/components/TopBanner.tsx
// Personalised notification banner.
// Runs as a Next.js Server Component — fetches from the internal API route
// on the server before streaming HTML to the browser, so students see their
// message immediately (no client-side flicker).

import { StudentProfile } from "@/types/student";

interface TopBannerProps {
  profile: StudentProfile;
}

/**
 * Server Component: fetches the personalised notification for this student,
 * then renders the banner with the returned text.
 *
 * Wrapped in <Suspense> from the parent page so the rest of the page
 * renders while this is in-flight.
 */
export default async function TopBanner({ profile }: TopBannerProps) {
  const notification = await fetchNotification(profile);

  return (
    <div
      role="banner"
      aria-label="Personalised student notification"
      className="w-full bg-blue-800 text-white px-6 py-3 flex items-center justify-between gap-4 shadow-md"
    >
      {/* Bell icon + message */}
      <div className="flex items-center gap-3 min-w-0">
        <BellIcon />
        <p className="text-sm font-medium leading-snug truncate">
          {notification}
        </p>
      </div>

      {/* Dismiss button — purely cosmetic here; wire up state if needed */}
      <DismissButton />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchNotification(profile: StudentProfile): Promise<string> {
  try {
    // In production this URL comes from an env var so it works in all envs.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
      // Revalidate every 5 minutes — Bedrock responses are cached per build
      // by default in Next.js; force dynamic if you want per-request freshness.
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error(`Notification API error: ${res.status}`);
      return DEFAULT_NOTIFICATION;
    }

    const data = await res.json();
    return data.notification ?? DEFAULT_NOTIFICATION;
  } catch (err) {
    console.error("Failed to fetch notification:", err);
    return DEFAULT_NOTIFICATION;
  }
}

const DEFAULT_NOTIFICATION =
  "Welcome to the Student Portal! Check out today's campus resources and announcements.";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-5 h-5 shrink-0 text-yellow-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function DismissButton() {
  return (
    <button
      type="button"
      aria-label="Dismiss notification"
      className="shrink-0 text-blue-200 hover:text-white transition-colors text-xs underline underline-offset-2"
    >
      Dismiss
    </button>
  );
}
