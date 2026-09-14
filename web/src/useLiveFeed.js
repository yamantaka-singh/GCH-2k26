import { useEffect, useRef, useState } from 'react'
import { fetchLiveUrl } from './api'
import { attachWhep } from './liveFeed'

// Connects a <video> to the real grid feed over WHEP when the camera has one;
// otherwise reports why not, so the caller can show an honest state instead
// of a stock clip or a silently black frame. Shared by CameraInspector and
// VideoWall so the connection logic exists in exactly one place.
export function useLiveFeed(cameraId) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('connecting') // 'connecting' | 'live' | 'error'
  const [message, setMessage] = useState(null)

  useEffect(() => {
    setStatus('connecting')
    setMessage(null)
    if (!cameraId || !videoRef.current) return undefined
    let detach = () => {}
    let cancelled = false
    fetchLiveUrl(cameraId)
      .then(({ whep_url }) => {
        if (!cancelled) {
          detach = attachWhep(videoRef.current, whep_url, () => {
            if (!cancelled) {
              setStatus('error')
              setMessage('Linked, but the feed is not responding.')
            }
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
          setMessage('No live grid feed linked to this camera.')
        }
      })
    return () => { cancelled = true; detach() }
  }, [cameraId])

  return { videoRef, status, message, onLoadedData: () => setStatus('live') }
}
