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
      
      const title = 'Pickleball Session - Pickled Citizens';
      const description = `${sessionData.league_name || 'Pickleball Session'} | ${sessionData.player_count} Players | ${formatDateTimeForTitle(sessionData.scheduled_for)}`;
      
      // Remove OG image for social previews
      // Social platforms will not show images without explicit og:image tags
      
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
        },
        twitter: {
          card: 'summary',
          title,
          description,
        },
      };
    }
  } catch (error) {
    console.error('Failed to fetch session metadata:', error);
  }
  
  // Fallback metadata - no images, updated description format
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
    },
    twitter: {
      card: 'summary',
      title: 'Pickleball Session - Pickled Citizens',
      description: 'Pickleball Session | 0 Players | Not scheduled',
    },
  };
}

export default function SessionLayout({ children }: SessionLayoutProps) {
  return children;
}
