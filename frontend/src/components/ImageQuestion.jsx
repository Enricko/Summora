import { useEffect, useState } from 'react'
import { Image as ImageIcon, LoaderCircle } from 'lucide-react'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

export default function ImageQuestion({ question }) {
  const query = (question.image_search_query || question.topic || question.question).slice(0, 140)
  const [image, setImage] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6',
      gsrlimit: '5', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1000',
      format: 'json', origin: '*',
    })

    setStatus('loading')
    fetch(`${COMMONS_API}?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Image lookup failed')
        return response.json()
      })
      .then((data) => {
        const pages = Object.values(data.query?.pages || {})
        const match = pages.find((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
        if (!match) throw new Error('No matching image')
        const info = match.imageinfo[0]
        setImage({
          url: info.thumburl || info.url,
          alt: match.title?.replace(/^File:/, '') || query,
          source: info.descriptionurl,
        })
        setStatus('ready')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error')
      })

    return () => controller.abort()
  }, [query])

  return (
    <div className="image-question">
      <div className={`question-image ${status}`}>
        {status === 'loading' && <div className="image-state"><LoaderCircle className="image-spinner" size={28} /><span>Finding a relevant image…</span></div>}
        {status === 'ready' && image && (
          <>
            <img src={image.url} alt={image.alt} onError={() => setStatus('error')} />
            {image.source && <a href={image.source} target="_blank" rel="noreferrer">Image from Wikimedia Commons</a>}
          </>
        )}
        {status === 'error' && (
          <div className="image-state image-fallback" role="img" aria-label={`Visual prompt for ${query}`}>
            <ImageIcon size={34} />
            <strong>Visual prompt</strong>
            <span>{query}</span>
          </div>
        )}
      </div>
      <p>{question.question}</p>
    </div>
  )
}
