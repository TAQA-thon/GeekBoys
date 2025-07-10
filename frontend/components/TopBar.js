import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, LogOut } from 'lucide-react';

export default function TopBar({ onLogout, onEditProfile, onMenuToggle }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white shadow-sm border-b px-6 py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Menu and Search */}
        <div className="flex items-center space-x-4">
          {/* You can add menu/search here */}
        </div>

        {/* Right: Notifications, Settings Dropdown */}
        <div className="flex items-center space-x-6 relative">
          {/* <button
            className="relative p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-6 h-6 text-gray-600 hover:text-gray-900" />
            <span className="absolute top-0 right-0 inline-flex h-2 w-2 rounded-full bg-red-500"></span>
          </button> */}

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center space-x-1 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors"
            aria-haspopup="true"
            aria-expanded={settingsOpen}
            aria-label="User settings"
          >
            <LogOut className="w-5 h-5 text-gray-600" />
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>

          {/* Dropdown menu */}
          {settingsOpen && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="user-menu"
            >
              {/* <button
                onClick={() => {
                  setSettingsOpen(false);
                  onEditProfile && onEditProfile();
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
              >
                Edit Profile
              </button> */}
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  onLogout && onLogout();
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}