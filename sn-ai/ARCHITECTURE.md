# System Architecture & Design Reference

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                               │
│  (Browser, curl, Postman, Mobile App, etc.)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Endpoints:                                              │   │
│  │  • /agent/process         (POST)                         │   │
│  │  • /tools                 (GET, POST)                    │   │
│  │  • /servicenow/*          (GET, POST, PATCH)            │   │
│  │  • /agent/history         (GET)                          │   │
│  │  • /health                (GET)                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
           ┌─────────────┴──────────────┐
           ▼                            ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│    AGENT SYSTEM          │   │  SERVICENOW API WRAPPER  │
│                          │   │                          │
│ ┌──────────────────────┐ │   │ ┌──────────────────────┐ │
│ │ Intent Classifier    │ │   │ │ Real ServiceNow API  │ │
│ │ (query/create/etc)   │ │   │ │ (OAuth 2.0)          │ │
│ └──────────────────────┘ │   │ └──────────────────────┘ │
│                          │   │                          │
│ ┌──────────────────────┐ │   │ ┌──────────────────────┐ │
│ │ Tool Registry        │ │   │ │ Mock API             │ │
│ │ - Register           │ │   │ │ (JSON file based)    │ │
│ │ - Execute            │ │   │ └──────────────────────┘ │
│ │ - Track history      │ │   │                          │
│ └──────────────────────┘ │   │ Operations:             │
│                          │   │ • Query incidents       │
│ ┌──────────────────────┐ │   │ • Create/Update inc.    │
│ │ Parameter Validator  │ │   │ • Query problems        │
│ │ - Type checking      │ │   │ • Query changes         │
│ │ - Required validation│ │   │ • Search KB             │
│ │ - Enum validation    │ │   │                         │
│ └──────────────────────┘ │   │                         │
│                          │   │                         │
│ ┌──────────────────────┐ │   │                         │
│ │ Tools                │ │   │                         │
│ │ - query_incidents    │ │   │                         │
│ │ - create_incident    │ │   │                         │
│ │ - search_kb          │ │   │                         │
│ │ - custom_tools...    │ │   │                         │
│ └──────────────────────┘ │   │                         │
└──────────────────────────┘   └──────────────────────────┘
           │                            │
           └─────────────┬──────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Sample ITSM Data (JSON)                                  │   │
│  │  • Incidents: INC0010001, INC0010002, INC0010003        │   │
│  │  • Problems: PRB0005001                                  │   │
│  │  • Changes: CHG0078945                                   │   │
│  │  • Requests: REQ0032105                                  │   │
│  │  • KB Articles: KB0024521, KB0041230                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Real ServiceNow Instance                                 │   │
│  │  • REST API (/api/now/table/*)                          │   │
│  │  • OAuth 2.0 authentication                             │   │
│  │  • Table operations: CRUD                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Future: Vector DB (RAG)                                  │   │
│  │  • Pinecone / Weaviate / Chroma                         │   │
│  │  • Embedded documents for semantic search               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Request Processing Flow

```
┌─────────────────────┐
│  User Request       │
│  "Find network      │
│   incidents"        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ FastAPI Endpoint: /agent/process        │
│ Input: AgentRequest(user_input)         │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 1. INTENT CLASSIFICATION                │
│                                         │
│ Input: "Find network incidents"         │
│ Logic: Check keywords (find, search...) │
│ Output: intent = "query"                │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 2. TOOL SELECTION                       │
│                                         │
│ Input: intent="query"                   │
│ Logic: Match tools with intent tags     │
│ Output: tools=[query_incidents,         │
│         search_knowledge_base]          │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 3. PARAMETER EXTRACTION                 │
│                                         │
│ Input: user_input, selected_tools       │
│ Logic: Parse params from user input     │
│ Output: query="network", limit=10       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 4. TOOL EXECUTION                       │
│                                         │
│ ┌──────────────────────────────────┐   │
│ │ query_incidents:                 │   │
│ │ - Validate params                │   │
│ │ - Call handler                   │   │
│ │ - Return: [incident data...]     │   │
│ └──────────────────────────────────┘   │
│                                         │
│ ┌──────────────────────────────────┐   │
│ │ search_knowledge_base:           │   │
│ │ - Validate params                │   │
│ │ - Call handler                   │   │
│ │ - Return: [KB articles...]       │   │
│ └──────────────────────────────────┘   │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 5. RESPONSE SYNTHESIS                   │
│                                         │
│ Input: tool_results[]                   │
│ Logic: Format results for user          │
│ Output: "Found 3 incidents"             │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ AgentResponse                           │
│ {                                       │
│   intent: "query",                      │
│   tools: ["query_incidents", ...],      │
│   results: [...],                       │
│   response: "Found 3 incidents"         │
│ }                                       │
└─────────────────────────────────────────┘
```

---

## 🔄 Tool Execution Cycle

```
┌──────────────────────────────────────────────────────┐
│ Tool Handler Called                                  │
│ handler(param1, param2, ...)                         │
└────────────────┬─────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │ Parameter Valid?│
        └────────┬────────┘
                 │
          ┌──────┴──────┐
          │             │
       YES│             │NO
          │             │
          ▼             ▼
    ┌──────────┐   ┌─────────────┐
    │ Execute  │   │ Return Error│
    │ Handler  │   │ ValidationE│
    └────┬─────┘   │ rror        │
         │         └─────────────┘
         ▼
    ┌──────────────────────────┐
    │ Call External Service    │
    │ (ServiceNow API, etc)    │
    └────┬─────────────────────┘
         │
      ┌──┴──┐
      │     │
   OK │     │ ERROR
      │     │
      ▼     ▼
    ┌──┐  ┌────────────────────┐
    │✓ │  │ Retry Logic        │
    └──┘  │ (exponential       │
          │  backoff)          │
    ┌──────────────────┐      │
    │ Return Data      │      │
    │ + metadata       │      │
    │ + execution_time │      │
    └──────────────────┘      │
                              │
                     ┌────────▼────────┐
                     │ Max Retries?    │
                     └────────┬────────┘
                              │
                         ┌────┴────┐
                         │         │
                       YES│        │NO
                         │         │
                         ▼         ▼
                    ┌────────┐  ┌──────┐
                    │ Return │  │Retry │
                    │ Error  │  │Again │
                    └────────┘  └──────┘
```

---

## 🛠️ Tool Definition Structure

```python
Tool(
    name: str                           # Unique identifier
    description: str                    # For LLM context
    tool_type: ToolType                 # query/create/update/delete/search/custom
    handler: Callable                   # Function to execute
    parameters: List[ToolParameter]     # Input parameters
    version: str                        # Semver
    enabled: bool                       # Runtime enable/disable
    tags: List[str]                     # For categorization
)

ToolParameter(
    name: str                           # Parameter name
    type: str                           # string/integer/boolean/array/object
    description: str                    # For documentation
    required: bool                      # Is required?
    default: Optional[Any]              # Default value
    enum_values: Optional[List[str]]    # Allowed values
)
```

---

## 📈 Execution Timeline

```
Time ──────────────────────────────────────────────────────────▶

Request
  │
  ├─ FastAPI Route (1ms)
  │   └─ Validate request
  │
  ├─ Intent Classification (10ms)
  │   └─ Keyword matching
  │
  ├─ Tool Selection (5ms)
  │   └─ Filter by intent
  │
  ├─ Parameter Extraction (5ms)
  │   └─ Parse input
  │
  ├─ Tool Execution (100-1000ms) ◄─ Variable based on tool
  │   ├─ Parameter validation (5ms)
  │   ├─ Handler call (95-995ms)
  │   │   ├─ API request (50-900ms) ◄─ Network dependent
  │   │   ├─ Response parsing (5-50ms)
  │   │   └─ Error handling (0-50ms)
  │   └─ Result formatting (5ms)
  │
  ├─ Response Synthesis (10ms)
  │   └─ Format output
  │
  └─ Response (1ms)
     └─ Return to user

Total: ~150-1100ms (mostly network I/O)
```

---

## 📊 Data Models

### AgentRequest
```json
{
  "user_input": "Find high priority incidents",
  "include_tools": ["query_incidents"]  // Optional: specific tools
}
```

### AgentResponse
```json
{
  "user_input": "Find high priority incidents",
  "intent": "query",
  "selected_tools": ["query_incidents", "search_knowledge_base"],
  "tool_calls": [
    {
      "tool_name": "query_incidents",
      "parameters": {"priority": "1"}
    }
  ],
  "tool_results": [
    {
      "tool_name": "query_incidents",
      "success": true,
      "data": {...},
      "error": null,
      "execution_time": 0.234
    }
  ],
  "response": "Found 5 critical incidents",
  "timestamp": "2024-12-26T10:30:00"
}
```

### ToolResult
```json
{
  "tool_name": "query_incidents",
  "success": true,
  "data": {
    "incidents": [...],
    "count": 5,
    "total": 12
  },
  "error": null,
  "execution_time": 0.234,
  "metadata": {
    "executed_at": "2024-12-26T10:30:00",
    "params": {"priority": "1"}
  }
}
```

---

## 🔐 Security Considerations

### Current Implementation
- ✅ Parameter validation
- ✅ Type checking
- ✅ Required parameter enforcement
- ✅ Error handling

### To Add for Production
```
[ ] API authentication (API keys, JWT)
[ ] Rate limiting per user
[ ] Input sanitization (SQL injection, XSS)
[ ] Output filtering (PII, sensitive data)
[ ] Audit logging
[ ] Encryption for stored data
[ ] HTTPS for all connections
[ ] CORS restrictions
[ ] Request signing
```

---

## 🚀 Scalability Patterns

### Current State (Single Server)
```
┌─────────────┐
│ FastAPI App │
│  (1 process)│
└─────────────┘
```

### Scale-Out (Multiple Processes)
```
┌────────────────────────────────┐
│        Load Balancer           │
│   (Nginx, AWS ALB, etc)        │
└──────────┬──────────┬──────────┘
           │          │
      ┌────▼┐    ┌────▼┐
      │ App1│    │ App2│
      └─────┘    └─────┘
           │          │
      ┌────▼─────────▼┐
      │ Shared Cache  │
      │ (Redis)       │
      └───────────────┘
```

### Scale-Up (Microservices)
```
┌─────────────────────────────────┐
│      API Gateway                │
│  (Route requests to services)   │
└──────────┬──────────────────────┘
           │
    ┌──────┼──────────┐
    │      │          │
    ▼      ▼          ▼
┌─────┐ ┌──────┐ ┌─────────┐
│Agent│ │Tools │ │ServiceNow│
│Srv  │ │Srv   │ │Srv      │
└─────┘ └──────┘ └─────────┘
```

---

## 🧪 Testing Strategy

```
Unit Tests
├─ Tool handlers
├─ Parameter validation
├─ Intent classification
└─ Response synthesis

Integration Tests
├─ Agent + Tools
├─ API + Agent
├─ Mock API
└─ Real ServiceNow (optional)

End-to-End Tests
├─ Full request flow
├─ Error scenarios
├─ Performance tests
└─ Load tests
```

---

## 📚 Module Dependencies

```
main.py (FastAPI)
  ├─ agent_system.py
  │  ├─ dataclasses
  │  ├─ enum
  │  ├─ typing
  │  └─ logging
  │
  ├─ servicenow_api.py
  │  ├─ requests
  │  ├─ json
  │  ├─ logging
  │  ├─ dataclasses
  │  └─ typing
  │
  ├─ fastapi
  ├─ pydantic
  ├─ uvicorn
  └─ typing

agent_system.py (Core Logic)
  ├─ dataclasses
  ├─ enum
  ├─ typing
  ├─ json
  ├─ logging
  └─ datetime

servicenow_api.py (API Wrapper)
  ├─ requests
  ├─ json
  ├─ logging
  ├─ typing
  └─ datetime
```

---

## 🎯 Design Principles

### 1. **Flexibility**
- Tools can be added/removed at runtime
- No recompilation needed
- Configuration-driven

### 2. **Extensibility**
- Easy to add new tool types
- Custom intent classifiers
- Pluggable services

### 3. **Reliability**
- Error handling at every layer
- Retry logic with backoff
- Execution history tracking

### 4. **Maintainability**
- Clear separation of concerns
- Well-documented code
- Comprehensive tests

### 5. **Scalability**
- Stateless design
- Can be containerized
- Horizontal scaling ready

---

## 📍 Key Decision Points

### Tool Selection Logic
```python
# Currently: Simple keyword matching
if "query" in intent:
    return tools with "query" tag

# Could be: ML-based
if intent_embedding.similarity(tool_embedding) > 0.8:
    return tool

# Could be: LLM-based
"Given intent '{intent}' and tools {tools}, which are most relevant?"
```

### Parameter Extraction
```python
# Currently: Empty (returns {})
# Could be: Regex/pattern matching
re.findall(r"priority\s*=\s*(\d)", user_input)

# Could be: LLM-based
"Extract parameters for tool X from user input: ..."
```

### Response Synthesis
```python
# Currently: Simple count
f"Processed request. {success}/{total} tools executed"

# Could be: Template-based
"Found {incident_count} incidents: {incident_list}"

# Could be: LLM-based
"Summarize these results in 1-2 sentences: ..."
```

---

## 🔄 Development Phases Integration

```
Phase 1: Foundation ✅
├─ Agent System ✅
├─ API Wrapper ✅
├─ FastAPI Backend ✅
└─ Mock Data ✅

Phase 2: Data (Next)
├─ Extract ITSM data
├─ Format training examples
├─ Quality validation
└─ Create datasets

Phase 3: Fine-tuning
├─ Choose model
├─ Set up training
├─ Run training
└─ Evaluate results

Phase 4: RAG System
├─ Embed documents
├─ Set up vector DB
├─ Implement retrieval
└─ Integrate with agent

Phase 5: Agentic ✅
├─ Advanced reasoning
├─ Tool chaining
├─ Error recovery
└─ Multi-step planning

Phase 6: Production
├─ Real ServiceNow
├─ Security hardening
├─ Performance tuning
└─ Deployment

Phase 7: Operations
├─ Monitoring
├─ Alerting
├─ Continuous learning
└─ Scaling
```

---

This architecture supports the complete journey from prototype to production!
