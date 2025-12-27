# Quick Start Guide - ServiceNow AI Agent

## 🚀 Get Running in 5 Minutes

### Step 1: Start the Server

```bash
cd e:\GenAI Course\sn-ai
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

You'll see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### Step 2: Test in Browser or Terminal

#### Open in Browser:
- **API Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health:** http://localhost:8000/health

#### Or use curl (in another terminal):

```bash
# 1. Health Check
curl http://localhost:8000/health

# 2. List Available Tools
curl http://localhost:8000/tools

# 3. Process Agent Request
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -d '{"user_input": "Find incidents related to password"}'

# 4. Query Incidents from Mock Data
curl -X POST http://localhost:8000/servicenow/query-incidents \
  -H "Content-Type: application/json" \
  -d '{"query": "password", "limit": 5}'

# 5. Search Knowledge Base
curl "http://localhost:8000/servicenow/search-kb?query=VPN&limit=5"
```

---

## 📊 Example Responses

### Agent Processing Response
```json
{
  "user_input": "Find incidents related to password",
  "intent": "query",
  "selected_tools": ["query_incidents", "search_knowledge_base"],
  "tool_calls": [
    {
      "tool_name": "query_incidents",
      "parameters": {}
    }
  ],
  "tool_results": [
    {
      "tool_name": "search_knowledge_base",
      "success": true,
      "data": {
        "articles": [...],
        "count": 1
      }
    }
  ],
  "response": "Processed request. 1/2 tools executed successfully.",
  "timestamp": "2024-12-26T10:30:00.000000"
}
```

### Query Incidents Response
```json
{
  "incidents": [
    {
      "sys_id": "a9e1c5a1db234a00f9e8b5c1c8b0a234",
      "number": "INC0010001",
      "short_description": "Password reset required for user account access",
      "priority": "3",
      "state": "resolved",
      "category": "Access Management"
    }
  ],
  "count": 1,
  "total": 1,
  "timestamp": "2024-12-26T10:30:00"
}
```

---

## 🛠️ Key Endpoints

| Endpoint | Method | Purpose | Example |
|----------|--------|---------|---------|
| `/health` | GET | Health check | Simple status |
| `/agent/process` | POST | Main agent processing | `{"user_input": "..."}` |
| `/tools` | GET | List tools | Get all available tools |
| `/tools/{name}` | GET | Tool details | Get single tool info |
| `/servicenow/query-incidents` | POST | Query incidents | `{"query": "...", "limit": 10}` |
| `/servicenow/search-kb` | GET | Search KB | `?query=...&limit=5` |

---

## 📝 Common Tasks

### Task 1: Query Incidents
```bash
curl -X POST http://localhost:8000/servicenow/query-incidents \
  -H "Content-Type: application/json" \
  -d '{
    "query": "network",
    "priority": "2",
    "limit": 10
  }'
```

### Task 2: Use Agent for Natural Language
```bash
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Show me all critical incidents"
  }'
```

### Task 3: Search Knowledge Base
```bash
curl "http://localhost:8000/servicenow/search-kb?query=troubleshooting&limit=5"
```

### Task 4: Check Conversation History
```bash
curl http://localhost:8000/agent/history
```

### Task 5: Disable a Tool
```bash
curl -X POST http://localhost:8000/tools/search_knowledge_base/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

---

## 🔍 What's Included

**✓ Agent System**
- Flexible tool registry
- Intent classification
- Parameter extraction & validation
- Execution history

**✓ ServiceNow API**
- Mock implementation (for testing)
- Real API support (OAuth 2.0)
- Incident, Problem, Change, KB operations

**✓ FastAPI Backend**
- 10+ endpoints
- Automatic documentation
- Error handling
- CORS support

**✓ Sample Data**
- 8 realistic ITSM records
- 3 incidents, 1 problem, 1 change, 1 request, 2 KB articles
- Ready for testing

---

## 🎯 Next Steps After This

1. **Integrate Real ServiceNow**
   - Update `.env` with your instance
   - Switch from MockServiceNowAPI to ServiceNowAPI

2. **Add Custom Tools**
   - Define handlers
   - Register with agent
   - Use in agent requests

3. **Fine-tune LLM**
   - Extract your ITSM data
   - Format as training pairs
   - Run fine-tuning on GPU

4. **Deploy to Production**
   - Docker containerize
   - Deploy to EC2/Azure
   - Set up monitoring

---

## 🧠 How It Works

```
User Request
    ↓
[FastAPI Endpoint]
    ↓
[Agent.process_request()]
    ├─ Classify intent (query/create/update/general)
    ├─ Select tools matching intent
    ├─ Extract parameters from user input
    ├─ Validate parameters
    ├─ Execute tools
    └─ Synthesize response
    ↓
[Tool Execution]
    ├─ Query ServiceNow
    ├─ Search Knowledge Base
    ├─ Custom handlers
    └─ Return structured results
    ↓
[Response to User]
```

---

## 💡 Tips

- **Development:** Use mock API first, connect to real ServiceNow later
- **Testing:** Run `python test_system.py` to verify setup
- **Debugging:** Check `/agent/execution-logs` for tool execution details
- **Scaling:** All components designed for containerization

---

## ❓ Troubleshooting

**Problem:** Port 8000 already in use
```bash
# Use different port
python -m uvicorn src.main:app --port 8001
```

**Problem:** Module not found errors
```bash
# Install requirements
pip install -r requirements.txt
```

**Problem:** Tests failing
```bash
# Verify data file exists
ls data/sample_itsm_data.json

# Re-run tests
python test_system.py
```

---

## 📚 Project Structure

```
sn-ai/
├── src/
│   ├── main.py                 ← FastAPI app
│   ├── agent_system.py         ← Agent & tools
│   └── servicenow_api.py       ← API wrapper
├── data/
│   └── sample_itsm_data.json   ← Mock data
├── test_system.py              ← Tests
├── requirements.txt            ← Dependencies
├── README.md                   ← Full docs
└── ROADMAP.md                  ← Implementation guide
```

---

**🎉 You're Ready! Start the server and explore the API documentation at `/docs`**
