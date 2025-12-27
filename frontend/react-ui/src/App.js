import React, { useState } from 'react';
import Modal from './components/Modal';

const App = () => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ padding: '50px' }}>
      <h1>ServiceNow AI Assistant</h1>
      <button onClick={() => setOpen(true)}>Open AI Agent</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
};

export default App;
