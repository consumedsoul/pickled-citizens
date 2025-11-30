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
            padding: '40px',
          }}
        >          
          <div
            style={{
              fontSize: '60px',
              fontWeight: 'bold',
              marginBottom: '20px',
              color: '#10b981',
            }}
          >
            PKLD
          </div>
          
          <div
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '30px',
            }}
          >
            Pickled Citizens
          </div>

          <div
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#10b981',
              marginBottom: '15px',
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: '18px',
              color: '#e2e8f0',
              marginBottom: '30px',
            }}
          >
            {description}
          </div>

          <div
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '6px',
              fontSize: '16px',
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
    console.log(`OG Image Error: ${e.message}`);
    return new Response(`Failed to generate the image: ${e.message}`, {
      status: 500,
    });
  }
}
