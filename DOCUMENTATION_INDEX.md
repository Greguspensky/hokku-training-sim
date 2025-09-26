# Documentation Index
**Hokku Training Simulation Project**

## 📚 Complete Documentation Suite

This project now has comprehensive documentation to enable fast onboarding and troubleshooting. All documentation files are located in the project root:

### 🚀 Quick Start
- **CLAUDE.md** - Updated quick start guide with current status and agent details

### 📖 Core Documentation
1. **PROJECT_DOCUMENTATION.md** - Complete project overview, architecture, and current status
2. **DATABASE_REFERENCE.md** - Full database schema, known issues, and data relationships
3. **API_REFERENCE.md** - All API endpoints with examples, parameters, and performance metrics
4. **TROUBLESHOOTING_GUIDE.md** - Common issues, solutions, and diagnostic procedures

## 🎯 Current Project Status (September 24, 2025)

### ✅ Working Features
- **ElevenLabs Integration**: Fully functional with agent `agent_5101k5ksv08newj9b4aa2wt282hv`
- **Dynamic Knowledge Loading**: 2 documents (1629 characters) loading from database
- **Multi-language Support**: 13 languages with automatic translation
- **Demo Mode**: File-based assignments working perfectly
- **Training Sessions**: Full session management and recording capability

### ⚠️ Known Issues
- Database missing `avatar_mode` column in `tracks` table
- Demo scenarios generate UUID format warnings (expected behavior)
- Multiple dev servers may be running on different ports

### 🔑 Key Identifiers
```
Current Agent ID: agent_5101k5ksv08newj9b4aa2wt282hv
Demo Assignment: demo-assignment-1758312913428-7qtmmsq
Company ID: 01f773e2-1027-490e-8d36-279136700bbf
Employee ID: f68046c7-e78d-4793-909f-61a6f6587485
```

## 🚀 Quick Start for New Sessions

### 1. Navigate to Project
```bash
cd /Users/gregoryuspensky/hokku-training-sim/hokku-training-sim
```

### 2. Start Development
```bash
npm run dev
```

### 3. Test Core Functionality
- Training Page: http://localhost:3000/employee/training/demo-assignment-1758312913428-7qtmmsq
- API Test: http://localhost:3000/api/test-env

### 4. Reference Documentation
- Read **PROJECT_DOCUMENTATION.md** for complete overview
- Check **TROUBLESHOOTING_GUIDE.md** if issues occur
- Use **API_REFERENCE.md** for endpoint details
- Consult **DATABASE_REFERENCE.md** for schema information

## 📊 Performance Metrics (Current)

From latest logs:
- **ElevenLabs Token Generation**: 655-1011ms
- **Knowledge Loading**: 485-691ms (2 documents, 1629 chars)
- **Assignment Queries**: 442-693ms
- **Knowledge Base Documents**: 333-484ms

## 🔧 Environment Requirements

All required environment variables are configured in `.env.local`:
- ✅ Supabase connection (database)
- ✅ ElevenLabs API key (with convai_write permissions)
- ✅ OpenAI API key (for translation)

## 📞 Support & Maintenance

### Immediate Reference
- **Current Issues**: See TROUBLESHOOTING_GUIDE.md section "Common Issues"
- **Database Problems**: See DATABASE_REFERENCE.md section "Known Schema Issues"
- **API Errors**: See API_REFERENCE.md section "Error Responses"

### Emergency Procedures
1. **System Reset**: Follow TROUBLESHOOTING_GUIDE.md "Emergency Fixes"
2. **Database Rollback**: Use `npm run db:backup` and `npm run db:restore`
3. **Code Rollback**: Use git reset procedures in troubleshooting guide

## 📈 Next Development Priorities

### High Priority
1. Fix database schema (add missing `avatar_mode` column)
2. Clean up multiple development processes
3. Resolve UUID format warnings in demo scenarios

### Medium Priority
1. Replace hard-coded knowledge with fully dynamic system
2. Add question scoring and evaluation system
3. Improve error handling and user feedback

### Low Priority
1. Implement advanced training modes beyond theory Q&A
2. Add analytics and progress tracking dashboard
3. Optimize API response times and implement caching

---

**Documentation Complete**: This comprehensive documentation suite ensures that any future development session can start immediately with full context and understanding of the project's current state, architecture, and known issues.