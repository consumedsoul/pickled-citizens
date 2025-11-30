import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const title = searchParams.get('title') || 'Pickled Citizens';
    const description = searchParams.get('description') || 'Pickleball Team Battle Management Tool';

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
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center',
            padding: '60px',
          }}
        >          
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '30px',
              color: '#10b981',
            }}
          >
            PKLD
          </div>
          
          <div
            style={{
              fontSize: '36px',
              fontWeight: 'bold',
              marginBottom: '40px',
            }}
          >
            Pickled Citizens
          </div>

          <div
            style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#10b981',
              marginBottom: '20px',
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: '24px',
              color: '#e2e8f0',
              marginBottom: '40px',
            }}
          >
            {description}
          </div>

          <div
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '8px',
              fontSize: '20px',
              fontWeight: '600',
            }}
          >
            pickledcitizens.com
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
