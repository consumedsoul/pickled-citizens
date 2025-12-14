import { Suspense } from 'react';
import AdminEventsClient from './AdminEventsClient';

export default function AdminEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="section">
          <h1 className="section-title">Admin events</h1>
          <p className="hero-subtitle">Loading admin event log...</p>
        </div>
      }
    >
      <AdminEventsClient />
    </Suspense>
  );
}
