// WHEP (WebRTC-HTTP Egress Protocol) client: native RTCPeerConnection + fetch,
// no library -- the grid's browser-preview endpoint is a plain WHEP server.
export function attachWhep(videoEl, whepUrl) {
  const pc = new RTCPeerConnection()
  pc.addTransceiver('video', { direction: 'recvonly' })
  pc.ontrack = (e) => { videoEl.srcObject = e.streams[0] }

  // fetch() refuses to build a Request from a URL carrying credentials (Fetch
  // spec, unlike ffplay/curl) -- pull them out and send as a normal Basic
  // auth header against the same, now credential-free, URL instead.
  const url = new URL(whepUrl)
  const auth = url.username
    ? `Basic ${btoa(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`)}`
    : null
  url.username = ''
  url.password = ''

  let cancelled = false
  pc.createOffer()
    .then((offer) => pc.setLocalDescription(offer).then(() => offer))
    .then((offer) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', ...(auth ? { Authorization: auth } : {}) },
        body: offer.sdp,
      }),
    )
    .then((res) => {
      if (!res.ok) throw new Error(`WHEP offer rejected: ${res.status}`)
      return res.text()
    })
    .then((answerSdp) => {
      if (!cancelled) pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    })
    .catch((err) => console.error('live feed connect failed:', err))

  // skipped: no DELETE of the WHEP session resource on close -- the grid times
  // out idle sessions server-side; add it if that measurably matters.
  return () => { cancelled = true; pc.close() }
}
