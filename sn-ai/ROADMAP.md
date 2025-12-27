# LLM Fine-Tuning & ServiceNow Integration - Complete Roadmap

## Phase 1: Foundation & Planning (Week 1-2)

### 1.1 Choose Your Approach
**Option A: Fine-tune Open Source LLM (RECOMMENDED FOR YOU)**
- Models: Llama 2, Mistral 7B, Qwen, or similar
- Cost: Lower, controllable
- Time: 1-2 weeks initial setup
- Infrastructure: GPU (local or cloud)

**Option B: Use Proprietary API + Custom RAG**
- Models: GPT-4, Claude, etc.
- Cost: Higher per inference
- Time: 3-5 days setup
- Infrastructure: API access only

**For ServiceNow Context:** Use **Option A + RAG** hybrid approach for best results

### 1.2 Daily Time Commitment

```
Week 1-2 (Planning):     2-3 hours/day
Week 3-6 (Data Prep):    3-4 hours/day
Week 7-10 (Fine-tune):   2-3 hours/day (mostly waiting for training)
Week 11-14 (Integration): 3-4 hours/day
Week 15+ (Production):   1-2 hours/day (monitoring)
```

**Total Timeline: 3-4 months to production**

---

## Phase 2: Data Preparation (Week 3-6)

### 2.1 Gather ServiceNow ITSM Data
- Incidents, Problems, Changes, Requests
- Knowledge articles
- Resolution patterns
- Custom fields relevant to your org

### 2.2 Data Format & Storage
- **Quantity:** 10,000-100,000 examples (minimum)
- **Quality:** ~80% accuracy in labels
- **Format:** JSON lines (.jsonl) for training

### 2.3 Processing Steps
1. Extract from ServiceNow via REST API
2. Clean & normalize
3. Create instruction-following pairs
4. Split: 80% train, 10% validation, 10% test

---

## Phase 3: Fine-Tuning (Week 7-10)

### 3.1 Infrastructure Options

**Local GPU (Budget):**
- RTX 4090: ~$1600, 8-10 min training
- RTX 4080: ~$1200, 12-15 min training

**Cloud GPU (Flexible):**
- AWS EC2 (g4dn.xlarge): $0.35/hr → ~$84/24hr training
- Google Colab Pro+: $10/mo
- Lambda Labs: $0.33/hr

**Recommended:** Start with Colab, scale to cloud GPU if needed

### 3.2 Training Parameters
```
Batch size:           16-32
Learning rate:        2e-5 to 5e-5
Epochs:              3-5
Sequence length:      2048-4096
Training time (7B):   8-24 hours (GPU dependent)
```

### 3.3 Fine-Tuning Methods
1. **LoRA (Recommended):** Faster, cheaper, 10-20% parameters
2. **QLoRA:** Even lighter, 2-4% parameters
3. **Full Fine-tune:** Better quality, expensive

---

## Phase 4: RAG System Setup (Week 8-10, Parallel)

### 4.1 Vector Database
- **Pinecone:** Managed, easy, $0.04/1M vectors
- **Weaviate:** Open source, self-hosted
- **Chroma:** Lightweight, local

### 4.2 Retrieval Flow
```
User Query → Embed (same model) → Vector DB search → 
Top-K results → Inject into prompt → Fine-tuned LLM → Response
```

### 4.3 Storage Strategy
- Store embeddings of all ServiceNow data
- Update daily/weekly with new incidents
- Maintain version control of prompts

---

## Phase 5: Agentic System Design (Week 11-12)

### 5.1 Agent Architecture
```
User Input
    ↓
[Intent Classifier] → Classify ServiceNow action type
    ↓
[Tool Router] → Select appropriate tools:
    ├─ Query Incidents
    ├─ Create Change
    ├─ Search KB
    ├─ Get Approvals
    └─ Custom Actions
    ↓
[RAG + Fine-tuned LLM] → Generate response with context
    ↓
[Validation Layer] → Safety checks, schema validation
    ↓
ServiceNow API Call → Execute action
    ↓
Response to User
```

### 5.2 Tools/Functions (Flexible Design)
- Tool registry (add/remove dynamically)
- Each tool has metadata (name, description, params)
- Tools return structured data
- Chain tools for complex workflows

---

## Phase 6: ServiceNow Integration (Week 13-14)

### 6.1 Connection Layer
- OAuth 2.0 authentication
- REST API wrapper (reusable)
- Error handling & retry logic
- Logging & monitoring

### 6.2 Supported Operations
- Query (GET) - Incidents, Problems, Changes, CIs
- Create (POST) - New records with validation
- Update (PATCH) - Status, assignments, comments
- Search (GET with filters)

### 6.3 Security
- API key encryption
- Rate limiting
- Audit logging
- Input sanitization

---

## Phase 7: Deployment (Week 15)

### 7.1 Deployment Options

**Option 1: Docker on VM (Recommended for start)**
- FastAPI app containerized
- Deploy to: AWS EC2, Azure VM, ServiceNow PDI
- Scaling: Manual to Auto-scaling groups

**Option 2: Serverless**
- AWS Lambda + API Gateway
- Cost-effective, scales automatically
- Limitations: 15min timeout, cold starts

**Option 3: ServiceNow Native**
- Scoped app within ServiceNow
- Pro: Native integration, no extra infrastructure
- Con: Limited compute resources

### 7.2 Monitoring & Improvements
- Track accuracy, latency, errors
- Collect user feedback
- Monthly retraining with new data
- A/B test prompts and models

---

## Cost Breakdown (3-month estimate)

| Phase | Item | Cost |
|-------|------|------|
| **Infrastructure** | Cloud GPU (2 weeks) | $200-400 |
| **Data** | ServiceNow API usage | Free (existing) |
| **Vector DB** | Pinecone starter | $0-20 |
| **Deployment** | EC2 (t3.medium) | $30/mo = $90 |
| **LLM API** | Optional fallback | $20-50 |
| **Total** | | **$350-600** |

---

## Quick Start Checklist

- [ ] Phase 1: Choose approach (fine-tune open LLM)
- [ ] Phase 2: Extract 1,000 sample ITSM records from ServiceNow
- [ ] Phase 3: Set up Colab GPU environment
- [ ] Phase 4: Build RAG system with Pinecone
- [ ] Phase 5: Create agentic tool registry
- [ ] Phase 6: Build ServiceNow API wrapper
- [ ] Phase 7: Deploy FastAPI + Docker
- [ ] Monitor and iterate

---

## Next Steps (THIS SESSION)

1. ✅ Set up Python environment
2. Create realistic ITSM JSON dataset (synthetic)
3. Build agentic system framework
4. Create ServiceNow API wrapper
5. Set up FastAPI backbone
