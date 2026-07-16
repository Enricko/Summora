import { Image as ImageIcon } from 'lucide-react';

export default function ImageQuestion({ question }) {
  // We use unsplash source as a mock for the requested image_search_query
  const encodedQuery = encodeURIComponent(question.image_search_query || question.topic);
  const imageUrl = `https://source.unsplash.com/400x300/?${encodedQuery}`;

  return (
    <div>
      <div style={{ 
        width: '100%', 
        height: '200px', 
        backgroundColor: 'rgba(0,0,0,0.3)', 
        borderRadius: '8px', 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* We use an img tag pointing to Unsplash for demo purposes */}
        <img src={imageUrl} alt={question.image_search_query} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none' }} />
        <ImageIcon size={48} style={{ opacity: 0.2, position: 'absolute' }} />
      </div>
      <p style={{ fontSize: '1.1rem', marginBottom: '1rem', textAlign: 'center' }}>{question.question}</p>
    </div>
  );
}
