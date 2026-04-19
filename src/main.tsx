
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import "leaflet/dist/leaflet.css";   // if you’re not relying on the <link> in index.html
import "./leaflet-icons";            // the file above

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>
)
