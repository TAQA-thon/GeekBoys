# Factory Anomaly Scheduling System - Django Backend

A secure Django REST API backend for managing factory anomalies and scheduling them into maintenance calendar slots.

## 🚀 Features

- **JWT Authentication** with role-based access (Admin/Manager)
- **Excel Import** for bulk anomaly data
- **Auto-scheduling** algorithm for anomaly assignment
- **Calendar Management** for maintenance time slots
- **Section-based** anomaly organization
- **Real-time** scheduling and rescheduling
- **Dashboard** overview and statistics

## 🛠️ Installation

1. **Clone and setup:**
```bash
git clone <repository>
cd Taqa
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Database setup:**
```bash
python manage.py migrate
python manage.py createsuperuser
```

3. **Run the server:**
```bash
python manage.py runserver
```

## 🔐 Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Get JWT Token
```bash
curl -X POST http://localhost:8000/api/users/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your_password"}'
```

## 📋 API Endpoints

### 🔐 Authentication & User Management

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/users/auth/register/manager/` | Admin | Create manager account |
| POST | `/api/users/auth/login/` | All | Login and get JWT |
| GET | `/api/users/auth/me/` | All | Get current user info |
| POST | `/api/users/auth/logout/` | All | Invalidate refresh token |
| GET | `/api/users/me/` | All | Get current user info (alias) |
| GET | `/api/users/profile/` | All | Get/update user profile |
| POST | `/api/users/change-password/` | All | Change password |
| GET | `/api/users/list/` | Admin | List all users |

### ⚙️ Anomalies

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/anomalies/import/` | Admin | Upload Excel file, convert to JSON, store in MongoDB |
| GET | `/api/anomalies/` | Admin, Manager | List all anomalies (with filters) |
| GET | `/api/anomalies/<id>/` | Admin, Manager | Get anomaly details |
| PATCH | `/api/anomalies/<id>/` | Admin, Manager | Update anomaly |
| DELETE | `/api/anomalies/<id>/` | Admin, Manager | Delete anomaly |
| GET | `/api/anomalies/unassigned/` | Admin, Manager | List unscheduled anomalies |
| GET | `/api/anomalies/scheduled/` | Admin, Manager | List scheduled anomalies |
| GET | `/api/anomalies/overdue/` | Admin, Manager | List overdue anomalies |
| GET | `/api/anomalies/high-priority/` | Admin, Manager | List high priority anomalies |
| GET | `/api/anomalies/section/<section_id>/` | Admin, Manager | List anomalies by section |
| PATCH | `/api/anomalies/<id>/reschedule/` | Admin, Manager | Reschedule anomaly |
| POST | `/api/anomalies/auto-schedule/` | Admin, Manager | Auto-schedule all unassigned |

### 🗄️ MongoDB Endpoints

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/anomalies/mongodb/` | Admin, Manager | Get anomalies from MongoDB |
| GET | `/api/anomalies/mongodb/<id>/` | Admin, Manager | Get specific anomaly from MongoDB |
| GET | `/api/anomalies/mongodb/statistics/` | Admin, Manager | Get MongoDB collection statistics |

### 🗓️ Factory Calendar

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/calendar/` | Admin, Manager | List calendar slots (with filters) |
| GET | `/api/calendar/<id>/` | Admin, Manager | Get slot details |
| POST | `/api/calendar/` | Admin | Create calendar slot |
| PATCH | `/api/calendar/<id>/` | Admin | Update slot |
| DELETE | `/api/calendar/<id>/` | Admin | Delete slot (if empty) |
| GET | `/api/calendar/overview/` | Admin, Manager | Calendar statistics |
| POST | `/api/calendar/bulk-create/` | Admin | Bulk create slots |
| GET | `/api/calendar/availability/` | Admin, Manager | Find available slots |

### 🧭 Sections

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/anomalies/sections/` | Admin, Manager | List all sections |
| POST | `/api/anomalies/sections/` | Admin | Create section |
| GET | `/api/anomalies/sections/<id>/` | Admin, Manager | Get section details |
| PATCH | `/api/anomalies/sections/<id>/` | Admin | Update section |
| DELETE | `/api/anomalies/sections/<id>/` | Admin | Delete section |

