export default function ShareTestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Social Share Preview Test</h1>
      
      <h2>Home Page Preview</h2>
      <p>When sharing the main site, you should see:</p>
      <ul>
        <li><strong>Title:</strong> Pickled Citizens - Pickleball League Management</li>
        <li><strong>Description:</strong> Lightweight pickleball league tool for scheduling sessions, tracking match history, and managing player rankings. Create leagues, organize games, and track your DUPR ratings.</li>
        <li><strong>Image:</strong> Dynamic OG image with Pickled Citizens branding</li>
      </ul>
      
      <h2>Session Page Preview</h2>
      <p>When sharing a session like <a href="/sessions/99901958-b5a0-4d35-ad0f-205c9d69e6d9">/sessions/99901958-b5a0-4d35-ad0f-205c9d69e6d9</a>, you should see:</p>
      <ul>
        <li><strong>Title:</strong> Summer Pickleball League - 8 Players</li>
        <li><strong>Description:</strong> Join 8 players for a pickleball session in Summer Pickleball League. Scheduled for Saturday, June 15, 2024 at 2:00 PM PDT.</li>
        <li><strong>Image:</strong> Dynamic OG image with league name, player count, and date/time</li>
      </ul>
      
      <h2>Test Links</h2>
      <ul>
        <li><a href="/" target="_blank">Home Page</a></li>
        <li><a href="/sessions/99901958-b5a0-4d35-ad0f-205c9d69e6d9" target="_blank">Sample Session Page</a></li>
        <li><a href="/api/og?title=Pickled%20Citizens&description=Pickleball%20League%20Management" target="_blank">Home OG Image</a></li>
        <li><a href="/api/og?title=Summer%20Pickleball%20League&description=8%20Players%20%E2%80%A2%20Saturday%2C%20June%2015%2C%202024%20at%202%3A00%20PM%20PDT&league=Summer%20Pickleball%20League&players=8%20Players&datetime=Saturday%2C%20June%2015%2C%202024%20at%202%3A00%20PM%20PDT" target="_blank">Session OG Image</a></li>
        <li><a href="/api/session/99901958-b5a0-4d35-ad0f-205c9d69e6d9/metadata" target="_blank">Session Metadata API</a></li>
      </ul>
      
      <h2>How to Test</h2>
      <ol>
        <li>Use social media preview tools like:</li>
        <ul>
          <li><a href="https://developers.facebook.com/tools/debug/" target="_blank">Facebook Sharing Debugger</a></li>
          <li><a href="https://cards-dev.twitter.com/validator" target="_blank">Twitter Card Validator</a></li>
          <li><a href="https://www.linkedin.com/post-inspector/" target="_blank">LinkedIn Post Inspector</a></li>
        </ul>
        <li>Enter your URLs (replace localhost with your deployed domain)</li>
        <li>Verify the title, description, and image appear correctly</li>
      </ol>
      
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '8px' }}>
        <h3>Deployment Notes</h3>
        <p><strong>Remember to:</strong></p>
        <ul>
          <li>Replace the mock metadata API with real Supabase data for production</li>
          <li>Update the <code>NEXT_PUBLIC_SITE_URL</code> environment variable to your deployed domain</li>
          <li>Ensure the <code>SUPABASE_SERVICE_ROLE_KEY</code> is properly configured in production</li>
        </ul>
      </div>
    </div>
  );
}
