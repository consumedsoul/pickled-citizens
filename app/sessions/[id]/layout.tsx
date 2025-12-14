import { Metadata } from 'next';
import { supabaseServiceRole } from '@/lib/supabaseClient';

// Helper function to format date for OG image
const formatDateTimeForTitle = (value: string | null) => {
  if (!value) return 'Not scheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    hour12: true,
  }).replace(',', '').replace(/:\d{2}\s/, ' ');
};

interface SessionLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: SessionLayoutProps): Promise<Metadata> {
  const sessionId = params.id;
  
  try {
    const { data: sessionRow, error: sessionError } = await supabaseServiceRole
      .from('game_sessions')
      .select('scheduled_for, player_count, league:leagues(name)')
      .eq('id', sessionId)
      .maybeSingle();

    if (!sessionError && sessionRow) {
      const leagueRel: any = (sessionRow as any).league;
      const leagueName =
        Array.isArray(leagueRel) && leagueRel.length > 0
          ? leagueRel[0]?.name ?? null
          : leagueRel?.name ?? null;

      const title = 'Pickleball Session - Pickled Citizens';
      const description = `${leagueName || 'Pickleball Session'} | ${sessionRow.player_count} Players | ${formatDateTimeForTitle(sessionRow.scheduled_for)}`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `https://pickledcitizens.com/sessions/${sessionId}`,
          siteName: 'Pickled Citizens',
          locale: 'en_US',
          type: 'website',
          images: [
            {
              url: 'https://pickledcitizens.com/images/Pickled-Citizens-Logo-Social.png',
              width: 1200,
              height: 630,
              alt: 'Pickled Citizens Logo',
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: ['https://pickledcitizens.com/images/Pickled-Citizens-Logo-Social.png'],
        },
      };
    }
  } catch (error) {
    console.error('Failed to load session metadata:', error);
  }
  
  // Fallback metadata - with logo and updated description format
  return {
    title: 'Pickleball Session - Pickled Citizens',
    description: 'Pickleball Session | 0 Players | Not scheduled',
    openGraph: {
      title: 'Pickleball Session - Pickled Citizens',
      description: 'Pickleball Session | 0 Players | Not scheduled',
      url: `https://pickledcitizens.com/sessions/${sessionId}`,
      siteName: 'Pickled Citizens',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: 'https://pickledcitizens.com/images/Pickled-Citizens-Logo-Social.png',
          width: 1200,
          height: 630,
          alt: 'Pickled Citizens Logo',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Pickleball Session - Pickled Citizens',
      description: 'Pickleball Session | 0 Players | Not scheduled',
      images: ['https://pickledcitizens.com/images/Pickled-Citizens-Logo-Social.png'],
    },
  };
}

export default function SessionLayout({ children }: SessionLayoutProps) {
  return children;
}
