import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SimpleCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  const daysOfWeek = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    
    // Start from Monday (adjust for Monday as first day)
    const dayOfWeek = (firstDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    startDate.setDate(firstDay.getDate() - dayOfWeek);

    const days = [];
    const current = new Date(startDate);

    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      days.push({
        date: new Date(current),
        day: current.getDate(),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.toDateString() === new Date().toDateString()
      });
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const calendarDays = getCalendarDays();

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={previousMonth}
            className="p-1 hover:bg-blue-700 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          
          <h2 className="text-lg font-semibold">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          
          <button 
            onClick={nextMonth}
            className="p-1 hover:bg-blue-700 rounded"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Month tabs */}
        <div className="flex space-x-1">
          {['juil.', 'août', 'sept.', 'oct.', 'nov.'].map((month, index) => (
            <button
              key={month}
              className={`px-3 py-1 rounded text-sm ${
                index === 1 ? 'bg-white text-blue-600' : 'text-blue-200 hover:text-white'
              }`}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map(day => (
            <div key={day} className="text-center text-sm text-gray-500 font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => (
            <button
              key={index}
              onClick={() => setSelectedDate(day.date)}
              className={`
                h-10 w-10 rounded-full text-sm font-medium transition-colors
                ${day.isCurrentMonth 
                  ? day.isToday
                    ? 'bg-yellow-400 text-white'
                    : selectedDate?.toDateString() === day.date.toDateString()
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-900 hover:bg-blue-100'
                  : 'text-gray-300'
                }
              `}
            >
              {day.day}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SimpleCalendar;
