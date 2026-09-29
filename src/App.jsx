import React, { Suspense, lazy } from 'react';
import Shortcuts from './comp/Shortcuts.jsx';

// three.js is large, so the 3D background loads in its own chunk after the app is usable.
const MinecraftScene = lazy(() => import('./comp/MinecraftScene.jsx'));

function App() {
  return (
    <>
      <Suspense fallback={null}>
        <MinecraftScene />
      </Suspense>
      <Shortcuts />
    </>
  )
}

export default App
