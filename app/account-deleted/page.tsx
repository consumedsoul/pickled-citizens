'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountDeletedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home after 5 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="section" style={{ maxWidth: 500, textAlign: 'center' }}>
      <h1 className="section-title">Account Deleted</h1>
      
      <div style={{ 
        fontSize: '3rem', 
        marginBottom: '1rem',
        color: '#10b981'
      }}>
        ✅
      </div>
      
      <p className="hero-subtitle" style={{ marginBottom: '1.5rem' }}>
        Your account has been successfully deleted. All your profile data, league memberships, and associated information has been permanently removed.
      </p>
      
      <div style={{
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac',
        borderRadius: '0.5rem',
        padding: '1rem',
        marginBottom: '1.5rem'
      }}>
        <p style={{ 
          margin: 0,
          fontSize: '0.9rem',
          color: '#166534'
        }}>
          <strong>What's next?</strong><br/>
          You can sign up again at any time with the same or a different email address to create a fresh account.
        </p>
      </div>
      
      <p className="hero-subtitle" style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
        You will be redirected to the home page automatically in 5 seconds...
      </p>
      
      <div style={{ marginTop: '2rem' }}>
        <a href="/" className="btn-primary">
          Go to Home Page Now
        </a>
      </div>
    </div>
  );
}
