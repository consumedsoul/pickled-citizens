import { Metadata } from 'next';
import { getSessionById } from '@/lib/db/queries/sessions';
import { getLeagueById } from '@/lib/db/queries/leagues';

const DISPLAY_TIMEZONE = process.env.DISPLAY_TIMEZONE || 'America/Los_Angeles';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pickledcitizens.com';

const formatDateTimeForTitle = (value: string | null) => {
  if (!value) return 'Not scheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not scheduled';
  return d
    .toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: DISPLAY_TIMEZONE,
      hour12: true,
    })
    .replace(',', '')
    .replace(/:\d{2}\s/, ' ');
};

interface SessionLayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

export async function generateMetadata({
  params,
}: SessionLayoutProps): Promise<Metadata> {
  const sessionId = params.id;
  const fallbackTitle = 'Pickleball Session - Pickled Citizens';
  const fallbackDescription = 'Pickleball Session | 0 Players | Not scheduled';

  const baseOg = {
    siteName: 'Pickled Citizens' as const,
    locale: 'en_US' as const,
    type: 'website' as const,
    url: `${siteUrl}/sessions/${sessionId}`,
    images: [
      {
        url: `${siteUrl}/images/Pickled-Citizens-Logo-Social.png`,
        width: 1200,
        height: 630,
        alt: 'Pickled Citizens Logo',
      },
    ],
  };

  try {
    const session = await getSessionById(sessionId);
    if (session) {
      const league = session.leagueId ? await getLeagueById(session.leagueId) : null;
      const leagueName = league?.name ?? null;
      const description = `${leagueName || 'Pickleball Session'} | ${session.playerCount} Players | ${formatDateTimeForTitle(session.scheduledFor)}`;
      return {
        title: fallbackTitle,
        description,
        openGraph: { ...baseOg, title: fallbackTitle, description },
        twitter: {
          card: 'summary_large_image',
          title: fallbackTitle,
          description,
          images: [`${siteUrl}/images/Pickled-Citizens-Logo-Social.png`],
        },
      };
    }
  } catch {
    // Fall through to fallback
  }

  return {
    title: fallbackTitle,
    description: fallbackDescription,
    openGraph: { ...baseOg, title: fallbackTitle, description: fallbackDescription },
    twitter: {
      card: 'summary_large_image',
      title: fallbackTitle,
      description: fallbackDescription,
      images: [`${siteUrl}/images/Pickled-Citizens-Logo-Social.png`],
    },
  };
}

export default function SessionLayout({ children }: SessionLayoutProps) {
  return children;
}
