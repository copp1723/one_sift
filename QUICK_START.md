# OneSift Quick Start Guide

## Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Redis server
- Mailgun account (for email functionality)

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env` and update with your actual values:
```bash
# Update these values in .env:
DATABASE_URL=postgresql://user:password@localhost:5432/onesift
REDIS_URL=redis://localhost:6379
MAILGUN_API_KEY=your-actual-mailgun-key
OPENAI_API_KEY=your-actual-openai-key
```

### 3. Database Setup
```bash
# Generate migration files
npm run db:generate

# Apply migrations to database
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```

The server will start on http://localhost:3000

## API Testing

### Create a Customer
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Honda",
    "slug": "abc-honda", 
    "ingestionMode": "email",
    "handoverEmail": "sales@abchonda.com"
  }'
```

### Ingest a Lead
Replace `{customerId}` with the ID from the customer creation response:

```bash
curl -X POST http://localhost:3000/api/v1/leads/ingest/{customerId} \
  -H "Content-Type: application/json" \
  -d '{
    "source": "website",
    "customerName": "John Doe", 
    "customerEmail": "john@example.com",
    "message": "Im interested in the new Accord"
  }'
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Available Endpoints

- `GET /health` - Health check
- `POST /api/v1/customers` - Create customer
- `GET /api/v1/customers` - List customers
- `GET /api/v1/customers/:id` - Get customer by ID
- `GET /api/v1/customers/slug/:slug` - Get customer by slug
- `POST /api/v1/leads/ingest/:customerId` - Ingest lead
- `GET /api/v1/leads/:id` - Get lead by ID
- `GET /api/v1/leads/customer/:customerId` - List customer leads

## Next Steps

1. **Add AI Processing**: Implement conversation AI in workers
2. **Add Webhooks**: Set up Mailgun webhook handling
3. **Add Authentication**: Implement API key authentication
4. **Add Personas**: Create and manage AI personas
5. **Add Handoffs**: Implement intelligent handoff system

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify database exists

### Redis Connection Issues  
- Ensure Redis is running
- Check REDIS_URL format

### Migration Issues
```bash
# Reset and regenerate migrations
rm -rf drizzle/
npm run db:generate
npm run db:push
```
