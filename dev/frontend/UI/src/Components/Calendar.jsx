import React, { useState } from 'react';
import './Calendar.css';

function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState([]);

  // Calendar navigation
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)); 
  };

  // Generate calendar grid
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    const startPadding = firstDay.getDay();
    
    // Add padding for first week
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button className="calendar-nav-button" onClick={prevMonth}>
          <span className="material-icons">chevron_left</span>
        </button>
        <h2>{months[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
        <button className="calendar-nav-button" onClick={nextMonth}>
          <span className="material-icons">chevron_right</span>
        </button>
      </div>

      <div className="calendar-grid">
        {/* Weekday headers */}
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="calendar-weekday">{day}</div>
        ))}

        {/* Calendar days */}
        {getDaysInMonth().map((date, index) => (
          <div 
            key={index}
            className={`calendar-day ${
              date && selectedDate && date.toDateString() === selectedDate.toDateString() 
                ? 'selected' 
                : ''
            }`}
            onClick={() => date && setSelectedDate(date)}
          >
            {date ? date.getDate() : ''}
            {events
              .filter(event => date && event.date.toDateString() === date.toDateString())
              .map(event => (
                <div key={event.id} className="event-indicator" />
              ))
            }
          </div>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
