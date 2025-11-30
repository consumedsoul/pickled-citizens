import { Metadata } from 'next';

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
      
      const title = `${sessionData.league_name || 'Pickleball Session'} - ${sessionData.player_count} Players`;
      const description = `Join ${sessionData.player_count} players for a pickleball session${sessionData.league_name ? ` in ${sessionData.league_name}` : ''}. Scheduled for ${sessionData.formatted_date}.`;
      
      // Build OG image URL with session-specific parameters
      const ogImageUrl = new URL('https://pickledcitizens.com/api/og');
      ogImageUrl.searchParams.set('title', sessionData.league_name || 'Pickleball Session');
      ogImageUrl.searchParams.set('description', `${sessionData.player_count} Players • ${sessionData.formatted_date}`);
      ogImageUrl.searchParams.set('league', sessionData.league_name || '');
      ogImageUrl.searchParams.set('players', `${sessionData.player_count} Players`);
      ogImageUrl.searchParams.set('datetime', sessionData.formatted_date);
      
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
