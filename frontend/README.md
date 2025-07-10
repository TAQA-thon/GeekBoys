# Anomaly Management Frontend

This is the frontend application for the Anomaly Management System, built with Next.js, React, and Tailwind CSS. It provides a modern, responsive interface for managing system anomalies, time slots, and scheduling.

## Features

- **Real-time Dashboard**: View and manage anomalies with live data from the backend
- **Authentication**: Secure login system with JWT tokens
- **Anomaly Management**: Approve, edit, and update anomaly status
- **Statistics**: Real-time statistics and metrics
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with Tailwind CSS

## Prerequisites

- Node.js 16+ 
- npm or yarn
- Django backend running on `http://localhost:8000`

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure the backend API URL:
   - Edit `config/api.js` to set the correct backend URL
   - Or set the `NEXT_PUBLIC_API_URL` environment variable

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

### API Configuration

Edit `config/api.js` to configure API settings:

```javascript
const config = {
  API_BASE_URL: 'http://localhost:8000/api', // Your Django backend URL
  REQUEST_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
};
```

### Environment Variables

Create a `.env.local` file in the frontend directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_ENVIRONMENT=development
```

## Usage

### Authentication

1. Navigate to the application
2. Use the demo credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Login" to access the dashboard

### Dashboard Features

#### View Anomalies
- See all anomalies in a paginated table
- View anomaly details: title, unit, severity, status, approval status
- Sort anomalies by status (Open/In Progress/Resolved first)

#### Manage Anomalies
- **Change Status**: Use the dropdown to update anomaly status
- **Approve Anomalies**: Click "Approve" to approve and schedule anomalies
- **Edit Details**: In the approval modal, you can edit:
  - Title
  - Unit
  - Severity (Critical/High/Medium/Low)
  - Status (Open/In Progress/Resolved)
  - Priority (High/Medium/Low)
  - Time Span (hours)

#### Statistics
The dashboard shows real-time statistics:
- Total Anomalies
- Critical Issues (Critical + High severity)
- Resolved Anomalies
- Resolution Rate (percentage)

#### Refresh Data
- Click the "Refresh" button to reload data from the backend
- Data automatically refreshes after status changes and approvals

## API Integration

The frontend communicates with the Django backend through the following endpoints:

### Authentication
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout

### Anomaly Management
- `GET /api/anomalies/mongodb/` - Get all anomalies
- `GET /api/anomalies/mongodb/{id}/` - Get specific anomaly
- `PATCH /api/anomalies/mongodb/{id}/approve/` - Approve anomaly
- `PATCH /api/anomalies/mongodb/{id}/edit/` - Edit anomaly
- `GET /api/anomalies/mongodb/statistics/` - Get statistics
- `GET /api/anomalies/mongodb/count/` - Get anomaly count

### Time Slots
- `GET /api/anomalies/mongodb/time-slots/` - Get time slots
- `POST /api/anomalies/mongodb/time-slots/create/` - Create time slot
- `PATCH /api/anomalies/mongodb/time-slots/{id}/` - Update time slot
- `DELETE /api/anomalies/mongodb/time-slots/{id}/delete/` - Delete time slot
- `POST /api/anomalies/mongodb/time-slots/import/` - Import time slots from Excel

### Approved Queue
- `GET /api/anomalies/mongodb/approved-queue/` - Get approved queue
- `POST /api/anomalies/mongodb/approved-queue/check/` - Check and schedule queue
- `DELETE /api/anomalies/mongodb/approved-queue/{id}/` - Remove from queue

## Data Transformation

The application includes utility functions to transform data between frontend and backend formats:

### Frontend Format
```javascript
{
  id: "anomaly_id",
  title: "Anomaly Description",
  unit: "Unit Name",
  severity: "Critical|High|Medium|Low",
  priority: "High|Medium|Low",
  status: "Open|In Progress|Resolved",
  date: "2024-01-01",
  approved: true|false,
  time_span: 2.5
}
```

### Backend Format
```javascript
{
  _id: "anomaly_id",
  Description: "Anomaly Description",
  system_id: "Unit Name",
  criticality: 1|2|3|4,
  priority_score: 15|8|3,
  status: "open|in_progress|resolved",
  Approved: true|false,
  time_span: 2.5
}
```

## Error Handling

The application includes comprehensive error handling:

- **Network Errors**: Displayed to users with retry options
- **Authentication Errors**: Automatic logout and redirect to login
- **API Errors**: User-friendly error messages
- **Loading States**: Spinners and disabled buttons during operations

## Development

### Project Structure
```
frontend/
├── components/          # React components
│   ├── view.js         # Main dashboard view
│   ├── Auth.js         # Authentication component
│   ├── Dashboard.js    # Main dashboard layout
│   └── TopBar.js       # Top navigation bar
├── services/           # API services
│   └── api.js         # Main API service
├── utils/             # Utility functions
│   └── dataTransformers.js  # Data transformation utilities
├── config/            # Configuration files
│   └── api.js         # API configuration
└── pages/             # Next.js pages
    └── index.js       # Main page
```

### Adding New Features

1. **New API Endpoints**: Add methods to `services/api.js`
2. **New Components**: Create in `components/` directory
3. **Data Transformers**: Add to `utils/dataTransformers.js`
4. **Configuration**: Update `config/api.js` if needed

### Testing

The application includes error boundaries and loading states for testing:

1. **Backend Offline**: Shows error message with retry button
2. **Invalid Credentials**: Shows login error
3. **Network Issues**: Graceful error handling
4. **Loading States**: Visual feedback during operations

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure Django backend has CORS configured
2. **Authentication Failures**: Check JWT token configuration
3. **API Connection**: Verify backend URL in `config/api.js`
4. **Data Not Loading**: Check browser console for errors

### Debug Mode

Enable debug logging by setting:
```javascript
// In config/api.js
const config = {
  DEBUG: true,
  // ... other config
};
```

## Contributing

1. Follow the existing code structure
2. Add error handling for new features
3. Update documentation for new endpoints
4. Test with both valid and invalid data

## License

This project is part of the Anomaly Management System. 