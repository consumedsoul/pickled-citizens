import { Metadata } from 'next';

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
  
  // Fetch session data for metadata
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://pickledcitizens.com'}/api/session/${sessionId}/metadata`, {
      cache: 'no-store',
    });
    
    if (response.ok) {
      const sessionData = await response.json();
      
      const title = sessionData.title || `${sessionData.league_name || 'Pickleball Session'} - ${sessionData.player_count} Players`;
      const description = sessionData.description || `Join ${sessionData.player_count} players for a pickleball session${sessionData.league_name ? ` in ${sessionData.league_name}` : ''}. Scheduled for ${sessionData.formatted_date}.`;
      
      // Build OG image URL with session-specific parameters
      const ogImageUrl = new URL('https://pickledcitizens.com/api/og');
      ogImageUrl.searchParams.set('title', sessionData.title || `${sessionData.league_name || 'Pickleball Session'} - ${sessionData.player_count} Players`);
      ogImageUrl.searchParams.set('description', `${sessionData.player_count} Players - ${formatDateTimeForTitle(sessionData.scheduled_for)}`);
      
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `https://pickledcitizens.com/sessions/${sessionId}`,
          siteName: 'Pickled Citizens',
          images: [
            {
              url: ogImageUrl.toString(),
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
          locale: 'en_US',
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [ogImageUrl.toString()],
        },
      };
    }
  } catch (error) {
    console.error('Failed to fetch session metadata:', error);
  }
  
  // Fallback metadata
  const fallbackOgUrl = new URL('https://pickledcitizens.com/api/og');
  fallbackOgUrl.searchParams.set('title', 'Pickleball Session');
  fallbackOgUrl.searchParams.set('description', 'Join a pickleball session and track your match results');
  
  return {
    title: 'Pickleball Session - Pickled Citizens',
    description: 'Join a pickleball session and track your match results.',
    openGraph: {
      title: 'Pickleball Session - Pickled Citizens',
      description: 'Join a pickleball session and track your match results.',
      url: `https://pickledcitizens.com/sessions/${sessionId}`,
      siteName: 'Pickled Citizens',
      images: [
        {
          url: fallbackOgUrl.toString(),
          width: 1200,
          height: 630,
          alt: 'Pickleball Session - Pickled Citizens',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Pickleball Session - Pickled Citizens',
      description: 'Join a pickleball session and track your match results.',
      images: [fallbackOgUrl.toString()],
    },
  };
}

export default function SessionLayout({ children }: SessionLayoutProps) {
  return children;
}
