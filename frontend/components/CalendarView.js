import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import apiService from '../services/api';

export default function DynamicCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(),
    color: 'bg-blue-500',
  });

  // Tab state for modal
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'anomalies'
  const [scheduledAnomalies, setScheduledAnomalies] = useState([]);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);

  // Color generation state to avoid repeated colors
  const colorIndexRef = useRef(0);

  // Drag select state for creating new event
  const [dragSelecting, setDragSelecting] = useState(false);
  const [dragStartDay, setDragStartDay] = useState(null);
  const [dragEndDay, setDragEndDay] = useState(null);

  // Drag & resize state for existing events
  const [draggingEventId, setDraggingEventId] = useState(null);
  const [draggingType, setDraggingType] = useState(null); // 'move', 'resize-left', 'resize-right'
  const [dragStartDayDrag, setDragStartDayDrag] = useState(null);
  const [dragCurrentDayDrag, setDragCurrentDayDrag] = useState(null);
  const [originalEventData, setOriginalEventData] = useState(null);

  const colors = [
    { name: 'Blue', class: 'bg-blue-500' },
    { name: 'Green', class: 'bg-green-500' },
    { name: 'Red', class: 'bg-red-500' },
    { name: 'Purple', class: 'bg-purple-500' },
    { name: 'Orange', class: 'bg-orange-500' },
    { name: 'Pink', class: 'bg-pink-500' },
  ];

  // Function to generate random colors that increment logically
  const generateRandomColor = () => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
      'bg-yellow-500', 'bg-cyan-500', 'bg-lime-500', 'bg-amber-500'
    ];
    
    // Get the current color in sequence
    const selectedColor = colors[colorIndexRef.current];
    
    // Move to next color, wrap around when reaching the end
    colorIndexRef.current = (colorIndexRef.current + 1) % colors.length;
    
    console.log("Selected color:", selectedColor, "Index:", colorIndexRef.current);
    
    return selectedColor;
  };

  useEffect(() => {
    setCurrentDate(new Date());
    fetchTimeSlots();
    // eslint-disable-next-line
  }, []);

  const fetchTimeSlots = async () => {
    try {
      // Use the correct apiService (from api.js)
      const response = await apiService.getTimeSlots();
      // Handle different response structures
      let slots = response;
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        if (response.time_slots) {
          slots = response.time_slots;
        } else if (response.slots) {
          slots = response.slots;
        } else if (response.data) {
          slots = response.data;
        } else {
          setEvents([]);
          return;
        }
      }
      if (!slots || !Array.isArray(slots) || slots.length === 0) {
        setEvents([]);
        return;
      }
      const transformedEvents = slots.map(slot => {
        const parseDate = (dateString) => {
          const [year, month, day] = dateString.split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        const startDate = parseDate(slot.start_date);
        const endDate = parseDate(slot.end_date);
        const event = {
          id: slot._id || slot.id,
          title: slot.title,
          description: slot.description,
          startDate: startDate,
          endDate: endDate,
          color: getColorByType(slot.type),
          duration_days: slot.duration_days,
          duration_hours: slot.duration_hours,
          scheduled_anomalies: slot.scheduled_anomalies,
        };
        return event;
      });
      setEvents(transformedEvents);
    } catch (err) {
      console.error("Error fetching time slots:", err);
      setEvents([]);
    }
  };

  const getColorByType = (type) => {
    const typeColorMap = {
      maintenance: 'bg-blue-500',
      planned: 'bg-green-500',
      outage: 'bg-red-500',
      default: 'bg-purple-500',
      urgent: 'bg-orange-500',
      scheduled: 'bg-pink-500',
      upgrade: 'bg-indigo-500',
      backup: 'bg-teal-500',
      inspection: 'bg-yellow-500',
      testing: 'bg-cyan-500',
      deployment: 'bg-lime-500',
      monitoring: 'bg-amber-500',
    };
    return typeColorMap[type?.toLowerCase()] || 'bg-gray-500';
  };

  const getTypeByColor = (color) => {
    const colorTypeMap = {
      'bg-blue-500': 'maintenance',
      'bg-green-500': 'planned',
      'bg-red-500': 'outage',
      'bg-purple-500': 'default',
      'bg-orange-500': 'urgent',
      'bg-pink-500': 'scheduled',
      'bg-indigo-500': 'upgrade',
      'bg-teal-500': 'backup',
      'bg-yellow-500': 'inspection',
      'bg-cyan-500': 'testing',
      'bg-lime-500': 'deployment',
      'bg-amber-500': 'monitoring',
    };
    return colorTypeMap[color] || 'default';
  };

  // Navigation
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    clearDragSelection();
    cancelDrag();
  };

  const navigateToToday = () => {
    setCurrentDate(new Date());
    clearDragSelection();
    cancelDrag();
  };

  // Clear drag select for new event
  const clearDragSelection = () => {
    setDragSelecting(false);
    setDragStartDay(null);
    setDragEndDay(null);
  };

  // Clear drag for existing event
  const cancelDrag = () => {
    setDraggingEventId(null);
    setDraggingType(null);
    setDragStartDayDrag(null);
    setDragCurrentDayDrag(null);
    setOriginalEventData(null);
  };

  // Get day number from mouse position
  const getDayFromMousePosition = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
  
    const adjustedY = y - 56; // header height
    if (adjustedY < 0) return null;
  
    const dayWidth = rect.width / 7;
    const dayHeight = 104;
  
    const col = Math.floor(x / dayWidth);
    const row = Math.floor(adjustedY / dayHeight);
  
    if (col < 0 || col >= 7 || row < 0) return null;
  
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const offset = firstDayOfMonth.getDay();
  
    const dayInGrid = row * 7 + col;
    let dayNumber = dayInGrid - offset + 1;
  
    // Clamp dayNumber to valid range
    const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    if (dayNumber < 1) dayNumber = 1;
    if (dayNumber > daysInCurrentMonth) dayNumber = daysInCurrentMonth;
  
    // Debug log
    console.log({ x, y, col, row, dayInGrid, offset, dayNumber });
  
    return dayNumber;
  };

  // Get days in month with offset for first day of week
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const formatMonth = (date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Get grid position for event (accounting for header row)
  const getEventGridPosition = (event) => {
    const startDay = event.startDate.getDate();
    const endDay = event.endDate.getDate();
    
    // Get the offset for the first day of the month
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const offset = firstDay.getDay();
    
    // Calculate grid positions (adding 1 for CSS grid 1-based indexing)
    const startCol = (offset + startDay - 1) % 7 + 1;
    const endCol = (offset + endDay - 1) % 7 + 2; // +2 because grid-column-end is exclusive
    
    // Calculate which row the event should be in (adding 2 to account for header row)
    const startRow = Math.floor((offset + startDay - 1) / 7) + 2;
    const endRow = Math.floor((offset + endDay - 1) / 7) + 2;
    
    return {
      gridColumnStart: startCol,
      gridColumnEnd: endCol > startCol ? endCol : startCol + 1,
      gridRowStart: startRow,
      gridRowEnd: endRow + 1,
    };
  };

  // Check if a day is in drag select range
  const isDayInDragSelection = (day) => {
    if (!dragStartDay || !dragEndDay || !day) return false;
    const start = Math.min(dragStartDay, dragEndDay);
    const end = Math.max(dragStartDay, dragEndDay);
    return day >= start && day <= end;
  };

  // Check if a day is within event range
  const isDayInEvent = (event, day) => {
    if (!day) return false;
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return dayDate >= event.startDate && dayDate <= event.endDate;
  };

  // Get events for a day
  const getEventsForDay = (day) => {
    if (!day) return [];
    return events.filter((event) => isDayInEvent(event, day));
  };

  // Drag select handlers for creating new event
  const handleDayMouseDown = (day) => {
    if (!day) return;
    setDragSelecting(true);
    setDragStartDay(day);
    setDragEndDay(day);
  };

  const handleDayMouseEnter = (day) => {
    if (dragSelecting && day && day !== dragEndDay) {
      setDragEndDay(day);
    }
  };

  // Handle mouse move for event resizing
  const handleMouseMove = (e) => {
    if (draggingEventId !== null && draggingType !== null) {
      const day = getDayFromMousePosition(e);
      if (day !== null) {
        setDragCurrentDayDrag(day);
        
        // Update event in real-time during drag
        const event = originalEventData;
        if (event) {
          let newStartDate = new Date(event.startDate);
          let newEndDate = new Date(event.endDate);
          
          if (draggingType === 'resize-left') {
            newStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            if (newStartDate > newEndDate) {
              newStartDate = new Date(newEndDate);
            }
          } else if (draggingType === 'resize-right') {
            newEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            if (newEndDate < newStartDate) {
              newEndDate = new Date(newStartDate);
            }
          } else if (draggingType === 'move') {
            const dayDiff = day - dragStartDayDrag;
            newStartDate = new Date(event.startDate);
            newEndDate = new Date(event.endDate);
            newStartDate.setDate(newStartDate.getDate() + dayDiff);
            newEndDate.setDate(newEndDate.getDate() + dayDiff);
            
            // Clamp to current month
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            if (newStartDate.getDate() < 1) {
              const adjustment = 1 - newStartDate.getDate();
              newStartDate.setDate(1);
              newEndDate.setDate(newEndDate.getDate() + adjustment);
            }
            if (newEndDate.getDate() > daysInMonth) {
              const adjustment = newEndDate.getDate() - daysInMonth;
              newEndDate.setDate(daysInMonth);
              newStartDate.setDate(newStartDate.getDate() - adjustment);
            }
          }
          
          // Update the event in real-time
          setEvents(prevEvents =>
            prevEvents.map(ev =>
              ev.id === draggingEventId
                ? { ...ev, startDate: newStartDate, endDate: newEndDate }
                : ev
            )
          );
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (dragSelecting && dragStartDay && dragEndDay) {
      // Open modal to create event with selected range
      const start = Math.min(dragStartDay, dragEndDay);
      const end = Math.max(dragStartDay, dragEndDay);
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), start);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), end);
      const generatedColor = generateRandomColor();
    setEventForm({
      title: '',
      description: '',
        startDate,
        endDate,
        color: generatedColor,
      });
      console.log("Generated color:", generatedColor);
    setEditingEvent(null);
    setShowEventModal(true);
    }

    clearDragSelection();
    cancelDrag();
  };

  // Drag & resize handlers for existing events
  const onEventMouseDown = (e, eventId, type) => {
    e.stopPropagation();
    const event = events.find(ev => ev.id === eventId);
    if (event) {
      setDraggingEventId(eventId);
      setDraggingType(type);
      setOriginalEventData({ ...event });
      
      if (type === 'move') {
        const day = getDayFromMousePosition(e);
        setDragStartDayDrag(day);
      }
    }
  };

  // Save event from modal (create or update)
  const saveEvent = async () => {
    const start = eventForm.startDate;
    const end = eventForm.endDate;
    
    // console.log("Creating/updating slot with dates:", {
    //   startDate: start,
    //   endDate: end,
    //   startISO: start.toISOString().split('T')[0],
    //   endISO: end.toISOString().split('T')[0]
    // });
    
    // Calculate duration_days and duration_hours (inclusive of both start and end dates)
    const durationMs = end - start;
    const duration_days = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;
    const duration_hours = duration_days * 24;
    
    // console.log("Calculated duration:", {
    //   durationMs,
    //   duration_days,
    //   duration_hours
    // });
    
    // Generate default title if not provided
    const title = eventForm.title.trim() || `Maintenance Window ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    
    const slotData = {
      title: title,
        description: eventForm.description,
      start_date: eventForm.startDate.toISOString().split('T')[0],
      end_date: eventForm.endDate.toISOString().split('T')[0],
      type: getTypeByColor(eventForm.color),
      duration_days,
      duration_hours,
    };
    
    console.log("Color conversion:", {
      originalColor: eventForm.color,
      convertedType: getTypeByColor(eventForm.color),
      slotData: slotData
    });
    
    // console.log("Sending slot data to backend:", slotData);
    
    try {
      if (editingEvent) {
        await apiService.updateTimeSlot(editingEvent.id, slotData);
      } else {
        await apiService.createTimeSlot(slotData);
      }
      setShowEventModal(false);
      setEditingEvent(null);
      fetchTimeSlots();
    } catch (err) {
      console.error("Error saving time slot:", err);
    }
  };

  // Edit existing event
  const editEvent = (event) => {
    setEventForm({
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      color: event.color,
    });
    setEditingEvent(event);
    setShowEventModal(true);
    setActiveTab('details');
    
    // Fetch scheduled anomalies for this slot
    fetchScheduledAnomalies(event.id);
  };

  // Fetch scheduled anomalies for a slot
  const fetchScheduledAnomalies = async (slotId) => {
    setLoadingAnomalies(true);
    try {
      const response = await apiService.getSlotScheduledAnomalies(slotId);
      // FIX: Add proper null/undefined checks
      if (response && response.success && response.scheduled_anomaly_ids && Array.isArray(response.scheduled_anomaly_ids)) {
        // Fetch full anomaly data for each ID
        const anomaliesData = await Promise.all(
          response.scheduled_anomaly_ids.map(async (anomalyId) => {
            try {
              const anomalyData = await apiService.getAnomalyById(anomalyId);
              return anomalyData;
            } catch (error) {
              console.error(`Error fetching anomaly ${anomalyId}:`, error);
              return { id: anomalyId, error: 'Failed to load anomaly data' };
            }
          })
        );
        setScheduledAnomalies(anomaliesData);
      } else {
        // FIX: Handle case where response structure is different
        console.log('Response structure:', response);
        setScheduledAnomalies([]);
      }
    } catch (error) {
      console.error('Error fetching scheduled anomalies:', error);
      setScheduledAnomalies([]);
    } finally {
      setLoadingAnomalies(false);
    }
  };

  // Delete event
  const deleteEvent = async (eventId) => {
    try {
      await apiService.deleteTimeSlot(eventId);
      fetchTimeSlots();
    } catch (err) {
      // Optionally handle error
    }
  };

  // Close modal
  const closeModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setActiveTab('details'); // Always reset to details tab
  };

  // Format today check
  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  // Manual scheduling function
  const triggerScheduling = async () => {
    try {
      console.log("Manually triggering scheduling of approved anomalies...");
      const response = await apiService.request('/anomalies/mongodb/check-schedule-queue/', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      if (response.success) {
        console.log("Scheduling triggered successfully:", response.message);
        // Refresh the calendar to show any newly scheduled anomalies
        await fetchTimeSlots();
        alert(`Scheduling completed: ${response.message}`);
      } else {
        console.error("Scheduling failed:", response.error);
        alert("Scheduling failed: " + response.error);
      }
    } catch (error) {
      console.error("Error triggering scheduling:", error);
      alert("Error triggering scheduling: " + error.message);
    }
  };

  // Manual rescheduling function
  const triggerRescheduling = async () => {
    try {
      console.log("Manually triggering rescheduling of anomalies to earlier slots...");
      
      // Get all time slots and find the earliest one
      const slots = await apiService.request('/anomalies/mongodb/time-slots/');
      if (!slots.success || !slots.time_slots || slots.time_slots.length === 0) {
        alert("No time slots found for rescheduling");
        return;
      }
      
      // Sort slots by start_date to find the earliest
      const sortedSlots = slots.time_slots.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
      const earliestSlotId = sortedSlots[0]._id;
      
      console.log("Earliest slot ID:", earliestSlotId);
      
      // Trigger rescheduling to the earliest slot
      const response = await apiService.request(`/anomalies/mongodb/time-slots/${earliestSlotId}/reschedule/`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      
      if (response.success) {
        console.log("Rescheduling triggered successfully:", response.message);
        // Refresh the calendar to show any rescheduled anomalies
        await fetchTimeSlots();
        alert(`Rescheduling completed: ${response.message}`);
      } else {
        console.error("Rescheduling failed:", response.error);
        alert("Rescheduling failed: " + response.error);
      }
    } catch (error) {
      console.error("Error triggering rescheduling:", error);
      alert("Error triggering rescheduling: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" onMouseUp={handleMouseUp}>
      <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance Windows Calendar</h1>
            <p className="text-gray-600">Manage and modify maintenance windows</p>
          </div>
          {/* <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button> */}
          </div>
        
        <div className="bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                onClick={() => navigateMonth(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button 
                onClick={() => navigateMonth(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
                <button 
                  onClick={navigateToToday}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Today
                </button>
              </div>
            <h2 className="text-2xl font-bold text-gray-900">{formatMonth(currentDate)}</h2>
              <div className="flex space-x-2">
              {/* <button
                onClick={triggerScheduling}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                title="Manually trigger scheduling of approved anomalies"
              >
                Schedule Anomalies
                </button>
                <button 
                onClick={triggerRescheduling}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                title="Manually trigger rescheduling of anomalies to earlier slots"
              >
                Reschedule Anomalies
              </button> */}
                <button 
                className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-blue-100 text-blue-700"
                >
                Month
                </button>
            </div>
          </div>

            {/* Month View */}
          <div
            className="select-none relative"
            style={{ position: 'relative', minHeight: 400 }}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Calendar Grid Container */}
            <div className="grid grid-cols-7 gap-1">
                {/* Days Header */}
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                <div
                  key={day}
                  className="p-4 text-center text-sm font-medium text-gray-500 border-b"
                >
                      {day}
                    </div>
                  ))}

              {/* Days Grid */}
                  {getDaysInMonth(currentDate).map((day, index) => {
                const isSelected = isDayInDragSelection(day);
                const isTodayCell = isToday(day);
                    
                    return (
                      <div 
                        key={index} 
                    onMouseDown={() => handleDayMouseDown(day)}
                    onMouseEnter={() => handleDayMouseEnter(day)}
                    className={`min-h-24 border border-gray-200 p-2 cursor-pointer transition-colors relative
                      ${!day ? 'bg-gray-50 cursor-default' : ''}
                      ${isSelected ? 'bg-blue-300 bg-opacity-50' : ''}
                      ${isTodayCell ? 'border-blue-500' : ''}
                    `}
                      >
                        {day && (
                      <div
                        className={`text-sm font-medium mb-1 ${
                          isTodayCell ? 'text-blue-600 font-bold' : 'text-gray-900'
                        }`}
                      >
                        {day}
                        {isTodayCell && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full mx-auto mt-1"></div>
                              )}
                            </div>
                        )}
                      </div>
                    );
                  })}
                </div>

            {/* Multi-day Events Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* {console.log("Rendering events:", events)} */}
              {events.map((event) => {
                // console.log("Processing event:", event);
                const startDay = event.startDate.getDate();
                const endDay = event.endDate.getDate();
                
                // Only show events that are in the current month
                if (event.startDate.getMonth() !== currentDate.getMonth() || 
                    event.startDate.getFullYear() !== currentDate.getFullYear()) {
                  // console.log("Event not in current month:", event.title, "startDate:", event.startDate, "currentDate:", currentDate);
                  return null;
                }

                // console.log("Event is in current month:", event.title);

                // Calculate positioning
                const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const offset = firstDayOfMonth.getDay();
                
                // Calculate rows for multi-day events
                const rows = [];
                let currentDay = startDay;
                
                while (currentDay <= endDay) {
                  const dayOfWeek = (offset + currentDay - 1) % 7;
                  const weekRow = Math.floor((offset + currentDay - 1) / 7);
                  
                  // Find the end of this row or the end of the event
                  let rowEndDay = currentDay;
                  while (rowEndDay <= endDay && (offset + rowEndDay - 1) % 7 !== 6) {
                    rowEndDay++;
                  }
                  if (rowEndDay > endDay) rowEndDay = endDay;
                  
                  rows.push({
                    startDay: currentDay,
                    endDay: rowEndDay,
                    weekRow: weekRow,
                    startCol: dayOfWeek,
                    endCol: (offset + rowEndDay - 1) % 7
                  });
                  
                  currentDay = rowEndDay + 1;
                }

                return rows.map((row, rowIndex) => (
                  <div
                    key={`${event.id}-${rowIndex}`}
                    className={`${event.color} text-white text-xs px-2 py-1 rounded cursor-pointer pointer-events-auto`}
                    style={{
                      position: 'absolute',
                      top: `${56 + (row.weekRow * 104) + 28}px`, // 56px header + week offset + day number space
                      left: `${(row.startCol * 14.28571429) + 0.5}%`, // 100/7 = 14.28571429
                      width: `${((row.endCol - row.startCol + 1) * 14.28571429) - 1}%`,
                      height: '20px',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editEvent(event);
                                    }}
                    title={`${event.title} (${event.startDate.toLocaleDateString()} - ${event.endDate.toLocaleDateString()})`}
                  >
                    <span className="truncate">{event.title}</span>
                                </div>
                ));
              })}
          </div>
        </div>

        {/* Event Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    {editingEvent ? 'Edit Maintenance Window' : 'Add Maintenance Window'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

                {/* Tabs */}
                {editingEvent && (
                  <div className="border-b border-gray-200 mb-4">
                    <nav className="-mb-px flex space-x-8">
                      <button
                        onClick={() => setActiveTab('details')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'details'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Details
                      </button>
                      <button
                        onClick={() => setActiveTab('anomalies')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'anomalies'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Scheduled Anomalies ({scheduledAnomalies.length})
                      </button>
                    </nav>
                  </div>
                )}

                {/* Tab Content */}
                {activeTab === 'details' && (
              <div className="space-y-4">
                    {editingEvent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title
                  </label>
                  <input
                    type="text"
                    value={eventForm.title}
                          onChange={(e) =>
                            setEventForm({ ...eventForm, title: e.target.value })
                          }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter maintenance window title"
                  />
                </div>
                    )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description <span className="text-gray-500">(Optional)</span>
                  </label>
                  <textarea
                    value={eventForm.description}
                        onChange={(e) =>
                          setEventForm({ ...eventForm, description: e.target.value })
                        }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                        placeholder="Enter maintenance window description (optional)"
                  />
                </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={eventForm.startDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                          const newStart = new Date(e.target.value);
                          let newEnd = eventForm.endDate;
                          if (newEnd < newStart) newEnd = newStart;
                          setEventForm({ ...eventForm, startDate: newStart, endDate: newEnd });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={eventForm.endDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                          const newEnd = new Date(e.target.value);
                          let newStart = eventForm.startDate;
                          if (newEnd < newStart) newStart = newEnd;
                          setEventForm({ ...eventForm, endDate: newEnd, startDate: newStart });
                        }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                )}

                {activeTab === 'anomalies' && (
                  <div className="space-y-4">
                    {loadingAnomalies ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Loading anomalies...</span>
                      </div>
                    ) : scheduledAnomalies.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No anomalies scheduled in this maintenance window.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {scheduledAnomalies.map((anomaly, index) => (
                          <div key={anomaly.id || index} className="border border-gray-200 rounded-lg p-4">
                            {anomaly.error ? (
                              <div className="text-red-600">
                                <p className="font-medium">Error loading anomaly {anomaly.id}</p>
                                <p className="text-sm">{anomaly.error}</p>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium text-gray-900">
                                    {anomaly.title || anomaly['Titre de l\'anomalie'] || `Anomaly ${anomaly['Description de l\'équipement']}`}
                                  </h4>

                                  {/* <h6 className="font-medium text-gray-900">
                                  {anomaly.id || `Anomaly ${anomaly['Num_equipement']}`}
                                  </h6> */}

                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    anomaly.criticality >= 9 ? 'bg-red-100 text-red-800' :
                                    anomaly.criticality >= 7 ? 'bg-orange-100 text-orange-800' :
                                    anomaly.criticality >= 5 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {anomaly.criticality >= 9 ? 'Critical' :
                                     anomaly.criticality >= 7 ? 'High' :
                                     anomaly.criticality >= 5 ? 'Medium' : 'Low'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                                    <span className="font-medium">Unit:</span> {anomaly.unit || anomaly['unit'] || 'N/A'}
                  </div>
                                  <div>
                                    <span className="font-medium">Section:</span> {anomaly.section || anomaly['Section propriétaire'] || 'N/A'}
                </div>
                                  <div>
                                    <span className="font-medium">Status:</span> 
                                    <span className={`ml-1 px-2 py-1 text-xs rounded-full ${
                                      anomaly.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                      anomaly.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {anomaly.status || 'Unknown'}
                                    </span>
              </div>
                                  <div>
                                    <span className="font-medium">Duration:</span> {anomaly.time_span || anomaly['time_span'] || 'N/A'} hours
                                  </div>
                                </div>
                                {anomaly.description || anomaly['Description de l\'anomalie'] && (
                                  <div className="mt-2">
                                    <span className="font-medium text-sm">Description:</span>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {anomaly.description || anomaly['Description de l\'anomalie']}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              <div className="flex justify-end space-x-3 mt-6">
                  {editingEvent && activeTab === 'details' && (
                    <button
                      onClick={() => {
                        deleteEvent(editingEvent.id);
                        closeModal();
                      }}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  )}
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                  {activeTab === 'details' && (
                <button
                  onClick={saveEvent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                 {editingEvent ? 'Update' : 'Save'}
                </button>
                  )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}