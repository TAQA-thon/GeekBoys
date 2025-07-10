import React, { useState } from "react";
import { MessageCircle, X } from 'lucide-react';

export default function ChatbotButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Chatbot toggle button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg z-50 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Open Chatbot"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Overlay and chatbot window */}
      {open && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm transition-opacity"
          aria-modal="true"
          role="dialog"
          aria-labelledby="chatbot-title"
        >
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
              aria-label="Close Chatbot"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Optional header */}
            <header className="p-4 border-b border-gray-200 text-lg font-semibold text-gray-800" id="chatbot-title">
              Chatbot
            </header>

            {/* Chatbot iframe */}
            <iframe
              src="https://f88d2cdbbf3a.ngrok-free.app/chat/share?shared_id=d13464f45b7111f0bf0a4a50e63bfe3f&from=agent&auth=cxNTg3MTJlNWNkOTExZjBiYzk1ZjY5NW&locale=en"
              style={{ flexGrow: 1, border: 'none' }}
              title="Taqa Chatbot"
              allow="microphone; camera"
            />
          </div>
        </div>
      )}
    </>
  );
}