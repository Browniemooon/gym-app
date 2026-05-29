import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppWithBoundary from './App.tsx';
import './index.css';
import './registerSW';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithBoundary />
  </StrictMode>,
);
