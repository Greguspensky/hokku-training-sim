# Customer Emotional States - Quick Reference Guide

**Status**: ✅ WORKING IN PRODUCTION
**Date**: 2025-10-12

---

## Quick Links
- **Full Documentation**: `EMOTION_SYSTEM_COMPLETE_2025-10-12.md`
- **Migration SQL**: `EMOTION_SYSTEM_MIGRATION_2025-10-12.sql`
- **Core Library**: `src/lib/customer-emotions.ts`

---

## Emotion Levels at a Glance

| Level | Icon | Badge Color | Use Case | Difficulty |
|-------|------|-------------|----------|------------|
| **Calm** | 😊 | 🟢 Green | Standard service training | Beginner |
| **Frustrated** | 😤 | 🟡 Yellow | Time pressure handling | Intermediate |
| **Angry** | 😠 | 🟠 Orange | De-escalation basics | Advanced |
| **Extremely Angry** | 🤬 | 🔴 Red | Masterful de-escalation | Expert |

---

## Manager: How to Use

### Create Emotional Scenario
1. Manager Dashboard → Training tab
2. "Create New Scenario" → Service Practice
3. Fill required fields
4. **Select Customer Emotion Level** dropdown
5. Read description → Save

### What You'll See
- Color-coded badge on scenario card
- Emoji icon + emotion label
- Employees see emotion level before training

---

## Employee: What to Expect

### 🟢 Calm Customer
**Agent Greeting**: "Извините, мне нужна помощь." (Excuse me, I need help)
**Behavior**: Polite, patient, friendly
**Your Goal**: Practice standard service skills

### 🟡 Frustrated Customer
**Agent Greeting**: "Извините, мне срочно нужна помощь." (Excuse me, I need help right away)
**Behavior**: Impatient, shows time pressure
**Your Goal**: Quick service, acknowledge urgency

### 🟠 Angry Customer
**Agent Greeting**: "Послушайте, у меня серьезная проблема!" (Listen, I have a serious problem!)
**Behavior**: Upset, uses CAPS, challenges explanations
**Your Goal**: Deep empathy + concrete solutions

### 🔴 Extremely Angry Customer ⚠️
**Agent Greeting**: "Это НЕПРИЕМЛЕМО! Мне нужен менеджер!" (This is UNACCEPTABLE! I need the manager!)
**Behavior**: FURIOUS, confrontational, rejects first solutions
**Your Goal**: Exceptional empathy + multiple solutions + accountability

---

## De-Escalation Cheat Sheet

### ✅ What Works

**For Frustrated:**
- Acknowledge time pressure: "I understand you're in a hurry"
- Act quickly and efficiently
- Give clear timelines

**For Angry:**
- Show genuine empathy: "I completely understand your frustration"
- Apologize sincerely (not just "sorry")
- Provide concrete action plan
- Take visible effort to resolve

**For Extremely Angry:**
- Stay calm (don't match energy)
- Deep empathy + acknowledge severity
- Multiple solution attempts
- Show accountability: "I take full responsibility"
- Go above and beyond

### ❌ What Doesn't Work

- Generic apologies: "Sorry about that"
- Making excuses: "It's not usually like this"
- Dismissing concerns: "It's not a big deal"
- Getting defensive or matching anger
- Rushing to solution without empathy

---

## Linguistic Markers by Emotion

### Calm 😊
- "Please", "Thank you", "I appreciate"
- "That sounds good", "Perfect"

### Frustrated 😤
- "I'm in a hurry", "Come on", "Seriously?"
- "I don't have time", "Finally"

### Angry 😠
- "This is UNACCEPTABLE", "What?!?!"
- "That's not good enough", "Listen,"
- Uses CAPS for emphasis

### Extremely Angry 🤬
- "I've HAD IT!!!", "Get me your MANAGER"
- "COMPLETE JOKE", "Are you KIDDING ME?!?!"
- HEAVY CAPS usage, multiple !!!

---

## Troubleshooting

### Agent Not Acting Emotional?
**Check Console Logs**:
```
😤 Customer emotion level: [should show emotion, not 'calm (default)']
```

**If showing 'calm (default)'**:
1. Re-save scenario with emotion selected
2. Verify database has `customer_emotion_level` column
3. Refresh training page

### Emotion Not Saving?
1. Check database migration ran: `EMOTION_SYSTEM_MIGRATION_2025-10-12.sql`
2. Verify in Supabase: scenarios table should have `customer_emotion_level` column
3. Clear browser cache and retry

### Emotion Not Displaying?
1. Check manager dashboard - should see colored badge
2. Check employee training page - should see emotion box
3. If missing, scenario may not have emotion level set

---

## Key Console Logs

### When Session Starts ✅
```
😤 Customer emotion level: extremely_angry
🎯 Starting session with dynamic variables: {customer_emotion_level: 'extremely_angry'}
🎭 🤬 Extremely Angry Customer greeting for ru: "Это НЕПРИЕМЛЕМО!..."
```

### Data Flow Check ✅
```
📋 Scenario context received: {customer_emotion_level: 'extremely_angry'}
🔧 Dynamic variables being sent to ElevenLabs:
- Customer emotion level: extremely_angry
```

---

## Files Modified (10 Total)

### Core System
1. `src/lib/customer-emotions.ts` - Emotion definitions
2. `src/lib/scenarios.ts` - Database operations
3. `src/lib/elevenlabs-conversation.ts` - ElevenLabs integration

### UI Components
4. `src/components/ScenarioForm.tsx` - Create form
5. `src/components/EditScenarioForm.tsx` - Edit form
6. `src/components/ElevenLabsAvatarSession.tsx` - Session component
7. `src/app/employee/training/[assignmentId]/page.tsx` - Training page
8. `src/app/manager/page.tsx` - Manager dashboard

### API Routes
9. `src/app/api/scenarios/route.ts` - POST endpoint
10. `src/app/api/scenarios/[id]/route.ts` - PATCH endpoint

---

## Performance Metrics

- **System Prompt Generation**: <5ms
- **ElevenLabs Response**: ~100-300ms (no change)
- **Database Overhead**: Negligible
- **Overall Impact**: ✅ No performance degradation

---

## Support & Documentation

### Full Documentation
- **EMOTION_SYSTEM_COMPLETE_2025-10-12.md** - Complete guide with testing results

### Technical Details
- **src/lib/customer-emotions.ts** - View all emotion definitions and behaviors

### Database
- **EMOTION_SYSTEM_MIGRATION_2025-10-12.sql** - Migration script with verification

---

**Quick Start**: Manager creates scenario → Select emotion level → Employee trains → AI agent acts accordingly ✅

**Status**: ✅ PRODUCTION READY AND WORKING
