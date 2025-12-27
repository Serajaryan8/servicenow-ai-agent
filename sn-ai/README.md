# ServiceNow AI Agent - Complete Implementation Guide

## 📋 Project Overview

A fully flexible agentic system for ServiceNow ITSM integration with:
- **Intelligent Agent**: Processes natural language requests and routes to appropriate tools
- **Flexible Tool Registry**: Dynamically add/remove/enable tools
- **ServiceNow API Wrapper**: Complete ITSM operations (Incidents, Problems, Changes, KB)
- **FastAPI Backbone**: RESTful API for easy integration
- **Mock Data**: Realistic ITSM JSON for testing without live ServiceNow

---

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Navigate to project
cd e:\GenAI Course\sn-ai

# Activate Python environment (already configured)
# Windows:
..\\.venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run the Application

```bash
# Start FastAPI server
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Test the API

**Visit in browser or use curl:**

```bash
# Health check
curl http://localhost:8000/health

# List available tools
curl http://localhost:8000/tools

# Process agent request
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -d '{"user_input": "Find incidents related to password reset"}'

# Query ServiceNow incidents
curl -X POST http://localhost:8000/servicenow/query-incidents \
  -H "Content-Type: application/json" \
  -d '{"query": "password", "limit": 5}'

# Search knowledge base
curl "http://localhost:8000/servicenow/search-kb?query=password+reset&limit=5"
```

---

## 📁 Project Structure

```
sn-ai/
├── src/
│   ├── main.py                 # FastAPI application entry point
│   ├── agent_system.py         # Flexible agent & tool registry
│   └── servicenow_api.py       # ServiceNow API wrapper + mock
├── data/
│   └── sample_itsm_data.json   # Realistic ITSM data (8 records)
├── requirements.txt             # Python dependencies
├── ROADMAP.md                  # Complete implementation roadmap
└── README.md                   # This file
```

---

## 🛠️ Component Details

### 1. **Agent System** (`src/agent_system.py`)

**Key Classes:**
- `Tool`: Flexible tool definition with parameters and handler
- `ToolRegistry`: Central registry for managing tools
- `Agent`: Orchestrates tool selection and execution

**Features:**
- Dynamic tool registration/unregistration
- Parameter validation
- Execution history tracking
- Intent classification
- Tool result synthesis

**Usage:**
```python
from src.agent_system import initialize_agent

agent = initialize_agent()
result = agent.process_request("Find high priority incidents")
```

### 2. **ServiceNow API** (`src/servicenow_api.py`)

**Two Implementations:**

**a) Real ServiceNow API:**
```python
config = ServiceNowConfig(
    instance_url="https://dev12345.service-now.com",
    client_id="your_client_id",
    client_secret="your_client_secret",
    username="your_username",
    password="your_password"
)
api = ServiceNowAPI(config)
```

**b) Mock API (for testing):**
```python
api = MockServiceNowAPI("data/sample_itsm_data.json")
incidents = api.query_incidents(query="password")
```

**Supported Operations:**
- Query incidents, problems, changes
- Create/update incidents
- Search knowledge base
- Health checks

### 3. **FastAPI Application** (`src/main.py`)

**Main Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/agent/process` | POST | Process user request through agent |
| `/agent/history` | GET | Get conversation history |
| `/tools` | GET | List available tools |
| `/tools/{name}` | GET | Get tool details |
| `/tools/{name}/toggle` | POST | Enable/disable tool |
| `/servicenow/query-incidents` | POST | Query incidents |
| `/servicenow/create-incident` | POST | Create incident |
| `/servicenow/search-kb` | GET | Search knowledge base |

---

## 🔧 Adding Custom Tools

### Simple 3-Step Process:

```python
from src.agent_system import Tool, ToolType, ToolParameter

# Step 1: Create handler function
def my_tool_handler(param1: str, param2: int = 5) -> dict:
    return {"result": f"Processed {param1} with {param2}"}

# Step 2: Define tool
my_tool = Tool(
    name="my_custom_tool",
    description="Does something useful",
    tool_type=ToolType.CUSTOM,
    handler=my_tool_handler,
    parameters=[
        ToolParameter("param1", "string", "First parameter", required=True),
        ToolParameter("param2", "integer", "Second parameter", required=False, default=5)
    ],
    tags=["custom", "example"]
)

# Step 3: Register tool
agent.tool_registry.register_tool(my_tool)
```

---

## 📊 Sample ITSM Data

**Located at:** `data/sample_itsm_data.json`

**Contains 8 realistic records:**
1. Password reset incident (INC0010001)
2. VPN connectivity incident (INC0010002)
3. Printer issue incident (INC0010003)
4. Database timeout problem (PRB0005001)
5. Database connection change (CHG0078945)
6. Software license request (REQ0032105)
7. Password reset KB article (KB0024521)
8. VPN troubleshooting KB article (KB0041230)

---

## 🔐 Authentication & Security

### ServiceNow Configuration:

Create `.env` file in project root:
```
SERVICENOW_INSTANCE=https://dev12345.service-now.com
SERVICENOW_CLIENT_ID=your_client_id
SERVICENOW_CLIENT_SECRET=your_client_secret
SERVICENOW_USERNAME=your_username
SERVICENOW_PASSWORD=your_password
```

### API Security Features:
- OAuth 2.0 token management
- Automatic token refresh
- Request retry logic (exponential backoff)
- Rate limiting handling
- Input validation & sanitization

