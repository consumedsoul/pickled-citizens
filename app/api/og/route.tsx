import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const title = searchParams.get('title') || 'Pickled Citizens';
    const description = searchParams.get('description') || 'Pickleball League Management';
    const leagueName = searchParams.get('league') || '';
    const playerCount = searchParams.get('players') || '';
    const dateTime = searchParams.get('datetime') || '';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            position: 'relative',
          }}
        >
          {/* Background pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '40px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Logo area */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  backgroundColor: '#10b981',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px',
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: 'white',
                }}
              >
                PKLD
              </div>
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: 'white',
                  letterSpacing: '-1px',
                }}
              >
                Pickled Citizens
              </div>
            </div>

            {/* Session-specific info */}
            {(leagueName || playerCount || dateTime) && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  marginBottom: '24px',
                }}
              >
                {leagueName && (
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: '600',
                      color: '#10b981',
                      marginBottom: '8px',
                    }}
                  >
                    {leagueName}
                  </div>
                )}
                {playerCount && (
                  <div
                    style={{
                      fontSize: '20px',
                      color: '#e2e8f0',
                      marginBottom: '4px',
                    }}
                  >
                    🏓 {playerCount}
                  </div>
                )}
                {dateTime && (
                  <div
                    style={{
                      fontSize: '18px',
                      color: '#94a3b8',
                    }}
                  >
                    📅 {dateTime}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div
              style={{
                fontSize: '20px',
                color: '#cbd5e1',
                maxWidth: '800px',
                lineHeight: 1.5,
              }}
            >
              {description}
            </div>

            {/* Call to action */}
            <div
              style={{
                marginTop: '32px',
                backgroundColor: '#10b981',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: '600',
              }}
            >
              pickledcitizens.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
