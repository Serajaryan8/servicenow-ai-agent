import React from 'react';
import ChatWindow from './ChatWindow';
import './ChatWindow.css';

const Modal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <ChatWindow />
      </div>
    </div>
  );
};

export default Modal;
