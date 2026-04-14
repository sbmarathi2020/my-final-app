import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';


import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
    registerSW({
        onNeedRefresh() {
            if (confirm("नवीन अपडेट उपलब्ध आहे. ॲप रिफ्रेश करायचे का?")) {
                window.location.reload();
            }
        },
        onOfflineReady() {
            console.log("ॲप आता ऑफलाइन वापरण्यासाठी तयार आहे!");
        },
    });
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);