---

## 🎯 Agent Decision Flow

```
User Input
    ↓
[Intent Classification]
    - Query, Create, Update, General
    ↓
[Tool Selection]
    - Match intent to tool tags
    - Filter enabled tools
    ↓
[Parameter Extraction]
    - Parse user input for tool parameters
    ↓
[Tool Execution]
    - Validate parameters
    - Execute tool handler
    - Handle errors with retries
    ↓
[Response Synthesis]
    - Combine tool results
    - Generate human-readable response
    ↓
Response to User
```

---

## 📈 Timeline & Effort (from earlier roadmap)

| Phase | Duration | Effort | Status |
|-------|----------|--------|--------|
| Foundation & Planning | Week 1-2 | 2-3 hrs/day | ✅ Completed |
| Data Preparation | Week 3-6 | 3-4 hrs/day | ⏳ In Progress |
| Fine-Tuning | Week 7-10 | 2-3 hrs/day | ⏳ Next |
| RAG System | Week 8-10 | 3-4 hrs/day | ⏳ Next |
| Agentic Design | Week 11-12 | 3-4 hrs/day | ⏳ Next |
| ServiceNow Integration | Week 13-14 | 3-4 hrs/day | ✅ Done |
| Deployment | Week 15+ | 1-2 hrs/day | ⏳ Next |

---

## 🚀 Next Steps

### Immediate (This Session):
- [ ] Test agent with sample data
- [ ] Run FastAPI server
- [ ] Test endpoints with Postman/curl
- [ ] Verify tool registration and execution

### Short-term (Week 1):
- [ ] Integrate real ServiceNow API
- [ ] Add authentication/environment variables
- [ ] Set up logging and monitoring
- [ ] Create unit tests

### Medium-term (Week 2-4):
- [ ] Extract real ITSM data from ServiceNow
- [ ] Build RAG system with Pinecone
- [ ] Integrate OpenAI/local LLM
- [ ] Fine-tune model on your data

### Long-term (Week 5+):
- [ ] Deploy to production (EC2/Azure)
- [ ] Set up monitoring/alerting
- [ ] Implement user feedback loop
- [ ] Continuous model improvement

---

## 🧪 Testing

### Run Agent Tests:
```bash
python src/agent_system.py
```

### Run ServiceNow API Tests:
```bash
python src/servicenow_api.py
```

### Test with curl:
```bash
# Agent processing
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -d '{"user_input": "search knowledge base for password"}'

# Mock data query
curl -X POST http://localhost:8000/servicenow/query-incidents \
  -H "Content-Type: application/json" \
  -d '{"query": "VPN", "limit": 10}'
```

---

## 📚 Learning Resources

1. **Fine-tuning LLMs:**
   - LoRA: Parameter-efficient fine-tuning
   - QLoRA: Even more efficient (2-4% of parameters)
   - Hugging Face Transformers library

2. **RAG Systems:**
   - Vector embeddings (OpenAI, Sentence Transformers)
   - Vector databases (Pinecone, Weaviate, Chroma)
   - Retrieval-augmented generation patterns

3. **Agentic Systems:**
   - ReAct (Reasoning + Acting)
   - Chain of Thought prompting
   - Tool use patterns

4. **ServiceNow API:**
   - REST API fundamentals
   - Table and field names
   - Query syntax and filters

---

## 💾 Configuration

### Environment Variables (`.env`):
```
# ServiceNow
SERVICENOW_INSTANCE=https://dev12345.service-now.com
SERVICENOW_CLIENT_ID=xxx
SERVICENOW_CLIENT_SECRET=xxx

# OpenAI (for LLM integration)
OPENAI_API_KEY=xxx

# Pinecone (for vector storage)
PINECONE_API_KEY=xxx
PINECONE_ENVIRONMENT=xxx

# App
LOG_LEVEL=INFO
DEBUG=False
```

---

## 🤝 Contributing

To add new tools or features:

1. Create handler function in `src/`
2. Define Tool object with parameters
3. Register with `agent.tool_registry.register_tool()`
4. Test with agent
5. Add endpoint in `main.py` if needed

---

## 📝 Notes

- **Mock API**: Uses local `sample_itsm_data.json`, perfect for development
- **Real API**: Configure in `.env`, supports OAuth 2.0 and Basic auth
- **Extensibility**: Design supports unlimited tools and custom behaviors
- **Scalability**: Ready for containerization and cloud deployment

---

## ❓ FAQ

**Q: How do I connect to real ServiceNow?**
A: Update `.env` with your instance details and switch from `MockServiceNowAPI` to `ServiceNowAPI` in `main.py`.

**Q: How long does LLM fine-tuning take?**
A: 8-24 hours on GPU (depending on model size and data). Start with Colab, scale to cloud GPU.

**Q: What's the minimum data needed?**
A: 10,000-100,000 examples for good results, with ~80% label accuracy.

**Q: Can I add tools dynamically?**
A: Yes! Use `agent.tool_registry.register_tool()` anytime, even during runtime.

**Q: What about cost?**
A: ~$350-600 total for 3-month development (GPU, storage, API). Production costs depend on usage.

---

## 📞 Support

For issues or questions:
1. Check the ROADMAP.md for detailed guidance
2. Review agent_system.py comments for design patterns
3. Test with sample_itsm_data.json before connecting to real ServiceNow
4. Check execution logs at `/agent/execution-logs`

---

**Happy Building! 🚀**
