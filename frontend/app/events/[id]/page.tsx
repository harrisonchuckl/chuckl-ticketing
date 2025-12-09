// frontend/app/events/[id]/page.tsx
import { notFound } from 'next/navigation';

// 1. Fetch Helper
async function getEvent(id: string) {
  // Use the API URL from your environment variables
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/events/${id}`, { 
    cache: 'no-store' 
  });
  
  if (!res.ok) return null;
  return res.json();
}

export default async function EventPage({ params }: { params: { id: string } }) {
  // 2. Fetch Data
  const response = await getEvent(params.id);

  // 3. Handle 404 / Errors
  if (!response || !response.ok || !response.show) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Event Not Found</h1>
        <p style={{ color: '#666' }}>This event may have been removed or is not yet live.</p>
      </div>
    );
  }

  const { show } = response;
  const { venue, ticketTypes } = show;
  
  // 4. Format Date & Time
  const dateObj = new Date(show.date);
  const dateStr = dateObj.toLocaleDateString('en-GB', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });
  const timeStr = dateObj.toLocaleTimeString('en-GB', { 
    hour: '2-digit', minute: '2-digit' 
  });

  // 5. Render Page
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827' }}>
      
      {/* --- HERO IMAGE --- */}
      {show.imageUrl && (
        <div style={{ marginBottom: '32px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <img 
            src={show.imageUrl} 
            alt={show.title} 
            style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'cover', display: 'block' }} 
          />
        </div>
      )}

      {/* --- HEADER --- */}
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '12px', lineHeight: '1.2' }}>
          {show.title}
        </h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#4b5563', fontSize: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📅</span>
            <strong>{dateStr}</strong> at {timeStr}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📍</span>
            <span>
              <strong>{venue?.name}</strong>
              {venue?.city ? `, ${venue.city}` : ''}
            </span>
          </div>
        </div>
      </header>

      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '32px 0' }} />

      {/* --- TICKETS SECTION --- */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Select Tickets</h2>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          {ticketTypes.map((ticket: any) => {
            const price = (ticket.pricePence || 0) / 100;
            const isAvailable = ticket.available === null || ticket.available > 0;

            return (
              <div key={ticket.id} style={{ 
                border: '1px solid #e5e7eb', 
                padding: '16px', 
                borderRadius: '8px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                backgroundColor: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                    {ticket.name}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '14px' }}>
                    {isAvailable ? 'Available' : 'Sold Out'}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700' }}>
                    {price === 0 ? 'Free' : `£${price.toFixed(2)}`}
                  </div>
                  <button 
                    disabled={!isAvailable}
                    style={{ 
                      background: isAvailable ? '#111827' : '#e5e7eb', 
                      color: isAvailable ? '#fff' : '#9ca3af', 
                      border: 'none', 
                      padding: '10px 20px', 
                      borderRadius: '6px', 
                      fontWeight: '600',
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- DESCRIPTION --- */}
      <section>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>About this event</h2>
        <div 
          dangerouslySetInnerHTML={{ __html: show.descriptionHtml || show.description || '' }} 
          style={{ lineHeight: '1.6', color: '#374151' }}
        />
      </section>

    </div>
  );
}