### 📊 Schedule Overview

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/schedule/overview/` | Admin, Manager | Dashboard statistics |
| GET | `/api/schedule/calendar-view/` | Admin, Manager | Calendar view data |

## 📝 Usage Examples

### 1. Login and Get Token
```bash
curl -X POST http://localhost:8000/api/users/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }'
```

### 2. Import Anomalies from Excel to MongoDB
```bash
curl -X POST http://localhost:8000/api/anomalies/import/ \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@anomalies.xlsx"
```

**Response:**
```json
{
  "message": "Successfully imported 5 anomalies to MongoDB",
  "imported_count": 5,
  "errors": [],
  "success": true,
  "mongodb_ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
}
```

### 3. Get Anomalies from MongoDB
```bash
curl -X GET "http://localhost:8000/api/anomalies/mongodb/?limit=10&skip=0" \
  -H "Authorization: Bearer <your_token>"
```

### 4. Get MongoDB Statistics
```bash
curl -X GET http://localhost:8000/api/anomalies/mongodb/statistics/ \
  -H "Authorization: Bearer <your_token>"
```

### 5. List Anomalies with Filters
```bash
curl -X GET "http://localhost:8000/api/anomalies/?status=scheduled&section=1" \
  -H "Authorization: Bearer <your_token>"
```

### 6. Reschedule Anomaly
```bash
curl -X PATCH http://localhost:8000/api/anomalies/<anomaly_id>/reschedule/ \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{"new_slot_id": "<slot_id>"}'
```

### 7. Create Calendar Slot
```bash
curl -X POST http://localhost:8000/api/calendar/ \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "available_hours": 8,
    "is_available": true,
    "notes": "Regular maintenance day"
  }'
```

### 8. Get Schedule Overview
```bash
curl -X GET "http://localhost:8000/api/schedule/overview/?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer <your_token>"
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file:
```env
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:password@localhost:5432/anomaly_scheduler
JWT_SECRET_KEY=your-jwt-secret-key
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Database
For production, update `settings.py` to use PostgreSQL:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT'),
    }
}
```

## 🧪 Testing

### API Documentation
- **Swagger UI**: http://localhost:8000/api/docs/
- **ReDoc**: http://localhost:8000/redoc/
- **OpenAPI JSON**: http://localhost:8000/swagger.json
- **OpenAPI YAML**: http://localhost:8000/swagger.yaml

### Comprehensive Test Suite
```bash
# Run all tests with detailed reporting
python tests/run_all_tests.py

# Run individual test suites
python tests/test_authentication.py    # Authentication & user management
python tests/test_anomalies.py         # Anomaly CRUD & import
python tests/test_calendar.py          # Calendar slot management
python tests/test_schedule.py          # Schedule overview & dashboard

# Quick API test
python test_api.py

# MongoDB import test
python test_mongodb_import.py
```

### Test Coverage
The test suite covers:
- ✅ JWT Authentication (login, logout, registration)
- ✅ User management (profile, password change)
- ✅ Anomaly CRUD operations
- ✅ Excel import functionality
- ✅ Auto-scheduling algorithm
- ✅ Calendar slot management
- ✅ Schedule overview and statistics
- ✅ Role-based permissions
- ✅ API data validation
- ✅ Error handling

### Create Test Data
```bash
# Create admin user
python manage.py createsuperuser

# Create sections
curl -X POST http://localhost:8000/api/anomalies/sections/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Turbine Operations", "description": "Turbine maintenance"}'

# Create calendar slots
curl -X POST http://localhost:8000/api/calendar/bulk-create/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "available_hours": 8,
    "skip_weekends": true
  }'
```

## 🔒 Security Features

- **JWT Authentication** with token expiration
- **Role-based permissions** (Admin/Manager)
- **Input validation** and sanitization
- **CORS protection** for frontend integration
- **HTTPS enforcement** in production
- **SQL injection protection** via Django ORM
- **XSS protection** via Django's built-in security

## 📊 Business Logic

### Auto-scheduling Algorithm
1. **Priority Calculation**: `criticality × condition_score`
2. **Slot Finding**: Nearest available slot with sufficient hours
3. **Conflict Prevention**: Prevents overbooking
4. **Fallback**: Creates new slots if needed

### Rescheduling Rules
- Managers can reschedule within allowed calendar days
- System validates slot availability
- Prevents double-booking
- Maintains audit trail

## 🚀 Deployment

### Production Checklist
- [ ] Set `DEBUG=False`
- [ ] Configure PostgreSQL database
- [ ] Set secure `SECRET_KEY`
- [ ] Configure HTTPS/SSL
- [ ] Set up proper CORS origins
- [ ] Configure logging
- [ ] Set up backup strategy
- [ ] Configure monitoring

### Docker Deployment
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

## 📞 Support

For issues and questions:
- Check the Django admin panel at `/admin/`
- Review API documentation at `/api/docs/` (if enabled)
- Check server logs for detailed error messages

## 📄 License

This project is licensed under the MIT License. 