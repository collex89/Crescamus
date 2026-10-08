import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// The app shell's height, measured. CSS viewport units each get one
// platform wrong: svh (used before this) is computed in an iPhone Home
// Screen app as if Safari's toolbars were still there, leaving a ~180pt
// empty strip under the bottom nav; dvh clips the nav on some Android
// browsers. innerHeight is the real visible height everywhere. Set before
// the first render so there's no jump; .device-container falls back to
// 100svh if this never runs.
function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
