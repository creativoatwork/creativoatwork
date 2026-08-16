import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './admin.css';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectPage } from './pages/ProjectPage';

// createRoot, never hydrateRoot: this entry is not prerendered, so there is no server markup to
// match. That is the whole reason /admindash is a separate Vite entry rather than a route in the
// marketing app — see the spec, section 3.1.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/admindash">
      <AuthProvider>
        <RequireAuth>
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/:id" element={<ProjectPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RequireAuth>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
